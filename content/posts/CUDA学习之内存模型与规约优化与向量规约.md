---
title: CUDA学习之内存模型与规约优化与向量规约
date: 2026-09-30 16:12:19
tags:
- CUDA 
categories:
- 学习笔记
---
<!--more-->
# Roofline
先说一下上次遗留下来的一些问题：Roofline

上次只是粗浅的知道了Roofline大概的落点在哪，但是对于它实际的意义其实我并没我想象中的清楚，所以这次仔细研究一下：

![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/img/20260930161449728.png)
![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/img/20260930161508634.png)
![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/img/20260930161524794.png)
Roofline回答的是：对于一个 kernel，根据“每搬运一个字节做多少计算”，这块 GPU 理论上最多能达到多少计算性能？
![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/img/20260930161736535.png)
一个kernel同时受到两个上限约束：计算能力上限和显存搬运能力上限

横坐标是计算强度：$AI=\frac{完成的有效浮点运算次数}{搬运的字节数}$
   
例如我们的vector_add:搬运12bytes，只做一次加法，那么我们的计算强度是:
$AI = \frac{W}{Q} = \frac{1}{12} = 0.0833FLOP/byte$

倾斜线是显存带宽屋顶：$P_{memory roof} = BW_{peak} \times AI$

NCU报告中给出的Roofline参数大约是 $BW_{peak} = 298.1 GB/s$，所以在这个计算强度下，GPU最多达到$P_{memory roof} = 298.1 \times 0.0833 = 24.84 GFLOP/s$。

水平线是计算屋顶：$P_{compute roof} = 6142 GFLOP/s$，它表示在当前NCU记录的频率状态下，GPU的FP32理论的计算上限

# 计算累加
## 有竞争的情况下
```c++
template <typename T>
__global__ void sum_kernel(T *result, const T *num, size_t n){
    size_t idx = (blockDim.x * blockIdx.x) + threadIdx.x;
    if (idx < n) {
        *result += num[idx];
    }
}

int main(){
    size_t SIZE = 1 << 20 ;
    std::vector<float> h_vec(SIZE,0);

    float h_ans = static_cast<float>(0);
    std::vector<float> d_ans(1);

    for (size_t i = 0; i < SIZE; i ++){
        h_vec[i] = static_cast<float>(i % 97) - 48.0f;
        h_ans += h_vec[i];
    }
    float *ans = nullptr;
    float *vec = nullptr;

    CUDA_CHECK(cudaMalloc(&vec, static_cast<size_t>(SIZE * sizeof(float))));
    CUDA_CHECK(cudaMalloc(&ans, static_cast<size_t>(sizeof(float))));

    CUDA_CHECK(cudaMemcpy(vec, h_vec.data(), static_cast<size_t>(SIZE * sizeof(float)), cudaMemcpyHostToDevice));
    CUDA_CHECK(cudaMemset(ans, 0, sizeof(float)))
    unsigned int block_size = 256 ;
    dim3 block_dim(block_size);
    unsigned int grid_size = static_cast<unsigned int>((SIZE / block_size) + (SIZE % block_size != 0));
    dim3 grid_dim(grid_size);
    sum_kernel<float><<<grid_dim, block_dim>>>(ans, vec, SIZE);
    CUDA_CHECK(cudaGetLastError());
    CUDA_CHECK(cudaDeviceSynchronize());

    CUDA_CHECK(cudaMemcpy(d_ans.data(), ans, static_cast<size_t>(sizeof(float)), cudaMemcpyDeviceToHost));
    if (fabs(d_ans[0] - h_ans) > 1e-5){
        std::cerr << "d_ans: " << d_ans[0] << "\n" << "h_ans: " << h_ans << "\nfailed!\n\n";
        return 0;
    }
    std::cout << "passed!\n\n";
    return 0;
}
```
结果不出意外的出意外了：
![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/img/20260930173432180.png)
## Atomic操作
```c++ 
template <typename T>
__global__ void sum_kernel(T *result, const T *num, size_t n){
    size_t idx = (blockDim.x * blockIdx.x) + threadIdx.x;
    if (idx < n) {
        atomicAdd(result, num[idx]);
    }
}
```
![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/img/20260930173941857.png)
我自己懒得跑了，看ppt的说法是原子操作后计算与内存吞吐/利用率都很低，很多线程都在闲置，这是由于原子操作导致线程之间完全串行！

这里很容易想到：分治算法，不需要每个线程都直接加到最终的result里面，放到这里的说法是分治规约。

## warp内的分治规约
```c++
template <typename T> 
__global__ void reduce_warp_global_kernel(T *output, const T *input, size_t n){
    size_t tid = threadIdx.x;
    unsigned int lane_id = tid % 32;
    size_t idx = blockIdx.x * blockDim.x + tid;
    if (lane_id == 0) {
        T warp_sum = 0;
        const size_t step = blockDim.x * gridDim.x;
        const size_t total_elements = ((n - idx) + step - 1) / step;

        for (size_t linear_idx = 0; linear_idx < total_elements * 32; ++ linear_idx) {
            const size_t segment = linear_idx / 32 ;
            const size_t lane = linear_idx % 32;
            const size_t j = idx + segment * step + lane;

            if (j < n) {
                warp_sum += input[j];
            }
        }

        atomicAdd(output, warp_sum);
    }
}
```
这里设计的这么复杂是为了让访问顺序变成线性，如果我们这样做：
```c++
for (i = 0; i < 32; ++i) {
    for (j = idx + i; j < n; j += step) {
        warp_sum += input[j];
    }
}
```
那么访问顺序：
```
i=0:  0, 128, 256
i=1:  1, 129, 257
i=2:  2, 130, 258
...
i=31: 31, 159, 287
```
这里将两层循环展平成了一层，访问顺序变为：
```
0, 1, 2, ..., 31,
128, 129, 130, ..., 159,
256, 257, 258, ..., 287
```

## block内的分治规约 
```c++ 
template <typename T> 
__global__ void reduce_block_global_kernel(T *output, const T *input, size_t n){
    size_t tid = threadIdx.x;
    size_t idx = blockIdx.x * blockDim.x + tid;

    if (tid == 0) {
        T block_sum = 0;
        for (size_t i = 0; i < blockDim.x; i ++){
            for (size_t j = idx + i; j < n; j += blockDim.x * gridDim.x){
                block_sum += input[j];
            }
        }
        atomicAdd(output, block_sum);
    }
}
```
Intra-block 的比 intra-warp 的版本计算利用率和活跃warp 数都要低不少

虽然减少了原子累加的操作数，但单个线程的计算量增加太大，利用率/效率变低
## GPU理论知识 
![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/img/20260930181455141.png)
![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/img/20260930181532130.png)
![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/img/20260930181659705.png)
## 共享内存树状规约 
```c++ 
template <typename T> 
__global__ void reduce_smem_tree_kernel(T *output, const T *input, size_t n){
    extern __shared__ T smem[];
    size_t tid = threadIdx.x;
    size_t idx = blockIdx.x * blockDim.x + tid;

    smem[tid] = (idx < n) ? input[idx] : 0;
    __syncthreads();

    for (int s = blockDim.x / 2; s > 0; s >>= 1) {
        if (tid < s){
            smem[tid] += smem[tid + s];
        }
        __syncthreads();
    }

    if (tid == 0) {
        atomicAdd(output, smem[0]);
    }
}
```
每个 block 先在共享内存中求出自己的局部和，最后由每个 block 的线程0通过一次 atomicAdd 写入全局结果。

这里调用时:
```c++ 
int block_size = 256;
int grid_size = (n + block_size - 1) / block_size;

reduce_smem_tree_kernel<float>
    <<<grid_size, block_size, block_size * sizeof(float)>>>(
        output,
        input,
        n
    );
```
第三个启动参数就是为每个block分配的动态共享内存大小

现在我把目前得到的结果的性能给汇总一下
![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/img/20260930222159649.png)
- `v2_block` 相比 `v1_atomic` 快约 `5.36x`。
- `v2_warp` 相比 `v2_block` 快约 `3.41x`。
- `v3_smem` 相比 `v2_warp` 快约 `2.43x`。
- `v3_smem` 相比 `v1_atomic` 快约 `44.35x`。

![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/img/20260930222250325.png)
![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/img/20260930222410970.png)

所有版本的计算强度都远低于约 `20.59 FLOP/byte` 的 Ridge Point，因此在经典双屋顶图中位于带宽斜线一侧。但这只说明 DRAM 屋顶低于 FP32 计算屋顶，不表示实际执行一定已经被 DRAM 带宽卡住。

- `v1_atomic` 远低于自己的内存屋顶，并且 DRAM 利用率只有 `1.73%`。主要瓶颈是大量线程竞争同一个全局原子地址。
- `v2_block` 的有效 AI 已恢复到约 `0.25`，但 Achieved Occupancy 只有 `16.34%`。每个 block 只有线程 0 工作，绝大多数线程资源没有产生有效计算。
- `v2_warp` 增加了工作线程数量，性能明显提升；但每个 warp 仍只有 lane 0 工作，NCU 观察到约 `10.09 MB` 的 DRAM 流量，高于输入的 `4.00 MiB`。
- `v3_smem` 使用合并的全局内存读取，并将全局原子操作降到每个 block 一次，因此是当前最快的正确版本。
- `v3_smem` 的 DRAM 利用率只有 `16.40%`，而 LSU/shared-memory 相关吞吐达到约 `84%`。当前继续优化时应重点减少共享内存指令和 `__syncthreads()`，例如在最后一个 warp 中使用 `__shfl_down_sync`。

## warp规约优化 
### __shfl_down_sync
__shfl_down_sync是允许线程直接从同一个warp中另一个线程的寄存器中读取数据。数据传输直接在寄存器之间完成，完全不需要占用Shared Memory资源。这释放了Shared Memory供其他计算或更大的Block使用。

寄存器（Registers）是 GPU 上访问速度最快的存储介质。寄存器之间的直接数据交换（通过硬件层面的 Shuffle 单元）比经过 Shared Memory 读写的时延低得多，执行速度更快。

这里会注意到它不需要同步，因为上一例中我们使用了__syncthreads去做块内同步，而在Warp 内部，32 个线程本来就是以 SIMT（单指令多线程）方式隐式同步执行的。

使用 __shfl_down_sync 时，掩码（如代码中的 0xFFFFFFFF，代表 Warp 内所有 32 个线程全部参与）能够安全地在指令级别协调数据传输，省去了编写 __syncthreads() 的麻烦，同时也避免了因错误同步导致的性能下降或死锁风险。

### 具体实现
```c++
template <typename T> 
__global__ void reduce_warp_shfl_register_kernel(T *output, const T *input, size_t n){
    size_t tid = threadIdx.x;
    size_t idx = blockIdx.x * blockDim.x + tid;

    T sum = 0;
    for (size_t i = idx; i < n; i += blockDim.x * gridDim.x) {
        sum += input[i] ;
    }

    for (int offset = 16; offset > 0; offset >>= 1) {
        sum += __shfl_down_sync(0xFFFFFFF, sum, offset);
    }

    if (tid % 32 == 0) {
        atomicAdd(output, sum);
    }
}
```

这里利用了 CUDA 的 Warp Shuffle（束内洗牌） 机制，在同一个 Warp（包含 32 个线程）内部进行树状相加。

offset 从 16 开始，每次减半（16 -> 8 -> 4 -> 2 -> 1）。

循环结束后，每个 Warp 内的第 0 号线程（Lane 0）的 sum 寄存器中，就保存了该 Warp 所负责处理的所有数据的总和。

这里确实有明显的提升，但是跟目前最快的smem-tree比起来差距还是很大，这是因为我们没对warp间规约优化，于是我们想到，将原来的smem手动树状规约换成warp-shuffle规约：

### 更牛的规约
```c++
template <typename T>
__device__ T warp_reduce(T val){
#pragma unroll
    for (int offset = 16; offset > 0; offset >>= 1) {
        val += __shfl_down_sync(0xFFFFFFF, val, offset);
    }
    return val;
}

template <typename T> 
__global__ void reduce_warp_shuffle_kernel(T *output, const T *input, size_t n){
    extern __shared__ T smem[];
    size_t tid = threadIdx.x;
    size_t idx = blockIdx.x * blockDim.x + tid;

    T sum = 0;
    for (size_t i = idx; i < n; i += blockDim.x * gridDim.x) {
        sum += input[i]; 
    }
    T warp_sum = warp_reduce(sum);
    if (tid % 32 == 0) {
        smem[tid / 32] = warp_sum;
    }
    __syncthreads();

    if (tid < 32) {
        T block_sum = (tid < (blockDim.x + 31) / 32) ? smem[tid] : T(0);
        block_sum = warp_reduce(block_sum);
        if (tid == 0) {
            atomicAdd(output, block_sum);
        }
    }
}
```
这个不仅在warp内做规约，也在block内做规约
