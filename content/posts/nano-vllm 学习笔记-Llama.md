---
title: nano-vllm 学习笔记-Llama
date: 2026-07-12 20:03:06
tags:
categories:
---
<!--more-->

# 代码阅读
因为我是新手，所以先从代码阅读开始

## llm_engine.py 
调用链如下：
LLM.generate()
  -> add_request()
      -> Sequence
      -> Scheduler.add()
  -> while not finished:
      -> step()
          -> Scheduler.schedule()
          -> ModelRunner.call("run")
          -> Scheduler.postprocess()
  -> tokenizer.decode()
  -> return outputs

## scheduler.py 
我总结一下这里面的逻辑

首先它创造了两个双向的队列(deque)，running和waiting，waiting代表等待中的prefill的请求，而running代表已经完成prefill，正在逐token decode的请求。

在调度的时候，首先尝试调度prefill，这里的逻辑是只要还有waiting请求，并且sequence数没超过上限，就继续尝试加入batch。

这里涉及到了BlockManager，主要是管理能不能给请求分配block以及返回可以复用的prefix cache block数量。如果prefix cache有命中，那么已经缓存的block不需要重新prefill，只需要跑剩余的token。

如果安排了prefill，就直接返回：prefill的优先级高于decode

如果没有prefill可做，进入decode调度

这里会检查这个请求 decode 追加一个 token 时，KV cache 空间够不够。如果空间不够，并且 running 队列里还有别的请求，就从队尾抢占一个请求。抢占会释放它的 KV cache block，让当前请求有机会继续跑。如果没有别的请求可抢占，只能抢占当前请求自己，然后退出内层循环。


## model_runner.py 
这一节比较难，我挑几个比较重要的描述 

### allocate_kv_cache函数

它的设计目标是，在模型加载并warmup后，根据当前GPU剩余显存，自动计算还能放多少个KV cache block，然后分配一整块连续的KV cache tensor，并把每一层Attention的k_cache/v_cache指向对应切片

首先记录CUDA的峰值显存，不仅是看当前剩余多少显存，还要给未来forward的临时峰值留空间。

```python 
peak = torch.cuda.memory_stats()["allocated_bytes.all.peak"]
current = torch.cuda.memory_stats()["allocated_bytes.all.current"]
```

其中peak - current = warmup forward 期间额外冲上去的临时显存

然后可以计算显存预算
```python 
free, total = torch.cuda.mem_get_info()
used = total - free
...
config.num_kvcache_blocks = int(total * config.gpu_memory_utilization - used - peak + current) // block_bytes
```

一个KV block的大小：
```python 
block_bytes = 2 * hf_config.num_hidden_layers * self.block_size * num_kv_heads * head_dim * hf_config.dtype.itemsize
```

因为支持tensor parallel所以：
```python 
num_kv_heads = hf_config.num_key_value_heads // self.world_size
```

block数量：
```python 
config.num_kvcache_blocks = 可用预算 // block_bytes
```

最后分配KV cache并且挂在指定的Attention上

```python 
self.kv_cache = torch.empty(
    2,
    hf_config.num_hidden_layers,
    config.num_kvcache_blocks,
    self.block_size,
    num_kv_heads,
    head_dim
)
```


### prepare_prefill

先理一下参数：

- input_ids 是本轮要送进模型的 token。

- positions 是这些 token 在原始 sequence 里的位置，用于 RoPE。

- cu_seqlens_q 和 cu_seqlens_k 是 FlashAttention varlen 接口需要的 cumulative sequence lengths。

为什么需要它们？因为 prefill 时多个请求会被拼成一个长的一维 token 序列.但 Attention 仍然需要知道哪些 token 属于第一个请求，哪些属于第二个请求。所以用 cu_seqlens 标记边界。

例如有 3 条请求，本轮 q 长度分别是：3, 5, 2.则： 

```python 
cu_seqlens_q = [0, 3, 8, 10]
```

max_seqlen_q 和 max_seqlen_k 是这批请求里最大的 query/key 长度，也是 FlashAttention 需要的参数。

slot_mapping 是非常关键的东西：它告诉 Attention，每个新 token 的 K/V 应该写到 KV cache 的哪个物理位置。

block_tables 默认是 None。如果有 prefix cache 或 chunked prefill 的历史 cache，需要它告诉 Attention 怎么从 KV cache 里读旧 token。

确认本轮要处理哪段token：
```python 
start = seq.num_cached_tokens
seqlen_q = seq.num_scheduled_tokens
end = start + seqlen_q
seqlen_k = end
```


其中start：已经缓存好的 token 数。
seqlen_q：本轮新计算的 token 数。
end：本轮结束位置。
seqlen_k：attention 的 key/value 总长度。

**填充input_ids 和 positions**:
```python 
input_ids.extend(seq[start:end])
positions.extend(range(start, end))
```

**更新FlashAttention的序列边界**
```python 
cu_seqlens_q.append(cu_seqlens_q[-1] + seqlen_q)
cu_seqlens_k.append(cu_seqlens_k[-1] + seqlen_k)
```

**计算本轮token覆盖哪些KV block** 
```python 
start_block = start // self.block_size
end_block = (end + self.block_size - 1) // self.block_size
```

然后把逻辑上的block和物理上的block做slot_mapping

如果有 block table，就让 FlashAttention 从 KV cache 里按 block table 读完整上下文。

总结来说：prepare_prefill() 把一批可能长度不同、可能有缓存前缀、可能被 chunk 过的 Sequence，压平成一个适合 FlashAttention 的 token 流，同时构造 KV cache 写入位置和历史 cache 读取表，让模型可以高效完成 prefill。


### 其它 
这里还涉及到cuda graph这些操作，太多了，这里先跳过 

接下来是对于Qwen3的代码的阅读

## qwen3.py 
最外层包装Qwen3ForCausalLM，包含两个部分
```python 
self.model = Qwen3Model(config)
self.lm_head = ParallelLMHead(config.vocab_size, config.hidden_size)
```

`Qwen3Model` 负责把 token 变成 hidden states。

`lm_head` 负责把 hidden states 变成 vocab logits。

为了减少层数和方便tensor parallel，将q,k,v合并成qkv_proj，gate,up合并成gate_up_proj：
```python
packed_modules_mapping = {
    "q_proj": ("qkv_proj", "q"),
    "k_proj": ("qkv_proj", "k"),
    "v_proj": ("qkv_proj", "v"),
    "gate_proj": ("gate_up_proj", 0),
    "up_proj": ("gate_up_proj", 1),
}
```

### Qwen3Model 
`Qwen3Model` 的结构很简单：

```python
self.embed_tokens = VocabParallelEmbedding(...)
self.layers = nn.ModuleList([...])
self.norm = RMSNorm(...)
```

前向流程：

```python
hidden_states = self.embed_tokens(input_ids)
residual = None
for layer in self.layers:
    hidden_states, residual = layer(positions, hidden_states, residual)
hidden_states, _ = self.norm(hidden_states, residual)
return hidden_states
```

可以理解为：

```text
1. token id 先查 embedding 表，变成向量。
2. 向量依次通过 N 个 decoder layer。
3. 最后做一次 RMSNorm。
4. 输出 hidden states。
```

`positions` 是每个 token 在原序列中的位置。它不是 batch 内位置，而是文本上下文里的真实 token 位置。这个位置后面会给 RoPE 使用。

这里着重说一下这个VacabParallelEmbedding,这里涉及到如果词表很大就会通过tensor parallel去切分给不同的GPU，然后前向时每个rank只处理自己负责的token，不属于自己的token会被mask，最后通过dist.all_reduce把各个rank的结果加起来，得到完整的embedding输出。

### Qwen3DecodeLayer
就是一层Transformer，比较特殊的是它显式的传递了residual，以方便少一些中间张量，少一些显存读写，推理更快。

每层结构是：

```text
输入 hidden_states
  -> input RMSNorm
  -> self attention
  -> post attention RMSNorm
  -> MLP
  -> 输出 hidden_states
```


### Qwen3Attention

本质是注意力层

这里同样做了很多工程方面的处理，比如适配了tensor parallel，合并了kvq。

这里的位置编码采用的是RoPE。

调用的底层Attention：
```python
o = self.attn(q, k, v)
```

这个 `Attention` 不是普通 attention。它会读取 `ModelRunner.prepare_prefill()` 或 `prepare_decode()` 设置的全局 context。

prefill 时：

```text
处理 prompt 的一段或全部 token。
把新算出来的 K/V 写入 KV cache。
用 flash_attn_varlen_func 做变长 attention。
```

decode 时：

```text
每条请求通常只输入最后一个 token。
从 KV cache 读取历史 K/V。
用 flash_attn_with_kvcache 做单步生成 attention。
```

所以 `Qwen3Attention` 自己不直接传入 block table 或 slot mapping。它把这些交给 `Attention` 通过 context 读取。

### Qwen3Model
前馈网络，这里要注意的是使用了SiluAndMul这个方法。

这里AI总结的很好，我直接复制过来：
## 一次 prefill 是怎么穿过 Qwen3 的

假设有两个 prompt：

```text
seq A: 5 个 token
seq B: 3 个 token
```

`prepare_prefill()` 会把它们拼成：

```text
input_ids = [A0, A1, A2, A3, A4, B0, B1, B2]
positions = [0, 1, 2, 3, 4, 0, 1, 2]
cu_seqlens_q = [0, 5, 8]
```

进入模型：

```text
embedding:
  每个 token id 变成 hidden vector。

decoder layers:
  每层先 RMSNorm。
  Attention 根据 cu_seqlens 知道 A 和 B 是两条不同序列。
  Attention 根据 slot_mapping 把 K/V 写入 KV cache。
  MLP 做非线性变换。

final norm:
  得到每个 token 的 hidden state。

lm_head:
  只取 A4 和 B2 的 hidden state 计算 logits。
```

最后采样得到：

```text
A 的第一个生成 token
B 的第一个生成 token
```

## 一次 decode 是怎么穿过 Qwen3 的

decode 阶段，每条 running sequence 通常只输入一个 token，也就是上一轮生成出的 token。

假设：

```text
seq A 输入最后 token A5
seq B 输入最后 token B3
```

`prepare_decode()` 会准备：

```text
input_ids = [A5, B3]
positions = [5, 3]
context_lens = [6, 4]
block_tables = 每条请求的 KV block 表
```

进入 Attention 时：

```text
q 来自当前输入 token。
k/v 当前 token会写入 KV cache。
历史 k/v 从 KV cache 里读。
```

所以 decode 不需要重复计算整个 prompt。它只计算最新 token，再复用之前缓存的 K/V。

这是 LLM 推理能快起来的关键。

## linear.py 
这里主要在实现tensor parallel的线性层，这里值得注意的是weight_loader这个函数，它具体是从Qwen3里面读取的数据。

在load_model()中，打开.safetensors权重文件，遍历里面的权重名，并且将原权重名替换成nano-vllm里面的参数。接着取出挂在参数上的加载函数，最后调用它。

## layernorm.py 

```txt 
RMSNorm:
  x / sqrt(mean(x^2) + eps) * weight

add_rms_forward:
  residual_new = x + residual
  x_norm = RMSNorm(residual_new)
  return x_norm, residual_new
```

## rotary_embedding.py
这里的RoPE十分神秘，它两两分是在内部分的

比如q = \[q0,q1,q2,q3\]

它把q0&q1,q2&q3作为两组，然后分别做RoPE，这里的好处是再后续Q和K乘的时候，能够携带位置信息 

对于内部不同的组，通过不同的频率能够吸收不同长度的位置信息：

高频组：对位置差 1、2、3 很敏感
低频组：更适合表示几十、几百、几千的距离




# TinyLlama

正式进入到代码编写中

先记录一下TinyLlama的config.json :
```python 
{
  "architectures": [
    "LlamaForCausalLM"
  ],
  "attention_bias": false,
  "bos_token_id": 1,
  "eos_token_id": 2,
  "hidden_act": "silu",
  "hidden_size": 2048,
  "initializer_range": 0.02,
  "intermediate_size": 5632,
  "max_position_embeddings": 2048,
  "model_type": "llama",
  "num_attention_heads": 32,
  "num_hidden_layers": 22,
  "num_key_value_heads": 4,
  "pretraining_tp": 1,
  "rms_norm_eps": 1e-05,
  "rope_scaling": null,
  "rope_theta": 10000.0,
  "tie_word_embeddings": false,
  "torch_dtype": "bfloat16",
  "transformers_version": "4.35.0",
  "use_cache": true,      
  "vocab_size": 32000
}
```

记录一下Qwen3的config ： 
```python 
{
  "architectures": [
    "Qwen3ForCausalLM"
  ],
  "attention_bias": false,
  "attention_dropout": 0.0,
  "bos_token_id": 151643,
  "eos_token_id": 151645,
  "head_dim": 128,
  "hidden_act": "silu",
  "hidden_size": 1024,
  "initializer_range": 0.02,
  "intermediate_size": 3072,
  "max_position_embeddings": 40960,
  "max_window_layers": 28,
  "model_type": "qwen3",
  "num_attention_heads": 16,
  "num_hidden_layers": 28,
  "num_key_value_heads": 8,
  "rms_norm_eps": 1e-06,
  "rope_scaling": null,
  "rope_theta": 1000000,
  "sliding_window": null,
  "tie_word_embeddings": true,
  "torch_dtype": "bfloat16",
  "transformers_version": "4.51.0",
  "use_cache": true,
  "use_sliding_window": false,
  "vocab_size": 151936
}              
```

我修改了代码，现在可以运行Llama的程序了，下面我总结一下Qwen3和Llama的差异：


在代码层面，很多参数是不同的，比如最直接的是在config.json里面，model_type一个是qwen3,一个是llama.

模型规模也不同，所以 TinyLlama 虽然层数更少，但 hidden size 更大；Qwen3 的词表非常大，因为它覆盖更多语言和特殊 token。

Qwen3中直接写了head_dim,而TinyLlama没有head_dim，需要自己去算

两者都是GQA，但是比例不同

TinyLlama：
```python 
num_attention_heads = 32
num_key_value_heads = 4
```
也就是 32 个 query heads 共享 4 个 key/value heads。
Qwen3：
```python
num_attention_heads = 16
num_key_value_heads = 8
```
也就是 16 个 query heads 共享 8 个 key/value heads。
两者都不是普通 MHA，而是 GQA。现有的 QKVParallelLinear 和 Attention 可以支持 GQA，但 tensor parallel 时要注意：
num_attention_heads % tensor_parallel_size == 0
num_key_value_heads % tensor_parallel_size == 0

Qwen3可能有q_norm/k_norm，而Llama一般没有



