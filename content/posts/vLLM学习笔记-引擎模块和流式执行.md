---
title: vLLM学习笔记-引擎模块和流式执行
date: 2026-05-09 10:14:59
tags:
- vLLM 
- AI_Infra  
categories:
- 学习笔记
---

离线推理：LLMEngine 
在线服务：AsyncLLM

# ZMQ通信
AsyncLLM负责从客户端接收输入请求，并将其转发至底层实际执行推理任务的引擎组件，随后以异步方式获取执行结果。二者之间的通信依托于 ZeroMQ（ZMQ）实现。

## REQ/REP通信模式
client 端将以同步阻塞的方式等待 server 端的响应回复。这种模式要求通信双方严格遵循一问一答的交互流程——客户端必须先发送请求并等待回复，不能连续发送两次请求，否则会引发异常。

1. 吞吐量受限：单个客户端无法连续发送多个请求，必须等待响应，形成串行瓶颈；
2. 服务端阻塞：服务端被绑定在同步处理流程中，难以并行处理多个客户端请求；
3. 缺乏路由信息：REP 套接字自动封装了路由路径，但不暴露原始客户端身份，不利于会话追踪与状态管理；
4. 无法双向通信：服务端不能主动向客户端推送消息。

## DEALER/ROUTER通信模式
- ROUTER套接字能够接收来自多个客户端的消息，并自动在消息前附加唯一标识符（Identity），从而识别消息来源；
- DEALER 套接字支持异步双向通信，允许客户端连续发送请求，无需等待响应；

DEALER 与 ROUTER 模式的结合，能够构建一个完全异步、高并发、可扩展的通信架构，特别适用于像 AsyncLLM 这类需要客户端批量提交请求、服务端并行处理并按需响应的场景。

客户端通过 DEALER 套接字向服务端发送请求。每条请求消息包含三个关键字段：
1. msg_id：请求的唯一标识符（UUID 或递增 ID），用于追踪请求生命周期。在后续课程中我们将看到，在 AsyncLLM 架构中，当客户端向 EngineCore 提交生成任务时，也会携带类似的请求编号，以支持异步回调和状态管理；
2. query：实际的输入内容，例如用户提问或提示词（prompt）；
3. timestamp：时间戳。

构造完请求后，客户端调用socket.send_json()将消息发送至服务端。由于DEALER的异步特性，客户端无需等待响应即可继续发送下一条请求，从而实现高吞吐、非阻塞的消息提交。

服务端的ROUTER套接字在接收到消息时，会自动在消息前附加发送方的标识，形成多段式（multipart）消息结构：
1. 客户端标识（Identity）：由客户端在初始化时设置，用于唯一标识其身份；
2. 实际消息内容（Message payload）：即客户端发送的 JSON 数据或其他格式的有效载荷。

服务端从接收到的 multipart 消息中提取出核心数据部分（即 message），然后将其交由模拟推理函数 process_inference 进行处理

### C/S通信

```python
if __name__ == "__main__":
    # 启动引擎线程
    engine_thread = threading.Thread(target=engine, daemon=True)
    engine_thread.start()

    time.sleep(1)  # 等待引擎启动

    # 启动多个客户端
    client_threads = []
    for i in range(3):
        t = threading.Thread(target=client, args=(i,), daemon=True)
        t.start()
        client_threads.append(t)

    try:
        # 等待所有客户端完成
        for t in client_threads:
            t.join()
        time.sleep(2)
    except KeyboardInterrupt:
        print("\n主程序退出.")
```

### 增加zmq.Poller非阻塞等待

现在有一个基于 DEALER/ROUTER 的基本通信架构，但当前的 engine() 函数虽然能够处理来自不同客户端的请求，但其单线程阻塞式接收（recv_multipart() 会一直等待）仍存在性能瓶颈。

我们通过引入 zmq.Poller 来实现一个非阻塞、事件驱动的多套接字监听机制。它是 ZeroMQ 提供的核心 I/O 多路复用机制，用于实现高效、非阻塞的事件驱动通信。它允许应用程序在一个线程中同时监控多个套接字（socket）的状态变化，例如是否有消息到达（可读）或是否可以发送数据（可写），而无需为每个连接创建独立的线程。

与传统的阻塞式 recv() 不同，zmq.Poller 通过封装操作系统底层的高性能事件通知机制（如 Linux 的 epoll、macOS 的 kqueue 或跨平台的 poll），在指定超时时间内监听多个套接字的就绪状态。当任意一个套接字准备好进行 I/O 操作时，zmq.Poller 会立即返回该套接字及其事件类型，使程序能够及时处理消息，避免不必要的等待。

## PULL/PUSH通信模式
这个有点像操作系统里面的管道

PUSH 与 PULL 是 ZeroMQ 所提供的单向数据流通信模式，构成一个无回复、单向的消息管道。
消息从 PUSH 端发送，由 PULL 端接收。该模式是实现流式数据传输的理想底层通信机制之一。在流式推理场景中，生产端 Engine 需要连续生成输出，模型每推理出一个 token 就可以通过 PUSH 端发送一次，消费端 AsyncLLM 则持续监听并接收新的数据分块。
由于生产端无需等待或获取消费端的响应，且消息的传递可靠性与到达顺序由 ZeroMQ 保障，因此该模式非常适合在模型推理过程中，将逐个生成的 token 实时推送给消费端。

# Engine接收数据

```python 
def process_input_sockets(self, input_addresses: list[str],
                          coord_input_address: Optional[str],
                          identity: bytes):
    """Input socket IO thread."""
    # Msgpack serialization decoding.
    add_request_decoder = MsgpackDecoder(EngineCoreRequest)
    generic_decoder = MsgpackDecoder()
    with ExitStack() as stack, zmq.Context() as ctx:
        # 1. 创建zmq套接字和客户端连接
        input_sockets = [
            stack.enter_context(
                make_zmq_socket(ctx,
                                input_address,
                                zmq.DEALER,
                                identity=identity,
                                bind=False))
            for input_address in input_addresses
        ]
        
        # Register sockets with poller.
        poller = zmq.Poller()
        for input_socket in input_sockets:
            # Send initial message to each input socket - this is requ
            # before the front-end ROUTER socket can send input messag
            # back to us.
            input_socket.send(b'')
            # 2. 将套接字注册到poller中，让内核关注套接字的读写事件
            poller.register(input_socket, zmq.POLLIN)
        if coord_socket is not None:
            poller.register(coord_socket, zmq.POLLIN)
        while True:
            for input_socket, _ in poller.poll():
                # (RequestType, RequestData)
                # 3. 接收来自客户端的请求数据 
                type_frame, *data_frames = input_socket.recv_multipart
                    copy=False)
                request_type = EngineCoreRequestType(
                    bytes(type_frame.buffer))
                # Deserialize the request data.
                decoder = add_request_decoder if (
                    request_type
                    == EngineCoreRequestType.ADD) else generic_decoder
                # 4. 解压缩请求
                request = decoder.decode(data_frames)
                # Push to input queue for core busy loop.
                # 5. 放入到engine的待处理队列中
                self.input_queue.put_nowait((request_type, request))
```
随后，如果 AsyncLLM 可以将消息推送回来，当 poller（即这里的 EngineCore）返回时，说明系统检测到了某个套接字有可读事件。此时，应打开对应的输入套接字，即 input_socket，并开始接收数据。
接收到的数据被存储在 data_frames 中；由于传输前对请求数据进行了编码压缩以降低带宽占用，因此需要调用 decoder.decode 对其进行解码。解码完成后，将完整的请求放入输入队列 input_queue 中。
也就是说来自前端的请求，请求会以 (request_type, request) 的形式通过 self.input_queue.put_nowait(...) 放入输入队列self.input_queue。

### Engine中的生产者和消费者
1. process_input_sockets 是生产者
它负责不断从外部 socket 接收请求，然后把请求放入 input_queue
2. Engine 主循环中的 _process_input_queue 是消费者
它负责从 input_queue 中取出请求，再交给后续调度与执行逻辑处理

#### Thread1 
以同步的方式从Engine的输入队列input_queue中获取新的请求，并在随后用_handle_client_request进一步放入该请求并做进一步的调度。
```python 
def _process_input_queue(self):
    """Exits when an engine step needs to be performed."""
    waited = False
    while not self.engines_running and not self.scheduler.has_requests():
        if logger.isEnabledFor(DEBUG) and self.input_queue.empty():
            logger.debug("EngineCore waiting for work.")
            waited = True
        req = self.input_queue.get()
        self._handle_client_request(*req)
```

#### Thread2 
线程2中运行的函数就是刚才所说的process_input_sockets，以异步非阻塞的方式从客户端AsyncLLM中获取新的请求。线程1和线程2两者的工作协作都围绕着input_queue展开。

process_input_sockets 与 _process_input_queue 分别处于 Engine 请求处理链路的不同阶段。
1. 前者运行在后台输入线程中，负责通过 ZMQ socket 接收前端发送的请求消息，并在完成反序列化后将其放入内部输入队列 input_queue；
2. 后者则运行在 Engine 主循环中，负责从 input_queue 中取出这些请求，并进一步交由调度器和执行器处理。
因此，process_input_sockets 主要承担外部通信与入队的职责，而 _process_input_queue 主要承担内部取队列与分发处理的职责。

# Engine发送数据

上一节已经提到，Engine 会通过 ZMQ 从前端接收输入请求。当请求经过调度器完成调度，并由执行器 Executor 完成模型执行后，Engine 还需要将对应的推理结果返回给用户。在 vLLM 中，这条**返回链路采用的是 PUSH/PULL 模式**：Engine 作为结果的产生者，负责将输出主动推送回前端。

虽然前面的输入通道已经使用了 DEALER，但这里的 PUSH 属于另一条独立的输出通道。DEALER/ROUTER 主要用于前端按 identity 将请求路由到指定 Engine，而 PUSH 则用于 Engine 将处理结果直接推送回前端，因此两者面向的是不同方向、不同职责的通信流程。

```python 
def process_output_sockets(self, output_paths: list[str],
                           coord_output_path: Optional[str],
                           engine_index: int):
  """Output socket IO thread."""

  # Msgpack serialization encoding.
  encoder = MsgpackEncoder()
  # Send buffers to reuse.
  reuse_buffers: list[bytearray] = []
  # Keep references to outputs and buffers until zmq is finished
  # with them (outputs may contain tensors/np arrays whose
  # backing buffers were extracted for zero-copy send).
  pending = deque[tuple[zmq.MessageTracker, Any, bytearray]]()

  # We must set linger to ensure the ENGINE_CORE_DEAD
  # message is sent prior to closing the socket.
  with ExitStack() as stack, zmq.Context() as ctx:
   # 1. 创建ZMQ PUSH模式的套接字
    sockets = [
      stack.enter_context(
        make_zmq_socket(ctx, output_path, zmq.PUSH, linger=4000))
      for output_path in output_paths
    ]

    coord_socket = stack.enter_context(
      make_zmq_socket(
        ctx, coord_output_path, zmq.PUSH, bind=False,
        linger=4000)) if coord_output_path is not None else None
    max_reuse_bufs = len(sockets) + 1

    while True: # 从主循环开始看
      # 2. 等待从输出队列中获取结果
      output = self.output_queue.get()
      assert not isinstance(output, bytes)
      # 3. 确定区分发送的client是哪一个
      client_index, outputs = output
      outputs.engine_index = engine_index

      while pending and pending[-1][0].done:
        reuse_buffers.append(pending.pop()[2])

      buffer = reuse_buffers.pop() if reuse_buffers else bytearray()
      # 4. 对结果进行序列化
      buffers = encoder.encode_into(outputs, buffer)
      # 5. 发送到对应的客户端
      tracker = sockets[client_index].send_multipart(buffers,
                                                       copy=False,
                                                       track=True)
      pending.appendleft((tracker, outputs, buffer))
```


pending 用来“暂时保管正在被 ZeroMQ 异步发送的数据”，防止这些数据在发送完成前被 Python 回收或复用。

pending：正在发送中，不能动
reuse_buffers：已经发送完，可以复用

| 元素        | 作用                                    |
| --------- | ------------------------------------- |
| `tracker` | 判断 ZMQ 是否发送完成                         |
| `outputs` | 保留输出对象引用，防止 tensor / numpy buffer 被释放 |
| `buffer`  | 保留 msgpack 编码 buffer，防止被提前复用或释放       |


# AsyncLLM发送请求 
有接收请求，就必然有客户端发送请求。我们知道 Engine 端用的是 DEALER，那么客户端就是 ROUTER

后续AsyncLLM会通过一个EngineCoreClient中的input_socket来向Engine转发来自客户端的请求。
```python 
self.engine_core = EngineCoreClient.make_async_mp_client(
    vllm_config=vllm_config,
    executor_class=executor_class,
    log_stats=self.log_stats,
    client_addresses=client_addresses,
    client_index=client_index,
)

# self.input_socket是self.engine_core的中一个变量，也就是EngineCoreClient中的一个变量
self.input_socket = self.resources.input_socket = make_zmq_socket(
                self.ctx, input_address, zmq.ROUTER, bind=True)
```
在AsyncLLM中创建的EngineCoreClient的子类是AsyncMPClient，在AsyncMPClient中有一个input_socket用于向Engine转发请求，也就是像上面代码写的那样。
也就是说，客户端侧的核心并不是 HTTP Server 本身，而是 AsyncLLM 这一层：
- AsyncLLM 初始化时，会创建一个 EngineCoreClient。
- 这个 EngineCoreClient 内部持有一个 input_socket，用于把前端请求转发给后端 EngineCore。
- 其中 input_socket 使用的正是 ROUTER socket。

在客户端 AsyncLLM 的 add_request 函数中：
1. 为每个请求创建一个用于接收输出结果的队列 queue。这个队列并不会发送给 EngineProc，而是保留在前端，用来缓存该请求后续返回的增量结果。
2. 调用 _add_request() 处理该请求，在这个函数里：
  - 一方面会把 request 注册到前端的 OutputProcessor 中，并与对应的 queue 绑定；
  - 另一方面，会调用 engine_core.add_request_async(request)，将 request 通过 EngineCoreClient 的 input_socket 发往 EngineProc 所在进程执行推理。
```python 
# 为了突出重点，以下的代码有省略
async def add_request(
  self,
  request_id: str,
  prompt: PromptType,
  params: Union[SamplingParams, PoolingParams],
  arrival_time: Optional[float] = None,
  lora_request: Optional[LoRARequest] = None,
  tokenization_kwargs: Optional[dict[str, Any]] = None,
  trace_headers: Optional[Mapping[str, str]] = None,
  priority: int = 0,
  data_parallel_rank: Optional[int] = None,
) -> RequestOutputCollector:
  """Add new request to the AsyncLLM."""

  if self.errored:
    raise EngineDeadError()

    is_pooling = isinstance(params, PoolingParams)

    # Create a new output collector for the request.
    # 为每个请求创建一条队列
    queue = RequestOutputCollector(output_kind=params.output_kind)
    # 将请求request和新创建的队列queue传递到_add_request
    await self._add_request(request, prompt_str, None, 0, queue)

    return queue

```
## 创建结果的接收队列 
结果的接收队列就是上一节中的 queue。它与请求一一对应，用于在前端接收来自 Engine 的推理输出。每个请求都会创建一个独立的队列，这些队列并不是单独以一个"队列表"的形式保存，而是作为请求状态的一部分，按 request_id 组织并统一维护在 AsyncLLM 的 OutputProcessor 中。调用链如下图所示：
1. 当 Engine 产生输出后，前端后台的 output_handler 会持续从 EngineCore 拉取 EngineCoreOutputs，并将其交给 OutputProcessor 处理。
2. OutputProcessor 会根据 request_id 找到对应的请求状态，以及其中绑定的 queue，再将新生成的 token 或阶段性输出放入该队列。
3. 上层 generate() 再从这个 queue 中不断取出结果，对外形成流式输出。 

```python 
class AsyncLLM():
  async def _add_request(self, request: EngineCoreRequest,
                         prompt: Optional[str],
                         parent_req: Optional[ParentRequest], index: int,
                         queue: RequestOutputCollector):

    self.output_processor.add_request(request, prompt, parent_req, index, queue)
    
class OutputProcessor:                
    def add_request(
        self,
        request: EngineCoreRequest,
        prompt: Optional[str],
        parent_req: Optional[ParentRequest] = None,
        request_index: int = 0,
        queue: Optional[RequestOutputCollector] = None,
    ) -> None:
        # 1. 每个请求独有自己独立的req id
        request_id = request.request_id
        if request_id in self.request_states:
            raise ValueError(f"Request id {request_id} already running.")
        tokenizer = None if not self.tokenizer else \
            self.tokenizer.get_lora_tokenizer(request.lora_request)
        req_state = RequestState.from_new_request(tokenizer=tokenizer,
                                                  request=request,
                                                  prompt=prompt,
                                                  parent_req=parent_req,
                                                  request_index=request_index,
                                                  queue=queue,
                                                  log_stats=self.log_stats)
        # 2. 对每个请求对应的队列进行缓存
        self.request_states[request_id] = req_state
```

## 转发请求 
当AsyncLLM接收到请求之后并创建对应的队列之后，如前文所述，就通过self.engine_core的add_request_async对请求通过ZMQ进行转发，转发到Engine对应的套接字上，其中engine_core是AsyncMPClient子类

```python 
async def _add_request(self, request: EngineCoreRequest,
                       prompt: Optional[str],
                       parent_req: Optional[ParentRequest], index: int,
                       queue: RequestOutputCollector):
    # Add the request to OutputProcessor (this process).
    self.output_processor.add_request(request, prompt, parent_req, index,
                                      queue)
    # Add the EngineCoreRequest to EngineCore (separate process).
    await self.engine_core.add_request_async(request)
```

1. 流程进入 AsyncMPClient.add_request_async() 后，会先将请求对象序列化编码，即通过 self.encoder.encode 转换成可跨进程传输的消息帧。
2. 随后客户端会将 engine identity、request type 以及编码后的请求数据组装成一条 multipart 消息，并通过 self.input_socket 发送到 Engine 端。
3. 至此，请求从前端转发到 Engine 的流程就闭环了，也与前面介绍的 ROUTER -> DEALER 通信链路对应起来。

```python
async def add_request_async(self, request: EngineCoreRequest) -> None:
    # 给请求打上客户端标记
    request.client_index = self.client_index
    # 将 ADD 类型的请求发往 Engine
    await self._send_input(EngineCoreRequestType.ADD, request)

def _send_input():
    # 将 request 序列化，并与请求类型一起封装成消息
    message = (request_type.value, *self.encoder.encode(request))
    return self._send_input_message(message, engine, request)

def _send_input_message():
    # 通过 ZMQ 套接字把消息发送到 Engine
    future = self.input_socket.send_multipart(msg, copy=False, track=True)
    return future
```


# AsyncLLM接收结果
在 AsyncLLM 中，每个请求都会创建一个专属队列，并在请求注册阶段绑定到 OutputProcessor 维护的请求状态上。后续 Engine 返回结果时，需要先经过 OutputProcessor 的拆分与后处理，再分发到对应请求的专属队列中。整体流程如下：
1. 拉取结果：AsyncMPClient 使用 PULL socket 持续从 Engine 侧接收推理结果，并将接收到的 EngineCoreOutputs 放入本地的 output_queue 中。
2. 结果处理：AsyncLLM 后台的 output_handler 持续从 output_queue 中取出结果，并交给 OutputProcessor 进行拆分和后处理。
3. 放入请求队列：OutputProcessor 根据结果中携带的 request_id 找到对应请求状态中的专属 queue，并将新生成的 token 或阶段性输出放入该队列。
4. 对外返回：上层 generate() 再从这个专属 queue 中不断取出结果，从而形成流式输出。

## 拉取结果 
1. 这里的 output_socket 是前端 AsyncMPClient 持有的 PULL 套接字，它与引擎端的 PUSH 套接字配对，用于接收 Engine 返回的推理结果。
2. 在协程 process_outputs_socket 中，这个 output_socket 会持续监听来自引擎端的推送消息。一旦收到数据，就立即调用 recv_multipart() 完成接收，并通过 decoder.decode(frames) 将消息帧反序列化为 EngineCoreOutputs。
3. 解码完成后，这些结果不会直接分发到各个请求队列中，而是会先放入 AsyncMPClient 的 output_queue。后续再由 AsyncLLM 后台的 output_handler 从 output_queue 中取出结果，并交给 OutputProcessor 做进一步处理和分发。
```python 
self.resources.output_socket = make_zmq_socket(
    self.ctx, output_address, zmq.PULL
)

async def process_outputs_socket():
    try:
        while True:
            # 1. 持续从 Engine 端拉取结果。
            # Engine 会把推理输出按 multipart message 的形式推送过来。
            frames = await output_socket.recv_multipart(copy=False)

            # 检查 Engine 是否仍然存活，必要时抛出异常。
            resources.validate_alive(frames)

            # 2. 将收到的消息帧反序列化为 EngineCoreOutputs 对象。
            outputs: EngineCoreOutputs = decoder.decode(frames)

            # 3. 放入 AsyncMPClient 的 output_queue。
            # 注意：这里还没有按 request_id 分发到各请求自己的 queue，
            # 只是先放入客户端的公共输出队列，等待后续 AsyncLLM 消费。
            if outputs.outputs or outputs.scheduler_stats:
                outputs_queue.put_nowait(outputs)

    except Exception as e:
        # 如果后台拉取结果时出现异常，也放入 output_queue，
        # 这样上层在消费 output_queue 时就能感知并处理错误。
        outputs_queue.put_nowait(e)
```


## 结果放入队列 
上一节中，把 Engine 的输出拉到 AsyncMPClient 公共的 output_queue 里，只完成了结果回传的第一步。接下来，还需要把这些公共结果进一步分发到各个请求自己的专属队列中。
1. AsyncLLM 后台的 output_handler 会持续调用 engine_core.get_output_async()，从 AsyncMPClient 的公共 output_queue 中取出新到达的 EngineCoreOutputs。
2. 取出的结果随后交给 output_processor.process_outputs() 处理。这个过程不仅会按 request_id 拆分不同请求的输出，还会完成 detokenize、停止条件判断等后处理逻辑。
目前为止的数据流是：
1. Engine
  -> PUSH 输出结果
2. AsyncMPClient
  -> AsyncMPClient.output_socket(PULL) 接收结果
  -> 反序列化为 EngineCoreOutputs
  -> 放入 AsyncMPClient 的公共 output_queue
  -> AsyncLLM.output_handler 调用 engine_core.get_output_async() 取出结果
  -> output_processor.process_outputs() 按 request_id 拆分，并完成 detokenize、停止条件判断等后处理

```python 
def _run_output_handler(self):
    """后台循环：持续从 EngineCore 拉取输出，并分发给各请求。"""

    engine_core = self.engine_core
    output_processor = self.output_processor

    async def output_handler():
        try:
            while True:
                # 1. 从 engine_core 拉取最新一批结果。
                # 从 AsyncMPClient的公共 output_queue 中取出一个 EngineCoreOutputs。
                outputs = await engine_core.get_output_async()

                # 当前这一批结果里包含多少条 request 输出
                num_outputs = len(outputs.outputs)

                # 如果开启了统计功能，则为这一轮结果处理准备统计对象
                iteration_stats = IterationStats() if (
                    log_stats and num_outputs) else None

                # 这里为了说明主流程，省略了真实代码中的分块逻辑；
                # 可以把它理解为"逐批处理本轮返回的所有输出"
                slices = (outputs.outputs, )

                for i, outputs_slice in enumerate(slices):
                    # 2. 对这一批 EngineCoreOutputs 做前端处理。
                    # process_outputs() 会完成几件事：
                    # - 按 request_id 区分不同请求的结果
                    # - 将新 token 做 detokenize
                    # - 判断是否触发 stop 条件
                    # - 将处理后的结果放入对应请求绑定的专属 queue 中
                    processed_outputs = output_processor.process_outputs(
                        outputs_slice, outputs.timestamp, iteration_stats)
```


在 process_outputs 里，入口参数 engine_core_output 就是刚从 Engine 拉到的最新一批输出，每条都带 req_id。函数只保留关键四步：
1. 从 AsyncMPClient 的公共 output_queue 取出 engine_core_output；
2. 用 req_id 到 OutputProcessor 的注册表里找到该请求的唯一队列；
3. 把原始输出进行解码并且封装成 RequestOutput；
4. 将解码后的结果塞进这条私有队列，等待客户端消费。

```python 
def process_outputs(
    self,
    engine_core_outputs: list[EngineCoreOutput],
    engine_core_timestamp: Optional[float] = None,
    iteration_stats: Optional[IterationStats] = None,
) -> OutputProcessorOutput:

    # 我们在这里只保留关键流程
    for engine_core_output in engine_core_outputs:
        # 找到唯一的队列
        req_id = engine_core_output.request_id
        req_state = self.request_states.get(req_id)
        # 解码输出的token_id
        stop_string = req_state.detokenizer.update(
                    new_token_ids, finish_reason == FinishReason.STOP)
        
        # 如果解码中包括了stop token就需要加上停止符号，用于控制客户端后续逇输出
        if stop_string:
            finish_reason = FinishReason.STOP
            stop_reason = stop_string
        
        if request_output := req_state.make_request_output(
                new_token_ids, pooling_output, finish_reason,
                kv_transfer_params, num_cached_tokens):
            if req_state.queue is not None:
                # 找到唯一的队列后放入当前解码后的输出
                req_state.queue.put(request_output)
```

# 流式返回 

在 AsyncLLM.generate 中，流式返回的核心机制可概括为“提交-等待-即时产出”三步：
1. 提交请求：add_request 为当前 request_id 创建专属的异步队列 q；
2. 等待就绪：循环执行 q.get_nowait() 或 await q.get() —— 当 output_handler 中的 process_outputs 将解码后的输出推入队列时，立即获取；
3. 即时产出：拿到一条 RequestOutput 就 yield 一条，不累积完整响应，实现真正的实时流式输出。

```python 
async def generate(
  self,
  prompt: PromptType,
  sampling_params: SamplingParams,
  request_id: str,
  lora_request: Optional[LoRARequest] = None,
  trace_headers: Optional[Mapping[str, str]] = None,
  priority: int = 0,
  data_parallel_rank: Optional[int] = None,
) -> AsyncGenerator[RequestOutput, None]:
  # 增加请求
  q = await self.add_request(
    request_id,
    prompt,
    sampling_params,
    lora_request=lora_request,
    trace_headers=trace_headers,
    priority=priority,
    data_parallel_rank=data_parallel_rank,
  )

  finished = False
  while not finished:
    # 等待队列就绪
    out = q.get_nowait() or await q.get()
    finished = out.finished
    # 每个请求对应的队列有数据立即返回
    yield out
```

```
┌────────────────────────────────────────────────────────────────────┐
│                         外部 HTTP Client                           │
│                  curl / 浏览器 / OpenAI SDK / 用户请求              │
└───────────────────────────────┬────────────────────────────────────┘
                                │ HTTP 请求
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│                         OpenAI API Server                          │
│                                                                    │
│  作用：                                                            │
│  1. 接收 HTTP 请求                                                  │
│  2. 解析 prompt、sampling_params、request_id                         │
│  3. 调用 AsyncLLM.generate() 或 AsyncLLM.add_request()               │
└───────────────────────────────┬────────────────────────────────────┘
                                │ 调用 AsyncLLM
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│                             AsyncLLM                               │
│                                                                    │
│  作用：请求生命周期管理层                                           │
│                                                                    │
│  1. 为每个 request 创建 RequestOutputCollector queue                 │
│  2. 调用 OutputProcessor.add_request() 注册 request_id → queue       │
│  3. 调用 self.engine_core.add_request_async(request)                 │
│  4. 后续从 queue 中不断 yield RequestOutput，实现流式返回             │
└───────────────────────────────┬────────────────────────────────────┘
                                │
                                │ self.engine_core
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│                  AsyncMPClient / EngineCoreClient                  │
│                                                                    │
│  作用：多进程通信客户端，负责 ZMQ 通信                              │
│                                                                    │
│  输入方向：                                                         │
│  - input_socket = ROUTER                                            │
│  - bind=True                                                        │
│  - send_multipart([engine_identity][ADD][request...])               │
│                                                                    │
│  输出方向：                                                         │
│  - output_socket = PULL                                             │
│  - 持续 recv_multipart() 接收 Engine 返回结果                       │
│  - decode 成 EngineCoreOutputs                                      │
│  - 放入 AsyncMPClient 公共 output_queue                             │
└───────────────┬───────────────────────────────────────▲────────────┘
                │                                       │
                │ ROUTER / DEALER 输入通道               │ PUSH / PULL 输出通道
                │                                       │
                ▼                                       │
┌────────────────────────────────────────────────────────────────────┐
│                           EngineProc                               │
│                                                                    │
│  一个单独的后端 Engine 进程                                         │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ process_input_sockets()                                     │   │
│  │                                                              │   │
│  │ input_socket = DEALER                                        │   │
│  │ bind=False                                                   │   │
│  │                                                              │   │
│  │ 1. 连接前端 ROUTER                                           │   │
│  │ 2. 先 send(b'') 完成 identity 注册                            │   │
│  │ 3. poller 监听输入 socket                                    │   │
│  │ 4. recv_multipart() 收到 [request_type][request_data...]      │   │
│  │ 5. MsgpackDecoder 解码                                       │   │
│  │ 6. self.input_queue.put_nowait((request_type, request))       │   │
│  └───────────────────────────┬──────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ EngineCore busy loop                                        │   │
│  │                                                              │   │
│  │ 1. _process_input_queue() 从 input_queue 取请求               │   │
│  │ 2. _handle_client_request() 处理 ADD / ABORT 等请求           │   │
│  │ 3. Scheduler 调度请求                                        │   │
│  │ 4. KV Cache Manager 管理 KV cache                            │   │
│  │ 5. Executor / Worker 执行模型 forward                         │   │
│  │ 6. 生成 EngineCoreOutputs                                    │   │
│  │ 7. 放入 self.output_queue                                    │   │
│  └───────────────────────────┬──────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ process_output_sockets()                                    │   │
│  │                                                              │   │
│  │ output_socket = PUSH                                         │   │
│  │                                                              │   │
│  │ 1. self.output_queue.get() 取 EngineCoreOutputs               │   │
│  │ 2. 根据 client_index 选择发给哪个前端 client                   │   │
│  │ 3. MsgpackEncoder 编码结果                                   │   │
│  │ 4. send_multipart(copy=False, track=True)                     │   │
│  │ 5. pending 保留 outputs 和 buffer，防止零拷贝数据提前释放       │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
``` 

