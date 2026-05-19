---
title: vLLM学习笔记-Worker/Executor详解及协作
date: 2026-05-18 09:39:11
tags:
- vLLM 
- AI_Infra  
categories:
- 学习笔记
---
客户端到 EngineProc 的方向：
- 客户端使用 ROUTER 套接字发送请求。
- EngineProc 使用 DEALER 套接字连接并接收请求。
- ROUTER/DEALER 组合适合“前端 client 与后端 engine 之间的异步通信”：前端可以根据DEALER 的 identity 将请求定向发给对应的 EngineProc，而 EngineProc 收到请求后再交给内部推理组件处理。
EngineProc 到客户端的方向：
- 当推理尚未结束、但已经产生部分 token 时，EngineProc 会先将部分结果放入输出队列。
- 输出线程不会等待整次生成完成，而是会立即把这部分结果通过 PUSH 套接字发送出去，实现流式返回。
- 客户端侧使用 PULL 套接字持续接收这些输出结果

# 总览
在推理架构中，EngineCoreProc这一层并不直接执行模型的前向计算。它更像一个总调度台，主要做三件事：
1. 接收来自前端的请求；
2. 维护调度逻辑——例如哪些请求该优先执行、哪些请求可以合并为一个 batch；
3. 调用 self.model_executor，把真正的执行任务交出去。
这里的 Executor 是执行管理层。它接到 EngineCoreProc 下发的任务后，不一定自己亲自计算，而是根据当前运行模式决定如何组织底层算力：
- 单进程模式：可能直接驱动一个本地 Worker；
- 多进程模式：可能把任务发给多个 Worker 进程；
- 分布式模式：还可能把任务分发到不同设备甚至不同机器上的工作单元。
而 Worker 才更接近真正干活的人。它通常负责：
- 持有模型权重；
- 管理本设备上的 KV cache；
- 调用模型执行前向计算；
- 返回本轮计算结果。

当 EngineCoreProc 执行 step() 时，会先对当前请求进行调度，生成本轮执行计划，然后通过 self.model_executor 将该执行计划交给 Executor，由后者组织后续的推理计算。

MultiprocExecutor通过主从进程结构实现高效的本地并行控制：主进程负责任务分发与协调，各个 Worker 子进程则绑定独立 GPU，它适用于单机多卡场景，执行具体的模型计算。这样的分层架构使得各组件职责清晰、解耦明确：**Engine 负责接口与调度，Executor 负责分布式执行管理，而最终的模型推理落在 Worker 上**。这不仅提升了系统可维护性，也为性能优化提供了灵活空间。

也就是说，MultiprocExecutor 通过控制进程 + 多个 Worker 进程的结构实现高效的本地并行执行。控制层负责任务分发、状态协调与结果汇总，各个 Worker 进程通常绑定独立 GPU，负责具体的模型计算，因此这种模式特别适合单机多卡场景。

# Worker组件介绍及初始化、执行 
在 vLLM 中，Worker 是负责实际模型执行的底层工作单元。不同 Executor 对 Worker 的创建与管理方式略有不同；例如在多进程模式下，Worker 通常运行在独立进程中。Worker 的核心职责主要包括：
1. 调用 execute_model 函数执行模型前向推理：接收调度器的输出（待处理的请求）SchedulerOutput、准备输入张量、执行模型前向传播、返回模型输出 ModelRunnerOutput 或中间张量（流水线并行）。
2. 调用 sample_tokens 从模型输出中采样 Tokens。
3. 调用 load_model 函数执行模型加载和管理。
4. 调用 initialize_cache 执行 KV Cache 管理。
5. 以及调用 add_lora、remove_lora、pin_lora 函数完成 LoRA 管理。

这里说一下lora是什么：在基础大模型不变的情况下，挂载一个小的适配器权重，让模型表现出某个微调版本的行为。
 
## Executor-Workers架构
Executor-Workers 关系如下:
- 一个 Executor 下管理着若干 workers，每个 workers 位于独立的进程上，可以简单理解成一个 worker 占据着一张卡；
- Executor 负责把请求 broadcast 到各个 workers 上；
- 各个 workers 接收到请求，负责执行实际的推理过程，并将推理结果返回给 Executor。

## Worker数量初始化 
world_size 表示一个 DP 组内（同一个模型副本）内的 Worker 数量，world_size 是根据并行策略（张量并行、流水线并行、上下文并行等）和 Executor 类计算得出的。
多节点环境中运行了多个数据并行（Data Parallel, DP）副本的情况下，Worker 总数（Total Workers） = world_size (TP * PP) * data_parallel_size (DP)。vLLM 最新版代码中，通过引入了 world_size_across_dp 属性，来真正表示集群中所有 Workers 的总数量！

### TP、PP、DP 
这是为了解决下面的问题：模型太大、请求太多、单张 GPU 扛不住，所以要把计算拆开或者复制。
> TP：一层太大，一张 GPU 算不动怎么办？
> PP：模型层数太多，整模型放不下一张 GPU 怎么办？
> DP：请求太多，一份模型处理不过来怎么办？

Transformer里面有很多大矩阵乘法，TP把同一层里面的大矩阵切开，分给多张 GPU 一起算。最后不同GPU算出结果后再进行归约 

一个 Transformer 模型通常有很多层，如果整模型太大，一张 GPU 放不下，PP可以把不同层放到不同 GPU 上。因为层是逐层传递的，这也是为什么它叫流水线并行。

DP 解决的是“请求太多、吞吐量不够”的问题。

1. 一个“模型并行组”（Model Parallel Group）内的 Worker 数量的计算，即 world_size 代码在 ParallelConfig.post_init 函数中实现，代码如下:

```python 
# vllm/vllm/config/parallel.py: __post_init__() 函数
# 基本计算公式
self.world_size = (
    self.pipeline_parallel_size           # 流水线并行大小
    * self.tensor_parallel_size           # 张量并行大小
    * self.prefill_context_parallel_size  # Prefill 上下文并行大小
)

# 如果使用 external_launcher，还需要乘以 data_parallel_size
if self.distributed_executor_backend == "external_launcher":
    logger.info("Using external launcher for distributed inference.")
    self.world_size *= self.data_parallel_size
```

> prefill_context_parallel_size (PCP): Prefill 上下文并行组数，默认值为 1


ParallelConfig 类中存在 world_size_across_dp 属性，用于计算包含数据并行在内的总进程数，公式如下:

```python 
world_size_across_dp = world_size × data_parallel_size
                     = (TP × PP × PCP) × DP
```

## Executor类中创建Worker 
vLLM 在 v1 架构中引入了多种 Executor 类型，用于管理 Worker 的创建和模型执行。这些 Executor 根据并行配置（如 tensor_parallel_size、pipeline_parallel_size 和 prefill_context_parallel_size）以及分布式后端（distributed_executor_backend）动态选择，以适应不同规模的部署场景，主要有 3 种 Executor:
1. 单进程（UniProcExecutor，用于单 GPU 或简单测试）
2. 多进程单节点（MultiprocExecutor，用于多 GPU 单机）
3. 分布式多节点（RayDistributedExecutor，用于跨节点扩展）。
Executor 的选择发生在引擎初始化阶段，通过 Executor.get_class(vllm_config) 方法确定：
1. 如果 distributed_executor_backend == "uni"，使用 UniProcExecutor（默认单 GPU）。
2. 如果 distributed_executor_backend == "mp"，使用 MultiprocExecutor（多 GPU 单节点）。
3. 如果 distributed_executor_backend == "ray"，使用 RayDistributedExecutor（多节点分布式）。
每个 Executor 负责创建和管理 Worker（通常是 GPUWorker），Worker 是实际执行模型计算的单元，每个 Worker 对应一个 GPU 或分片。总 Worker 数量（world_size）由 tp_size * pp_size * pcp_size 计算。

> 在实际部署中，vLLM 通过 --distributed-executor-backend CLI 参数选择后端（如 "mp" 或 "ray"）。

以 MultiprocExecutor 为例，描述 Worker 创建过程。MultiprocExecutor 用于单节点多 GPU 场景，利用 Python 的 multiprocessing（mp）启动独立进程，避免 Ray 的开销。Worker 创建发生在本地 world_size 内（本地可用 GPU 数），每个 Worker 进程通过 WorkerProc 包装启动，支持数据并行（DP）和 tensor/ pipeline 并行。
关键步骤：
1. 计算 world_size 并验证（tp * pp * pcp）。
2. 获取本地 world_size（本地 GPU 数）。
3. 为每个本地 rank 创建 UnreadyWorkerProcHandle（未就绪 Worker 句柄），通过 WorkerProc.make_worker_process 启动进程。
4. 进程启动后，进入就绪状态，执行 Worker 初始化（init_device、load_model 等）。
5. 支持终止等待（wait_for_termination），确保进程安全退出。

WorkerProc：因为Worker只关心模型执行，但是一个独立子进程还需要处理很多“进程生命周期问题”，所以
WorkerProc ：
  - 管进程启动
  - 管消息通信
  - 管生命周期
  - 管异常和退出
  - 内部真正持有 Worker

```python 
from dataclasses import dataclass
from multiprocessing import Process, Queue
# ... 其他导入

@dataclass
class UnreadyWorkerProcHandle:
    """WorkerProcess handle before READY."""
    proc: Process
    # ... 其他字段如 request_mq, response_mq

class MultiprocExecutor(Executor):
    def __init__(self, vllm_config: VllmConfig, ...):
        # 初始化配置
        self.vllm_config = vllm_config
        self.parallel_config = vllm_config.parallel_config
        self._init_executor()

    def _init_executor(self) -> None:
        # 获取并验证 world_size
        self.world_size = self.parallel_config.world_size
        tp_size = self.parallel_config.tensor_parallel_size
        pp_size = self.parallel_config.pipeline_parallel_size
        pcp_size = self.parallel_config.prefill_context_parallel_size
        assert self.world_size == tp_size * pp_size * pcp_size, (
            f"world_size ({self.world_size}) must be equal to "
            f"tens or_parallel_size ({tp_size}) x pipeline_parallel_size ({pp_size}) "
            f"x prefill_context_parallel_size ({pcp_size})."
        )

        # 获取本地 worker 数量
        self.local_world_size = self.parallel_config.local_world_size

        # 创建 workers（使用列表存储 UnreadyWorkerProcHandle）
        unready_workers = []
        global_start_rank = self.local_world_size * self.parallel_config.node_rank_within_dp
        distributed_init_method = get_distributed_init_method(...)  # 如 TCP URI

        for local_rank in range(self.local_world_size):
            global_rank = global_start_rank + local_rank
            unready_workers.append(
                WorkerProc.make_worker_process(
                    vllm_config=self.vllm_config,
                    local_rank=local_rank,
                    rank=global_rank,
                    distributed_init_method=distributed_init_method,
                    # 其他参数如 queues for IPC、model_config 等
                )
            )

        # 等待 workers 就绪（例如通过 polling queues）
        self.workers = []  # 最终就绪 workers 列表
        for handle in unready_workers:
            # 处理就绪信号，转换为 WorkerProc
            worker = WorkerProc.from_handle(handle)
            self.workers.append(worker)

        # 初始化模型到 workers
        self.init_model(...)
```
## Worker初始化流程
在 vLLM v1 中，Worker（通常指 GPUWorker）的初始化发生在 ModelExecutor 的构建过程中，无论是单 GPU 的 UniProcExecutor 还是多 GPU 的 MultiProcExecutor，每个 Worker 进程都会独立执行相同的初始化步骤。这些步骤确保 Worker 准备好设备、模型和 KV 缓存，以支持高效的 LLM 推理。
Worker 初始化主要分为三个核心阶段：Init Device、Load Model 和 Initialize KV Cache。
1. Init Device（初始化设备）
  - 初始化当前 Worker 的设备环境与分布式上下文，包括数据并行（DP）、张量并行（TP）、流水线并行（PP）和专家并行（EP）等相关配置与通信组。
  - 实例化 model_runner，用于管理模型执行流程，包括采样器、KV 缓存访问以及前向传播所需的 GPU 侧缓冲区（如 input_ids、positions）。
  - 实例化 InputBatch，用于管理批处理输入状态，包括 CPU 侧前向传播缓冲区、KV 缓存块表以及采样元数据等。
2. Load Model（加载模型）
  - 实例化模型结构。（Qwen、Llama、Mistral）
  - 加载模型权重，并按并行策略完成参数切分与设备放置。
  - 调用 model.eval() 将模型切换到 PyTorch 的推理模式。
  - 可选地调用 torch.compile() 对模型执行图进行优化，以提升后续推理性能。torch.compile() 可以把 PyTorch 的动态图执行优化成更高效的图执行形式。
3. Initialize KV Cache（初始化 KV 缓存）
  - 调用 get_kv_cache_spec 确定各层 KV Cache 的规格。
  - 通过 dummy run 或 profiling 前向传播估算可用显存，并据此计算可容纳的 KV cache block 数量。vLLM 不是按“每个请求一整块连续 cache”来管理，而是使用 block 方式管理。
  - 分配、reshape 并将 KV cache tensor 绑定到各注意力层。
  - 准备注意力相关元数据与后端配置（例如 FlashAttention），供后续前向传播内核使用。
  - 除非显式指定 --enforce-eager，否则还会执行 warmup 批次，并为常见批次形状捕获 CUDA graphs，以减少 kernel launch 开销、降低首轮抖动并优化推理延迟。

model_runner: 准备 input_ids,准备 positions,准备 attention metadata,访问 KV Cache,执行模型 forward,处理 logits,调用采样器,管理 CUDA graph.

InputBatch：CPU 侧输入缓冲区，请求到 batch slot 的映射，KV cache block table，采样相关 metadata，每个请求的 token 状态

KV Cache：
> prefill 阶段：一次性处理 prompt，把 prompt 的 K/V 写入 cache
> decode 阶段：  每次只处理新 token  复用之前 prompt 和历史 token 的 K/V

在 MultiprocExecutor 中，上述初始化步骤会在每个 Worker 进程内独立执行。Executor 会为每个 rank 启动对应的子进程（通常通过 WorkerProc.make_worker_process），每个子进程随后进入 WorkerProc.worker_main，完成设备、模型以及 KV Cache 等初始化流程。
初始化结束后，Worker 进程不会退出，而是进入持续运行的 busy loop，等待来自 Executor 的任务下发，并在收到工作项后执行相应的推理或控制逻辑。

```txt 
1. WorkerWrapperBase.__init__()
   └─> 创建 WorkerWrapper，但尚未创建实际的 Worker

2. WorkerWrapperBase.init_worker()
   ├─> 加载插件
   ├─> 解析 worker 类名
   ├─> 动态继承 worker_extension_cls（如果存在）
   └─> 创建 Worker 实例 (WorkerBase.__init__)3. WorkerWrapperBase.init_device()
   └─> Worker.init_device()
       ├─> 设置 CUDA 设备
       ├─> 初始化分布式环境 (NCCL)
       ├─> 设置随机种子
       ├─> 创建内存快照
       └─> 创建 ModelRunner

4. WorkerWrapperBase.load_model()
   └─> Worker.load_model()
       └─> ModelRunner.load_model()
           └─> 加载模型权重到 GPU

5. WorkerWrapperBase.initialize_from_config()
   └─> Worker.initialize_from_config()
       └─> ModelRunner.initialize_kv_cache()
           └─> 初始化 KV cache

6. WorkerWrapperBase.compile_or_warm_up_model()
   └─> Worker.compile_or_warm_up_model()
       ├─> 模型预热（dummy run）
       ├─> 内核预热
       └─> CUDA Graph 捕获（如果启用）
```


#  Executor 和 Worker 组件通信 Demo-RPC 过程
Executor 与 Worker 之间的协作，本质上可以理解为一种类 RPC 的进程间调用机制（vLLM 源码中正是将其核心方法命名为 collective_rpc）。Executor 负责发送待执行的方法名及其参数，Worker 负责在自身进程中接收请求、执行对应逻辑，并将执行结果返回给 Executor。在这个抽象下，Executor 相当于调用方，Worker 相当于服务端。
在 Demo 中，我们分别启动多个独立进程来模拟 Executor 和 Worker（Executor 运行在引擎主进程中，每个 Worker 各占一个独立子进程）。它们之间通过队列进行通信：Executor 通过一个共享的广播队列向所有 Worker 统一下发命令（所有 Worker 收到相同内容），Worker 在执行完成后，再通过各自独立的结果队列将返回值传回 Executor。
由于 Executor 与 Worker 通常是一对多关系，请求下发采用广播方式，保证所有 Worker 拿到一致的任务；而每个 Worker 拥有独立的结果返回通道，以保证结果回收和状态管理彼此隔离、不发生混淆。

```python 
import multiprocessing as mp
import time
import random
import os

def dummy_execute_model(args):
    """模拟 execute_model 计算"""
    scheduler_output, = args
    time.sleep(random.uniform(0.2, 0.5))
    return f"logits_from_rank{os.getpid()}_{scheduler_output}"

def worker(rank: int, work_q: mp.Queue, result_q: mp.Queue):
    pid = os.getpid()
    print(f"[Worker {rank}] 启动，pid={pid}")

    # 1. 握手
    result_q.put("READY")

    # 2. 映射方法名 → 本地可调用对象
    method_table = {
        "execute_model": dummy_execute_model,
    }

    # 3. 主循环
    while True:
        item = work_q.get()
        if item is None:                     
            result_q.put(None)
            break
        method_name, args, kwargs = item
        func = method_table[method_name]
        print(f"[Worker {rank}] 执行 {method_name}{args}")
        output = func(args, **(kwargs or {}))
        result_q.put(output)

def master(num_workers: int = 2):
    print("=== Master 启动 ===")
    work_q = mp.Queue()
    result_queues = [mp.Queue() for _ in range(num_workers)]
    procs = [mp.Process(target=worker, args=(rank, work_q, result_queues[rank]))
             for rank in range(num_workers)]
    for p in procs:
        p.start()

    # 等待 READY
    while sum(rq.get() == "READY" for rq in result_queues) < num_workers:
        pass
    print(">>> 所有 Worker 就绪 <<<")

    # 下发 RPC 调用
    calls = [
        ("execute_model", ("scheduler_output_0",), {}),
        ("execute_model", ("scheduler_output_1",), {}),
        ("execute_model", ("scheduler_output_2",), {}),
    ]
    for call in calls * num_workers:        # 让每个 Worker 都执行一遍
        work_q.put(call)

    # 发结束信号
    for _ in range(num_workers):
        work_q.put(None)

    # 收集结果
    results = {rank: [] for rank in range(num_workers)}
    finished = 0
    while finished < num_workers:
        for rank, rq in enumerate(result_queues):
            if not rq.empty():
                item = rq.get()
                if item is None:
                    finished += 1
                else:
                    results[rank].append(item)
    for p in procs:
        p.join()
    print("=== 最终结果汇总 ===")
    for rank, outs in results.items():
        print(f"Worker {rank}: {outs}")

if __name__ == "__main__":
    mp.set_start_method("spawn", force=True)
    master(num_workers=2)
```

1. 首先是Executor与两个Worker分别建立连接，连接确立的方式是：Worker通过通信队列向Executor发送一个"Ready"字符串，表示自身已就绪。在Executor端，会等待来自两个Worker的"Ready"信号，当收到两个"Ready"消息后，即判定两个Worker均已就绪。
2. 当Executor成功接收到来自两个Worker的“Ready”信号，确认两者均已就绪后，即可向它们发送执行指令，指令中包含待执行的方法及其相关参数。
3. 当 Worker 从广播队列中接收到 Executor 下发的方法名及参数后，便开始执行指定方法，并获取执行结果。
4. 当指定方法执行完毕后，Worker 将结果通过自身专属的结果队列返回给 Executor。

总结一下，Executor 与各 Worker 分别建立连接。连接确立的方式为：Worker 在完成自身初始化（包括消息队列的创建）后，通过一个通信管道向 Executor 发送就绪消息。消息内容除 "READY" 状态标记外，还附带该 Worker 结果回传队列的句柄（handle），供 Executor 后续收集结果时使用。
在 Executor 端，会等待来自两个 Worker 的就绪消息；收齐后，双方还需分别在各自的消息队列上调用 wait_until_ready()，完成底层 ZMQ socket 的连接配对。至此才判定两个 Worker 均已就绪，Worker 随即进入 busy loop，等待 Executor 下发 RPC 命令。

#  Executor 和 Worker 组件的协作

## MultiprocExecutor工作流程 
### 获取Executor类 
```python 
ParallelConfig(
    # ========================
    # 并行策略配置
    # ========================
    pipeline_parallel_size=1,           # 流水线并行度（默认：1）
    tensor_parallel_size=2,             # 张量并行度（默认：1），现在配置的是tp=2
    data_parallel_size=1,               # 数据并行度（总节点数）
    data_parallel_size_local=1,         # 当前节点内数据并行度
    data_parallel_rank=0,               # 当前节点在全局数据并行中的排名
    data_parallel_rank_local=0,         # 当前节点内数据并行排名

    # ========================
    # 数据并行通信配置
    # ========================
    data_parallel_master_ip='127.0.0.1',  # 数据并行主节点地址
    data_parallel_rpc_port=29550,         # RPC 通信端口（用于进程间通信）
    data_parallel_master_port=0,          # 主节点监听端口（0 表示自动分配）
    data_parallel_backend='mp',           # 数据并行后端（如 'mp' 表示 multiprocessing）
    data_parallel_external_lb=False,      # 是否启用外部负载均衡
    data_parallel_hybrid_lb=False,        # 是否启用混合负载均衡

    # ========================
    # 专家并行（MoE）相关配置
    # ========================
    enable_expert_parallel=False,         # 启用专家并行（MoE）
    enable_eplb=False,                    # 启用专家负载均衡（Expert Load Balancing）
    num_redundant_experts=0,              # 冗余专家数量（用于容错）
    eplb_window_size=1000,                # EPLB 负载均衡窗口大小（样本数）
    eplb_step_interval=3000,              # EPLB 步骤间隔（处理步数）
    eplb_log_balancedness=False,          # 是否记录负载均衡状态

    # ========================
    # 资源与性能优化
    # ========================
    max_parallel_loading_workers=None,    # 最大并行模型加载工作线程数（默认为系统自动）
    disable_custom_all_reduce=False,      # 是否禁用自定义 AllReduce 实现（使用原生 PyTorch）

    # ========================
    # Ray 与分布式运行环境
    # ========================
    ray_workers_use_nsight=False,         # 是否对 Ray worker 使用 Nsight 进行性能分析
    ray_runtime_env=None,                 # Ray 运行时环境（如容器镜像、依赖包等）
    placement_group=None,                 # Ray Placement Group 配置（用于资源调度）

    # ========================
    # 执行器与工作节点配置
    # ========================
    distributed_executor_backend='mp',    # 分布式执行后端（'mp' = multiprocessing）
    worker_cls='vllm.v1.worker.gpu_worker.Worker',  # 工作节点类（GPU Worker）
    sd_worker_cls='auto',                 # 模型存储/加载专用工作节点类（自动选择）
    worker_extension_cls='',              # 工作节点扩展类（可选插件）

    # ========================
    # 全局并行规模信息
    # ========================
    world_size=2,                         # 总共参与并行的进程数（tensor_parallel_size × data_parallel_size）
    rank=0,                               # 当前进程的全局排名（从 0 开始）
    enable_multimodal_encoder_data_parallel=False,  # 是否开启多模态编码器的数据并行支持
)

```
MultiprocExecutor 会根据并行配置创建对应数量的 Worker 实例。以 TP=2 为例，Executor 创建两个 Worker 进程，每个 Worker 独占一张 GPU。Executor 与 Worker 之间通过 collective RPC 机制进行任务分发和结果回收，本质上是 Executor 广播方法名 + 参数，Worker 执行后通过独立通道返回结果。具体分工如下：
- Worker 负责持有模型权重的分片（TP=2 时，每个 Worker 持有每层权重的一半分片，而非模型的部分层），接收 Executor 统一下发的执行请求，运行前向传播，并通过 NCCL 在层内自动同步中间结果。Worker 在初始化时根据分配的 local_rank 绑定对应 GPU，根据 rank 加入 NCCL 通信组。
- Executor 接收 EngineCore 的调度输出（SchedulerOutput），通过共享内存广播队列统一下发给所有 Worker，并收集返回的推理结果。
每个 Worker 启动后会进入 worker_busy_loop，持续监听广播队列并执行推理，直到收到终止信号。以此处为例，Worker 在 worker_busy_loop 中收到了 Executor 下发的 method 调用。

NCCL负责在Worker之间通信

在 TP=2 的单机多 GPU 场景下，MultiprocExecutor 会启动两个 Worker 子进程，每个 Worker 绑定一张 GPU，并持有模型每一层权重的一半分片。Executor 从 EngineCore 拿到 SchedulerOutput 后，通过 collective RPC 把“方法名 + 参数”广播给所有 Worker；Worker 在 worker_busy_loop 中监听到命令后执行对应方法，并在前向传播过程中通过 NCCL 与另一个 Worker 同步张量结果，最后通过各自的结果通道把执行状态或结果返回给 Executor。

### 对 Executor 中通信队列的初始化
Executor.get_class 会获取到 executor 的具体实现类，并将其保存在 AsyncLLM 类的 executor_class 属性中。在 AsyncLLM 的 init 方法里，AsyncLLM 自身并不实例化 Executor，它只是将这个类传递给 EngineCoreClient.make_async_mp_client。随后，在 EngineCore 后台进程启动时，Executor 实例化会发生在 EngineCore 后台进程内部，而非 AsyncLLM.init 中。

注意：Executor.get_class() 返回的是一个类，不是实例。真正的实例化发生在更深的调用链中：
AsyncLLM.__init__ → EngineCoreClient.make_async_mp_client() → launch_core_engines() → EngineCoreProc.__init__ → executor_class(vllm_config)。
也就是说，Executor 实例最终在引擎进程内部完成创建，而不是在 from_vllm_config 或 AsyncLLM 初始化的调用栈里直接实例化。

#### rpc_broadcast_mq 通信队列


在 Executor 的初始化过程中，最关键的步骤是建立与 Worker 之间的通信机制。Executor 与多个 Worker 之间是一对多的关系，通过两类消息队列进行数据和指令的传输：
1. 一类是 rpc_broadcast_mq，由 Executor 与所有 Worker 共享，负责统一下发命令；
2. 另一类是 worker_response_mq，每个 Worker 各自持有独立的一个实例（而非所有 Worker 共用一个），负责将本 Worker 的执行结果单独回传给 Executor。
因此，队列总数为 1 + N（N 为 Worker 数量），例如 TP=2 时共有 3 个队列：1 个广播队列和 2 个结果回传队列。

rpc_broadcast_mq 是 Executor 向所有 Worker 统一下发任务的唯一广播通道。Executor 将方法名及参数写入该队列，每个 Worker 被动监听，从中取出相同的任务数据。在张量并行场景下，所有 Worker 需要完全一致的 SchedulerOutput，因此广播只需一次，所有 Worker 同时收到，无需逐一点对点分发。
该队列内部采用共享内存 + ZMQ PUB/SUB 两层混合架构（distributed/device_communicators/shm_broadcast.py）：
- 小数据（方法名、调度元数据等）走共享内存环形缓冲区 ShmRingBuffer，Writer 写入后多个 Reader 各自偏移读取，避免进程间数据复制，实现零拷贝。
- 大数据（如结构化输出的 grammar bitmask 张量、KV connector 元数据等）走 ZMQ 的 XPUB/XSUB 模式——Writer 将数据发布到 XPUB 套接字，Worker 通过 XSUB 套接字订阅接收。对于跨节点 Worker，这部分走 TCP PUB/SUB。XPUB / XSUB 是更底层、更可扩展的 PUB/SUB 代理模式。XPUB 是增强版 Publisher。它不仅能发布消息，还能收到订阅者发来的订阅/取消订阅事件
以上的Writer也就是Executor。综上，Executor 只需一次写入，所有 Worker——无论本地还是远程——统一从同一个 rpc_broadcast_mq 获取相同指令，结构清晰且高效。

rpc_broadcast_mq 在 Executor 初始化过程中被创建，其中一个关键参数是 max_chunk_bytes。在 MultiprocExecutor 中，该值取自环境变量 VLLM_MQ_MAX_CHUNK_BYTES_MB（默认 16 MB），并传递给 MessageQueue 构造函数。
1. max_chunk_bytes 用于控制进程间通信的数据传输方式：当序列化后的数据总大小小于 max_chunk_bytes 时，通过共享内存环形缓冲区（ShmRingBuffer）直接传输，实现零拷贝；
2. 当数据总大小达到或超过 max_chunk_bytes 时，共享内存仅写入一个溢出标记（overflow flag = 1），实际数据改由 rpc_broadcast_mq 关联的 ZMQ XPUB/SUB 套接字进行传输，以避免共享内存预分配过大。

因此，MessageQueue 采用两种通信方式：
- 小数据通过共享内存（SHM）传输，高效且零拷贝；
- 大数据则使用 ZeroMQ 套接字传输。
传递参数和方法在压缩后占用的字节数来区分的。
在 MessageQueue 的初始化阶段，self.buffer 对应共享内存通道 ShmRingBuffer，self.local_socket 对应 ZeroMQ 通道 XPUB。为了让 Executor 感知各个 Worker 是否已完成连接，此处将 XPUB_VERBOSE 设为 True。启用后，每次有新的订阅者接入并发起订阅时，XPUB 会向上层暴露一条订阅通知消息。
每个 Worker 在连接并完成订阅后，都会各自产生一条这样的通知。Executor 在 wait_until_ready() 中通过 self.local_socket.recv() 逐条接收这些通知；当预期数量的通知全部收齐后，即可认为所有 Worker 均已上线。
借助这一机制，Executor 能够在真正开始广播之前确认所有 Worker 已准备就绪，从而保证后续广播发布语义的可靠性

```python 
# 代码有删减，只保留关键的部分
class MessageQueue:
    def __init__(
        self,
        n_reader,  # number of all readers
        n_local_reader,  # number of local readers through shared memory
        local_reader_ranks: Optional[list[int]] = None,
        max_chunk_bytes: int = 1024 * 1024 * 10,
        max_chunks: int = 10,
        connect_ip: Optional[str] = None,
    ):

        if n_local_reader > 0:
            # 初始化共享内存
            self.buffer = ShmRingBuffer(n_local_reader, max_chunk_bytes,
                                        max_chunks)
            # 初始化套接字
            self.local_socket = context.socket(XPUB)
            # XPUB_VERBOSE 使 XPUB 在每次有新的订阅者连入时，                     
            # 都接收一条订阅通知（而非仅第一条），便于 wait_until_ready 计数
            self.local_socket.setsockopt(XPUB_VERBOSE, True)
            local_subscribe_addr = get_open_zmq_ipc_path()
            self.local_socket.bind(local_subscribe_addr)
```

在 MultiprocExecutor 中，rpc_broadcast_mq 被初始化为 Executor 向所有 Worker 统一下发调度请求和执行数据的广播通道，其内部根据 payload 大小自动选择通信路径：小于 max_chunk_bytes 走共享内存环形缓冲区，否则走 ZMQ 套接字。
#### workerProc 连接 rpc_broadcast_mq 通信队列

此前我们已在 Executor 中创建了 rpc_broadcast_mq，其内部持有共享内存区域和 ZMQ XPUB 套接字。接下来需要让两个 Worker 连接到同一个队列。
由于 rpc_broadcast_mq 内部包含不可直接跨进程传递的资源（共享内存文件描述符、套接字地址等），Executor 通过 export_handle() 将这些连接信息导出为一个可序列化的 Handle 对象（shm_broadcast.py:263-269）：

Handle 是一个数据容器，包含以下连接元数据：
| 字段 | 含义 | 
|---| ---| 
|buffer_handle|共享内存区域的标识（供 ShmRingBuffer 重建）|
|local_subscribe_addr|ZMQ XPUB 的 IPC 地址（本地 Reader 连接用）|
|remote_subscribe_addr|ZMQ XPUB 的 TCP 地址（远端 Reader 连接用）|
|local_reader_ranks|哪些 rank 是本地 Reader|

之后 scheduler_output_handle 被传入每个 Worker 的实例化过程（make_worker_process → WorkerProc.__init__），Worker 在内部调用 MessageQueue.create_from_handle(handle, rank) 重建 Reader 端的 rpc_broadcast_mq，从而与 Executor 的 Writer 端建立完整的广播通道。

```python 
class MultiprocExecutor(Executor):
  def _init_executor(self) -> None:

    self.rpc_broadcast_mq = MessageQueue(self.world_size,
                                         self.world_size,
                                         max_chunk_bytes=max_chunk_bytes)    
    # 将self.rpc_broadcast_mq作为句柄传递给worker进程，用于为worker进程打开通信队列
    scheduler_output_handle = self.rpc_broadcast_mq.export_handle()
    for rank in range(self.world_size):
      unready_workers.append(
        WorkerProc.make_worker_process(
          vllm_config=self.vllm_config,
          local_rank=rank,
          rank=rank,
          distributed_init_method=distributed_init_method,
          input_shm_handle=scheduler_output_handle,
        ))
```

通过初始化流程，Worker 在 WorkerProc.__init__ 中才真正连接 rpc_broadcast_mq 所传递的共享内存和套接字。
从第9行开始，Worker 依次：
1. 根据 handle 中的 buffer_handle 重建共享内存 ShmRingBuffer，成为本地 Reader；
2. 创建 ZMQ SUB 套接字，设置 SUBSCRIBE 为空字符串（订阅所有消息），连接到 handle 中的 local_subscribe_addr。
Executor 侧持有一个 XPUB 套接字并设置了 XPUB_VERBOSE，因此每个 Worker 连接并订阅后，Executor 会收到一条对应的订阅通知。在后续的 wait_until_ready() 调用中，Executor 先循环收取所有本地和远端 Reader 的订阅通知，收齐后才向所有已连接的 Worker 统一回发 b"READY" 消息，验证 PUB-SUB 通道双向畅通。
对应的各个 Worker 此时正阻塞在 self.local_socket.recv() 上等待这条 READY，一旦收到即可确认通信双方均已就绪，握手完成。

### 通过 rpc_broadcast_mq 通信队列传递命令

在 TP=2 的设置下，一个 Executor 对应两个 Worker，并通过 rpc_broadcast_mq 向它们统一下发任务。以 execute_model 为例，Executor 分发调度请求的流程如下：
1. 调用 collective_rpc 向所有 Worker 发起远程执行请求：
```python 
# multiproc_executor.py:254-264
def execute_model(self, scheduler_output, non_block=False):
    return self.collective_rpc(
        "execute_model",                           # 方法名
        args=(scheduler_output,),                  # 参数：本次调度结果
        unique_reply_rank=self.output_rank,        # 只等这个 rank 的回复
        non_block=non_block,
        timeout=envs.VLLM_EXECUTE_MODEL_TIMEOUT_SECONDS,
    )
```
- method："execute_model"，Worker 在 busy loop 中通过 getattr(self.worker, method) 查表执行。
- args：传入 scheduler_output，即 Scheduler 产出的本轮调度请求序列。
- unique_reply_rank：**指定只需等待哪一个 Worker 返回结果。值为 world_size - tp_size（最后一个 PP stage 的第一个 TP rank）。TP=2 且无 PP 时恰好为 0，这是因为在 TP 模式下，每层 linear 内部已经通过 NCCL all-reduce 同步了中间结果，所有 TP rank 产出的 logits 是完全一致的，无需额外的 AllReduce 或 Gather。unique_reply_rank 只是挑任意一个持有完整结果的 Worker 回传，避免重复接收 N 份相同数据。**
2. collective_rpc 内部将 (method, args, kwargs, output_rank) 写入已初始化的 self.rpc_broadcast_mq，广播到所有 Worker。
3. 每个 Worker 在 worker_busy_loop 中从同一队列取出相同的任务，各自执行 self.worker.execute_model(scheduler_output)，但只有 rank == output_rank 的那个 Worker 将结果写回 response_mq 返回给 Executor。
```python 
# 代码有删减
def collective_rpc(self,
                   method: Union[str, Callable],
                   timeout: Optional[float] = None,
                   args: tuple = (),
                   kwargs: Optional[dict] = None,
                   non_block: bool = False,
                   unique_reply_rank: Optional[int] = None) -> list[Any]:

  deadline = None if timeout is None else time.monotonic() + timeout
  kwargs = kwargs or {}

  # 需要执行的方法
  send_method = method
  
  # 向self.rpc_broadcast_mq传递
  self.rpc_broadcast_mq.enqueue(
    (send_method, args, kwargs, unique_reply_rank))
  
  # 等待worker的返回
  workers = (self.workers[unique_reply_rank],
            ) if unique_reply_rank is not None else self.workers
  responses = []


def execute_model(
  self,
  scheduler_output,
) -> Union[ModelRunnerOutput, Future[ModelRunnerOutput]]:
  ...
  ...
  (output, ) = self.collective_rpc(
    "execute_model",
    args=(scheduler_output, ),
    unique_reply_rank=self.output_rank,
    non_block=non_block,
    timeout=envs.VLLM_EXECUTE_MODEL_TIMEOUT_SECONDS)
  return output

```
通过 self.rpc_broadcast_mq.enqueue，Executor 将 (方法名, 参数, kwargs, output_rank) 四元组广播给所有 Worker。enqueue 内部根据数据量选择通信路径（shm_broadcast.py）：
- 数据序列化后，若 total_bytes + serialized_size < self.buffer.max_chunk_bytes，走共享内存。缓冲区的首字节写入 0，后续字节写入 buffer 数量及实际载荷。
- 若超出阈值，则走 ZMQ 套接字。此时共享内存缓冲区的首字节写入 1（溢出标记），实际数据通过 self.local_socket.send_multipart() 走 XPUB 发送。
Worker 在 dequeue 时先读取首字节：0 表示数据在共享内存中直接解析，1 表示数据已溢出至 ZMQ 通道，需从套接字接收。
```python 
class MessageQueue:
    def enqueue(self, obj, timeout: Optional[float] = None):
        """ Write to message queue with optional timeout (in seconds) """
        assert self._is_writer, "Only writers can enqueue"
        serialized_obj = pickle.dumps(obj, protocol=pickle.HIGHEST_PROTOCOL)
        if self.n_local_reader > 0:
            if len(serialized_obj) >= self.buffer.max_chunk_bytes:
                with self.acquire_write(timeout) as buf:
                    buf[0] = 1  # overflow
                self.local_socket.send(serialized_obj)
            else:
                with self.acquire_write(timeout) as buf:
                    buf[0] = 0  # not overflow
                    buf[1:len(serialized_obj) + 1] = serialized_obj
        if self.n_remote_reader > 0:
            self.remote_socket.send(serialized_obj)
```

## Worker 工作流程
### 接受指令并执行 
Worker 进程初始化完成后，不仅连接了来自 Executor的rpc_broadcast_mq消息队列，还会启动 worker_busy_loop，持续监听并处理 Executor 发来的指令。我们来看worker_busy_loop的实现：它通过循环调用 dequeue() 从 rpc_broadcast_mq 中读取命令和参数，这正是之前 enqueue 操作的逆过程。取出数据后，根据缓冲区首字节判断传输方式：
1. 若 buf[0] == 0：表示数据通过共享内存发送，直接对 buf[1:] 进行反序列化，还原出方法名和参数；
2. 若 buf[0] == 1：表示数据过大，通过 ZeroMQ 套接字发送，需调用 ZMQ 接收接口获取完整数据。
本地 Reader（与 Executor 同节点，_is_local_reader = True）：
1. 从共享内存缓冲区中读取首字节 buf[0] 判断传输方式：
  - buf[0] == 0：数据在共享内存中。缓冲区格式为：[0] [2字节: buffer数量] [4字节: buffer 0长度] [buffer 0数据] [4字节: buffer 1长度] [buffer 1数据] ...
  - 按此结构解析出 all_buffers，再通过 pickle.loads(all_buffers[0], buffers=all_buffers[1:]) 反序列化还原出完整的 Python 对象。
  - buf[0] == 1：数据溢出至 ZMQ 通道。调用 self.local_socket.recv_multipart() 从 SUB 套接字接收，同样用 pickle.loads 还原。
2. 远端 Reader（跨节点，_is_remote_reader = True）：远端 Worker 没有共享内存通道，所有数据始终通过 self.remote_socket.recv_multipart() 走 TCP PUB/SUB 接收，无需判断首字节。

```python 
# 篇幅原因，代码有删改
class MessageQueue:
    def dequeue(self,
            timeout: Optional[float] = None,
            cancel: Optional[Event] = None):
    """ Read from message queue with optional timeout (in seconds) """
    if self._is_local_reader:
        with self.acquire_read(timeout, cancel) as buf:
            overflow = buf[0] == 1
            if not overflow:
                obj = pickle.loads(buf[1:])
        if overflow:
                obj = MessageQueue.recv(self.local_socket, timeout)
                    
class WorkerProc:   
    def worker_busy_loop(self):
            """Main busy loop for Multiprocessing Workers"""
            while True:
                # 读取来自队列中的方法和参数
                method, args, kwargs, output_rank = self.rpc_broadcast_mq.dequeue()
                func = getattr(self.worker, method)
                # 执行
                output = func(*args, **kwargs)
```

### Worker与Executor建立连接

每个 Worker 都有一个 self.worker_response_mq 消息队列，用于将推理结果返回给 Executor。如注释所示：
- self.rpc_broadcast_mq：接收来自 Executor 的调度请求；
- self.worker_response_mq：回传执行结果。
两者的初始化方式不同：
1. self.rpc_broadcast_mq 通过 Executor 传递的句柄（包含套接字地址或共享内存）创建，直接连接已存在的通信通道；
2. self.worker_response_mq 由 Worker 在本地新建套接字和共享内存，并将其句柄返回给 Executor，供其连接和监听。Executor 侧用这个句柄重建 Reader 端，加入 response_mqs，后续在 collective_rpc 中从对应 rank 的 response_mq 读取结果。

```python 
class WorkerProc:
    """Wrapper that runs one Worker in a separate process."""

    READY_STR = "READY"

    def __init__(
        self,
        vllm_config: VllmConfig,
        local_rank: int,
        rank: int,
        distributed_init_method: str,
        input_shm_handle: Handle,
    ):

        # Initialize MessageQueue for receiving SchedulerOutput
        self.rpc_broadcast_mq = MessageQueue.create_from_handle(
            input_shm_handle, self.worker.rank)

        # Initializes a message queue for sending the model output
        self.worker_response_mq = MessageQueue(1, 1)
```
在上述流程中，rpc_broadcast_mq 用于 Executor 向 Worker 发送方法和参数。与此同时，Worker 也通过 worker_response_mq 向 Executor 回传执行结果。worker_response_mq通道的建立同样需要双向握手：
- Worker 创建 worker_response_mq 并将其句柄通过create_from_handle方法返回给 Executor；
- Executor 在调用create_from_handle获取worker_response_mq时会连接该队列，并自动发送 ZMQ 订阅消息（触发 XPUB 事件）；
- Worker 在 wait_until_ready() 中检测到订阅后，向 Executor 发送 "READY" 消息；
- Executor 收到 "READY" 后，确认通道建立。
这一过程需两端协同完成，类似于 TCP 三次握手，确保通信可靠，具体表现为：
1. Executor（读端）：调用 wait_until_ready()，等待接收来自 Worker 的 "READY" 消息；
2. Worker（写端）：调用 wait_until_ready()，接收 Executor 的订阅通知，并发送 "READY" 响应。
只有通信双方都完成这一步握手，结果回传通路才算真正建立。此后，Executor 才会持有来自所有 Worker 的 worker_response_mq 队列数组，并能够依次获取各个 Worker 返回的输出。
与之相近但作用不同的另一个函数是 wait_for_ready。它是 Executor 用来等待所有 WorkerProc 子进程完成初始化的进程级同步握手。只有在这一步成功之后，Executor 才能获取到各个 Worker 的消息队列句柄；随后再调用 wait_until_ready，等待通信双方对应的消息队列真正建立连接，从而完成广播通道和结果回传通道的就绪确认。

```python 
# 代码有省略
class MultiprocExecutor(Executor):
    def _init_executor(self) -> None:
        # 发送订阅消息XPUB给Worker端
        self.workers = WorkerProc.wait_for_ready(unready_workers)
        for w in self.workers:
                w.worker_response_mq.wait_until_ready() # 等待Worker端发送确认消息（"Ready"）
                # 连接确立
        
class WorkerProc:
    @staticmethod
    def wait_for_ready(
        unready_proc_handles: list[UnreadyWorkerProcHandle]
    ) -> list[WorkerProcHandle]:
        worker_response_mq = MessageQueue.create_from_handle(response["handle"], 0)
        ready_proc_handles[unready_proc_handle.rank] = (
                        WorkerProcHandle.from_unready_handle(unready_proc_handle, worker_response_mq))
        return ready_proc_handles
        
    @staticmethod
    def worker_main(*args, **kwargs):
        ...
        ...
        # 等待订阅段的XPUB订阅消息，收到后向订阅端发送"READY"消息
        worker.worker_response_mq.wait_until_ready()
        worker.worker_busy_loop()
```

### Worker返回数据 
Worker 端通过 enqueue 和 dequeue 配合，将模型执行结果写入 worker_response_mq。具体流程如下图所示。Executor 端需等待所有相关 Worker 返回结果后，才能从worker_response_mq队列中获取完整输出。
