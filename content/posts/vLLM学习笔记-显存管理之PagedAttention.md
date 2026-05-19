---
title: vLLM学习笔记-显存管理之PagedAttention
date: 2026-05-19 17:07:24
tags:
- vLLM 
- AI_Infra  
categories:
- 学习笔记
---
在大语言模型（LLM）的自回归生成（autoregressive decoding）过程中，每一步都会生成一个 token，并将其作为下一步的输入。为了提升推理效率，避免重复计算注意力机制中的 Key 和 Value 向量，系统会将这些中间结果缓存起来——这就是 Key-Value Cache（KV Cache）。
然而，传统的 KV Cache 管理方式存在若干关键问题，严重制约了推理性能：
1. 动态序列长度增长：每个请求的输入提示词长度不同，且在生成过程中逐步增长（尤其在采样解码时），导致 KV Cache 的大小不固定，难以统一管理；
2. 内存碎片化：若采用连续内存分配策略（如 PyTorch 的 aten::empty），随着序列动态扩展，频繁的内存重新分配会引发严重的内部和外部碎片，降低 GPU 显存利用率；
3. 冗余存储：在提示词共享或树状推测解码（speculative decoding）等场景中，多个请求可能具有相同前缀，但传统方法仍独立缓存，造成显著的存储浪费；
4. 批处理能力受限：由于 KV Cache 占用高占用时间长且内存碎片严重，实际可并行处理的 batch size 被大幅压缩，直接影响推理吞吐量。

```python 
self.cache_k = torch.zeros((
                args.max_batch_size,
                args.max_seq_len,
                self.n_local_kv_heads,
                self.head_dim,)).cuda()
```
值得注意的是，上述问题中的第 1、2、4 点本质上都指向同一个核心挑战：如何高效管理变长序列下的 KV Cache 内存，以减少碎片、提升显存利用率和批处理能力,这也是 vLLM 等现代推理框架重点优化的方向。针对上述 KV Cache 管理的挑战，开发人员尝试了多种解决方案，但每种方法都有其局限性。

# 传统策略及其缺陷
## KV Cache的显存占用
在 Transformer 模型中，每个注意力层都会维护独立的 Key（K）和 Value（V）缓存。对于长度为 $L$的序列，每一层的 KV Cache 所需显存大致与
$$L\times d_k \times num\_heads$$
成正比。随着自回归生成的进行，序列长度$L$逐步增加，KV Cache 也随之动态增长。因此，如何高效分配和管理这部分内存成为推理系统设计的核心问题。目前常见的 KV Cache 内存管理方式主要有两种：静态预分配 和 动态扩容，但二者均存在显著缺点。

## 静态预分配（固定最大长度）
一种简单做法是为每个请求预先分配最大支持长度（如 max_seq_len=8192）的 KV Cache 空间。这意味着即使当前序列仅生成了十几个 token，系统仍会占用长达数千 token 的缓存空间。
这种方式的主要问题包括：
- 显存浪费严重：大量预留空间长期未被使用，导致显存利用率极低；
- 加剧内存碎片：大块连续显存被提前锁定，其他新请求即使所需空间较小也无法复用这些“闲置但不可分割”的区域；
- 降低并发能力：由于显存无法高效共享，系统可同时处理的请求数量（batch size）受限，导致吞吐下降，请求拒绝率上升。
例如，一个最多生成 4096 个 token 的请求，在整个生命周期内独占对应大小的 KV Cache 资源，即便实际只用了几十个 token。在此期间，其他潜在请求可能因无法获得足够显存而被拒绝。

## 动态扩容（按需增长）
另一种思路是初始时为请求分配较小的 KV Cache，随后根据生成长度逐步扩展。虽然这种方法空间利用率更高，但也带来新的开销：
- 频繁显存分配/释放：每次扩容都需要调用类似cudaMalloc或cudaFree的操作，带来较高的 GPU 开销；
- 数据拷贝开销大：扩容通常需要申请更大的连续空间，并将原有数据复制过去，触发昂贵的 GPU 显存传输（memcpy），消耗带宽并拖慢推理速度；
- 加剧碎片化：频繁的分配与释放容易产生外部碎片，进一步限制大块连续内存的可用性。
综上，无论是静态预分配还是动态扩容，都无法兼顾高显存利用率、低延迟和高并发的需求。这也促使了更先进的 KV Cache 管理机制的发展——例如 vLLM 中提出的 PagedAttention，借鉴操作系统虚拟内存的思想，将物理显存划分为固定大小的页，实现高效、灵活且低碎片的 KV 缓存管理。

# 分页显存的管理办法 
## 分页管理的优势
1. 消除连续显存依赖
传统方式通常需要为每个请求分配一段连续显存来存储 KV Cache。当请求长度不同、生命周期不同，或者请求频繁进出时，显存很容易产生碎片，即使总空闲显存足够，也可能因为没有足够大的连续空间而分配失败。
PagedAttention 允许一个请求使用多个非连续的物理 block。只要显存池中还有足够数量的空闲 block，就可以完成 KV Cache 分配，从而提高显存利用的灵活性和分配成功率。
2. 显著减少内存浪费
由于 KV Cache 按固定大小的 block 分配，一个请求只会在最后一个 block 中产生少量未使用空间。最坏情况下，每个请求最多浪费 block_size - 1 个 token 的空间。
相比传统静态预分配方式可能一次性为请求保留大量 token 空间，分页式管理把内部碎片控制在较小范围内，同时也避免了连续分配带来的外部碎片问题。
3. 支持高效共享机制（Prefix Cache）
当多个请求拥有相同的 prompt 前缀时，它们可以共享已经计算好的 KV Cache block，而不需要重复存储相同的 KV 值。
共享机制带来两个好处：
- 节省显存：相同前缀对应的 KV Cache 只需要保存一份。
- 减少计算：共享前缀已经完成计算，后续请求可以复用对应结果。
当不同请求的生成路径开始分歧时，系统再为新的分支分配独立的物理 block。这样既能复用公共前缀，又能保证不同请求后续生成内容互不影响。

## 工作机制简述
系统启动时，将可用的 KV Cache 显存预先划分为一个物理块池。每个请求的 KV Cache 不再需要一段连续的物理地址，而是通过块表（Block Table）记录其所使用的各个物理块。这种虚拟化管理方式使上层调度器只需处理块 ID，无需关心块在显存中的实际物理位置。
PagedAttention 引入分块管理机制，从根本上解决了传统 KV Cache 管理中的两大痛点：显存利用率低与碎片化严重。这一机制为高效的大模型推理提供了关键支撑。从示意图中可见，每个请求的 KV Cache 由多个非连续的物理块组成，请求仅需维护一个记录块 ID 的映射表即可。

## 计算可分配显存块的数量
在分块式显存管理中，KV Cache 被划分为一系列固定大小的物理块。请求本身维护逻辑块到物理块的映射关系，模型执行时再根据这张映射表访问对应的 KV Cache。
系统中可用于 KV Cache 的物理块数量，主要取决于显存中还剩下多少空间可以分配给 KV Cache。这个空间通常受以下因素影响：
1. 用户显存限制
  用户可以通过配置限制推理系统最多使用多少显存，例如只允许使用 GPU 总显存的一定比例。这样可以避免推理服务占满整张 GPU，给系统、其他进程或框架运行时预留必要空间。
2. 模型自身占用
  模型权重会长期驻留在显存中，推理过程中的中间激活值、临时 buffer、CUDA graph、通信 buffer 等也会占用显存。模型越大，或者单步计算所需的中间状态越多，留给 KV Cache 的显存就越少，可分配的物理块数量也就越少。

为了更准确地评估这些非 KV Cache 部分的显存开销，系统通常不会只依赖理论公式估算，而是会执行一次 profiling：使用随机输入数据跑一遍前向传播，观察实际显存峰值占用。这样可以把权重、激活值以及运行时临时 buffer 等因素都纳入统计，得到更接近真实推理过程的显存使用情况。
在完成 profiling 后，系统会根据用户允许使用的显存上限，扣除模型权重、激活值和其他运行时开销，剩余部分用于建立 KV Cache block 池。最终可用的物理块数量大致可以理解为：
1. 可用于 KV Cache 的显存 = 用户允许使用的总显存 - 模型权重显存 - 推理中间激活值/临时 buffer 显存 - 其他运行时预留开销
2. 物理块数量 = 可用于 KV Cache 的显存 / 单个 KV Cache block 大小

1. 维护空闲显存块 根据 物理块数量 也就是num_gpu_blocks 初始化一批物理块，并维护一个空闲队列。调度器需要为请求分配 KV Cache 时，就从空闲队列中取出可用 block；当请求结束或某些 block 不再被引用时，再将其归还到空闲队列。
2. 维护哈希到显存块的映射 为了支持 prefix cache，系统会为已经计算过的完整 block 建立哈希映射。这个映射关系可以理解为： block_hash -> physical block
  当新的请求拥有相同 prompt 前缀时，系统可以通过哈希快速查找是否已经存在可复用的 KV Cache block。如果命中，就不需要重新分配和重新计算对应 block，只需要复用已有物理块，并将该 block 的引用计数 ref_cnt 加 1。
3. 支持引用计数与复用 每个物理块都会维护引用计数。引用计数表示当前有多少请求或逻辑块正在使用这个物理块。
  - ref_cnt > 0：block 正在被使用，不能回收
  - ref_cnt = 0：block 当前无人引用，可以重新进入空闲队列
  当请求结束、被抢占，或者某个逻辑块不再需要时，对应物理块的 ref_cnt 会减少。如果引用计数降为 0，该 block 就会被重新挂入空闲队列，等待后续重新分配。
4. 支持延迟清理哈希映射 对于曾经参与 prefix cache 的 block，即使它的 ref_cnt 降为 0，系统也不一定立即删除它的哈希映射。这样做可以保留复用机会：如果后续请求再次命中相同前缀，就可以直接复用该 block。
  这样设计的核心目的是保留复用机会：假设 block A 曾存储某段 prompt 前缀的 KV Cache。当最后一个引用它的请求结束时，ref_cnt 变为 0，block A 被放入空闲队列末尾等待回收。若此时恰好有新请求携带相同前缀，由于哈希映射尚未失效，该请求仍能通过 block_hash 查找到 block A。系统会将其 ref_cnt 从 0 重置为 1，并将其从空闲队列中移除，实现零开销复用。
  也就是说，当该 block 真正从空闲队列中被重新分配给新的内容时，系统才会清除旧的哈希映射，避免哈希表指向已经被覆盖的 KV Cache 内容。

## 获取显存块的数量 
一个token需要的kv cache大小就是num_heads × head_size × 2 × data_type，一个 block 的大小则是：单层单 block KV Cache 大小 = block_size × 2 × num_kv_heads × head_size × dtype_size
在分配 KV Cache 显存块之前，系统需要先确定当前还能拿出多少显存用于 KV Cache。这一流程对应 _initialize_kv_caches，主要包括以下阶段：
1. 获取 KV Cache 配置
系统会先通过 get_kv_cache_specs 收集每个 attention 层的 KV Cache 规格信息，包括：
  - num_kv_heads：KV head 的数量
  - head_size：每个 head 的维度
  - block_size：每个 KV Cache block 中包含的 token 数量
  - dtype：KV Cache 使用的数据类型
这些信息决定了一个 KV Cache block 应该长什么样，也就是每层每个 block 需要占用多少显存。
2. 通过模拟推理确定 block 数量
此时系统还不知道最多能分配多少个 block，也就是num_gpu_blocks。这个值不能只靠理论估算，因为模型权重、临时 buffer、中间激活、CUDA graph 等都会影响实际可用显存。
  因此，系统会使用 dummy/random input 执行一次模拟前向传播，统计实际显存占用，再根据用户设定的显存使用比例，计算剩余可用于 KV Cache 的显存，最终得到可分配的 GPU block 数量。
3. 分配并组织 KV Cache 显存
拿到 num_gpu_blocks 后，系统会真正申请 KV Cache 显存，并按照 block 组织起来。底层张量通常会为某一层或某一组 KV Cache 分配一片连续存储，然后按 block 切分；但从请求视角看，一个请求的逻辑 KV Cache 不要求连续，可以映射到多个非连续的物理 block。不同层、不同 cache group 的底层存储也不要求彼此连续。
kv_cache_specs 描述的是每一层 KV Cache block 的规格。它告诉系统：如果要为这个模型建立 KV Cache block 池，每个 block 应该包含多少 token、每个 token 的 K/V 张量维度是多少、用什么 dtype 存储。至于一共能建立多少个 block，即 num_gpu_blocks，需要在 profiling 之后根据实际可用显存动态确定。

```python 
FullAttentionSpec(block_size=16, 
                  num_kv_heads=2, 
                  head_size=128, 
                  dtype=torch.bfloat16, ...)
```
在 _initialize_kv_caches() 中，对应变量定义和获取方式为：
```python
kv_cache_specs = self.model_executor.get_kv_cache_specs()
```
它既不是一个单独的 KVCacheSpec，而是一个 list：list[i] 就是第 i 个 worker 所辖所有层的dict[str, KVCacheSpec]，这个 dict 里包含了该 worker 上所有层的 KV Cache 规格。
```python 
kv_cache_specs: list[dict[str, KVCacheSpec]]
```
kv_cache_specs的数据结构大致如下：
```python 
kv_cache_specs = [
    {
        "model.layers.0.self_attn": FullAttentionSpec(...),
        "model.layers.1.self_attn": FullAttentionSpec(...),
        ...
    },
    ...
]
```

```python 
def _initialize_kv_caches(self, vllm_config: VllmConfig) -> tuple[int, int, KVCacheConfig]:
    start = time.time()

    # Get all kv cache needed by the model
    # 1. 获取搜集每个attention层的基本信息
    kv_cache_specs = self.model_executor.get_kv_cache_specs()
    # 2. 通过模拟运行的方式获取可以使用的显存数
    available_gpu_memory = (self.model_executor.determine_available_memory())
    self.available_gpu_memory_for_kv_cache = available_gpu_memory[0]
    
    kv_cache_configs = [
        get_kv_cache_config(vllm_config, kv_cache_spec_one_worker, available_gpu_memory_one_worker)
    for kv_cache_spec_one_worker, available_gpu_memory_one_worker in zip(kv_cache_specs, available_gpu_memory)]
```
在收集完各个 attention 层的 KV Cache 规格信息后，系统可以开始计算需要为 KV Cache 分配多少物理块。此处关键的并非立即分配显存，而是先明确当前 GPU 上还有多少显存可用于 KV Cache。
该过程主要在 determine_available_memory() 中完成。它通过一次模拟推理（即 profile_run()）统计模型在真实执行路径下的显存占用。相较于纯理论估算，这种方法更为可靠，因为中间激活、临时 buffer、CUDA graph 等开销难以通过公式精确计算。

```python 
@dataclass
class MemoryProfilingResult:
    non_kv_cache_memory: int = 0
    torch_peak_increase: int = 0
    non_torch_increase: int = 0
    weights_memory: int = 0
    before_create: MemorySnapshot
    before_profile: MemorySnapshot   # ← free_memory 在这里面
    after_profile: MemorySnapshot    # ← free_memory 在这里面
    profile_time: float = 0.0
```
此过程中需要关注几个关键变量：
1. profile_result
profile_result 是模拟推理后的显存 profiling 结果，包含模型执行过程中的实际显存占用信息。其中重点关注：
- free_gpu_memory：profiling 结束后 GPU 的空闲显存，取自 profile_result.after_profile.free_memory。
- non_kv_cache_memory：非 KV Cache 部分的显存占用，主要包括模型权重、中间激活、临时 buffer 等运行时开销。
2. self.requested_memory
self.requested_memory 表示 vLLM 允许自己使用的最大显存预算，通常由 GPU 总显存乘以用户配置的 gpu_memory_utilization 得到：
```python 
self.requested_memory = total_gpu_memory × gpu_memory_utilization
```
它不是整张显卡的全部显存，而是用户允许 vLLM 使用的显存上限。
3. 可用于 KV Cache 的显存
完成 profiling 后，系统用允许使用的显存预算减去非 KV Cache 的显存占用，得到剩余可分配给 KV Cache 的显存：
```python 
available_kv_cache_memory = self.requested_memory - profile_result.non_kv_cache_memory - cudagraph_memory_estimate_applied
```
若不考虑 CUDA graph 额外预留，可简化理解为：
```python 
available_kv_cache_memory ≈ self.requested_memory - non_kv_cache_memory
```
因此，整体逻辑可概括为：
用户允许 vLLM 使用的最大显存  
 – 模型权重和推理运行时开销  
 = 可用于 KV Cache 的显存预算  
获得这部分显存预算后，系统再结合每个 KV Cache block 的大小，进一步计算可分配的物理块数量，即后续的 num_blocks / num_gpu_blocks。
如果系统中有两张显卡，且对应两个 worker，则 model_executor.determine_available_memory() 返回的 available_gpu_memory 列表长度通常为 2，其中每个元素分别表示对应 worker/GPU 可用于 KV Cache 的显存大小。

```python 
def determine_available_memory(self) -> int:
  """Profiles the peak memory usage of the model to determine how much
        memory can be used for KV cache without OOMs.

        The engine will first conduct a profiling of the existing memory usage.
        Then, it calculate the free memory that can be used for KV cache in
        bytes.

        Tip:
            You may limit the usage of GPU memory
            by adjusting the `gpu_memory_utilization` parameter.
        """
  torch.cuda.empty_cache()
  torch.cuda.reset_peak_memory_stats()
  GiB = lambda b: b / GiB_bytes

  # Execute a forward pass with dummy inputs to profile the memory usage
  # of the model.
  with memory_profiling(self.init_snapshot, \ 
                        weights_memory=int(self.model_runner.model_memory_usage)) as profile_result:
    self.model_runner.profile_run()
    
  free_gpu_memory = profile_result.after_profile.free_memory
    
  available_kv_cache_memory = self.requested_memory - profile_result.non_kv_cache_memory
  gc.collect()

  return int(available_kv_cache_memory)
```
get_kv_cache_config 会根据模型各层的 KV Cache 规格以及当前可用于 KV Cache 的显存大小，生成 KVCacheConfig。对于普通的 uniform full attention 模型，各层 KV Cache 规格相同，因此可以使用统一的 page_size 来计算每层可分配的 block 数量。
所以page_size 表示单层、单个 KV Cache block 占用的字节数，另外因为在 vLLM 里，一个 block 不是只存 1 个 token，而是存 block_size 个 token 的 KV Cache。对普通 attention 来说，一个 block 需要同时存Key cache和Value cache，所以公式是：
```python 
page_size_bytes = 2 × block_size × num_kv_heads × head_size × dtype_size
```
这里的 2 表示同时存储 Key 和 Value；block_size 表示每个 block 中包含多少个 token。
1. block_size：表示每个 KV Cache block 包含的 token 数量。例如 block_size = 16，即一个 block 可存储 16 个 token 的 KV Cache。
2. num_kv_heads ：指 KV head 的数量，注意其不一定等于 attention head 数。在普通 MHA 中，num_kv_heads = num_attention_heads；在 GQA/MQA 中，num_kv_heads 会更小。
3. head_size：指每个 KV head 的维度大小。例如 head_size = 128，即每个 head 的 Key 或 Value 向量长度为 128。
4. dtype_size：指每个元素占用的字节数。
在得到 page_size 后，可以计算 num_blocks：

```python 
num_blocks = available_memory // page_size // num_layers
```
这里的num_layers并不是有多少个attention layer，而是考虑多个layer在推理的时候会串行，考虑显存复用之后的layer_num。实际上会比attention layer的数量小很多

这里的 num_blocks 表示每个 attention layer 可分配的 KV Cache block 数量，所以单个 attention layer 的 KV Cache 容量上限可表示为：
```python 
per_layer_size = page_size × num_blocks
```
在完成各 attention 层 KV Cache 规格收集并通过 profiling 得到可用于 KV Cache 的显存大小后，系统调用 get_kv_cache_configs() 为每个 worker 生成 kv_cache_configs，其中包含各 worker 的 KV Cache 配置。

## 申请显存块 

