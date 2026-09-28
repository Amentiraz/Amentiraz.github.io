---
title: CUDA性能分析与优化逐元素访存
date: 2026-09-28 14:51:24
tags:
- CUDA 
categories:
- 学习笔记
---
<!--more-->
先把上次没有写完的grid-stride的给写完。
```c++
#include <iostream>
#include <iomanip>
#include <vector>
#include <cmath>
#include <algorithm>
#include <cstdlib>
#include <cuda_runtime.h>

#define CUDA_CHECK(call) { \
    cudaError_t err = call ;   \
    if (err != cudaSuccess){ \
        std::cerr << "CUDA error at " << __FILE__ << ":" << __LINE__ << ": " \
                  << cudaGetErrorString(err) << '\n'; \
        exit(1); \
    }    \
} \


template <typename T>
__global__ void add_kernel(T *c, const T *a, const T *b, size_t n) {
    size_t idx = (blockDim.x) * blockIdx.x + threadIdx.x;
    if (idx < n) {
        c[idx] = a[idx] + b[idx] ;
    }
}

template <typename T> 
__global__ void add_grid_stride(T *c, const T *a, const T *b, size_t n){
    size_t first = static_cast<size_t>(blockIdx.x) * blockDim.x + threadIdx.x;
    size_t stride = static_cast<size_t>(blockDim.x) * gridDim.x;
    for (size_t i = first; i < n; i += stride) {
        c[i] = a[i] + b[i] ; 
    }
}

void free_device_memory(float *d_a, float *d_b, float *d_c) {
    if(d_a) CUDA_CHECK(cudaFree(d_a));
    if(d_b) CUDA_CHECK(cudaFree(d_b));
    if(d_c) CUDA_CHECK(cudaFree(d_c));
}

bool run_case(size_t n, unsigned int block_size, unsigned int grid_size){
    const size_t SIZE = n ;

    if (grid_size == 0) {
        grid_size = static_cast<unsigned int>(
            n / block_size + (n % block_size != 0)
        );
    }

    if (SIZE == 0) {
        std::cout << "Empty input: passed!\n";
        return true;
    }

    std::vector<float> h_a(SIZE, 1) ;
    std::vector<float> h_b(SIZE, 2);
    std::vector<float> h_c(SIZE, 0);
    std::vector<float> ref(SIZE);

    float *d_a, *d_b, *d_c;
    d_a = d_b = d_c = nullptr;

    for (size_t i = 0; i < SIZE; i ++){
        h_a[i] = static_cast<float>(i % 97) - 48.0f;
        h_b[i] = static_cast<float>(i % 31) * 0.25f;
        ref[i] = h_a[i] + h_b[i];
    }
     
    size_t size_bytes = SIZE * sizeof(float);

    CUDA_CHECK(cudaMalloc(&d_a, size_bytes));
    CUDA_CHECK(cudaMalloc(&d_b, size_bytes));
    CUDA_CHECK(cudaMalloc(&d_c, size_bytes));

    CUDA_CHECK(cudaMemcpy(d_a, h_a.data(), size_bytes, cudaMemcpyHostToDevice));
    CUDA_CHECK(cudaMemcpy(d_b, h_b.data(), size_bytes, cudaMemcpyHostToDevice));
    CUDA_CHECK(cudaMemcpy(d_c, h_c.data(), size_bytes, cudaMemcpyHostToDevice));
    
    unsigned int BLOCK_SIZE = block_size;
    dim3 block_dim(BLOCK_SIZE);
    dim3 grid_dim(grid_size) ;

    add_grid_stride<<<grid_dim,block_dim>>>(d_c, d_a, d_b, SIZE);
    
    CUDA_CHECK(cudaGetLastError());
    CUDA_CHECK(cudaDeviceSynchronize());

    CUDA_CHECK(cudaMemcpy(h_c.data(), d_c, size_bytes, cudaMemcpyDeviceToHost));

    for (size_t i = 0; i < SIZE; i ++) {
        if (fabs(h_c[i] - ref[i]) > 1e-5){
            std::cerr <<  "Verification failed at index " << i << ": "
                        << h_c[i] << " != 3.0\n";
            free_device_memory(d_a, d_b, d_c);
            d_a = d_b = d_c = nullptr;
            printf("failed!\n");
            return false;
        }
    }

    free_device_memory(d_a, d_b, d_c);
    d_a = d_b = d_c = nullptr;
    printf("passed!\n"); 
    return true ;
}

int main () {
    const size_t test_sizes[] = {
        0, 1, 31, 32, 33, 255, 256, 257, 1000003
    };

    bool all_passed = true;

    std::cout << "===== Normal grid =====\n";

    for (size_t n : test_sizes) {
        bool passed = run_case(n, 256, 0);
        all_passed = passed && all_passed;
    }

    std::cout << "\n===== Fixed small grid =====\n";

    for (size_t n : test_sizes) {
        bool passed = run_case(n, 128, 2);
        all_passed = passed && all_passed;
    }

    std::cout << "\n===== Single thread =====\n";

    for (size_t n : test_sizes) {
        if (n > 257) {
            continue;
        }

        bool passed = run_case(n, 1, 1);
        all_passed = passed && all_passed;
    }

    return all_passed ? EXIT_SUCCESS : EXIT_FAILURE;
}
```
运行了一下这个Nsight Systems(CLI):
我先记录一下相关操作：
```txt 
nvcc -std=c++17 -lineinfo vector_add_bench.cu -o vector_add_bench
nsys profile     -t cuda,nvtx,osrt     -o vector_add_bench     -f true     ./vector_add_bench
nsys stats vector_add_bench.nsys-rep --force-export=true
```
![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/img/20260928160158613.png)
![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/img/20260928160224240.png)
现在我先跑<<<1,1>>>:
![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/img/20260928161946708.png)
然后跑<<<256,256>>>:
![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/img/20260928161654918.png)
HtoD 和DtoH 的耗时均远大于核函数时间

从而：
![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/img/20260928162425212.png)

试试nsight compute：
```txt 
ncu   --print-details all   --nvtx   --call-stack   --set full   ./vector_add_bench
```
![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/img/20260928165558882.png)
这里说明我们加法的性能瓶颈在内存访问上，因此想办法提升其访存效率。
![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/img/20260928165737488.png)
现在我加入了向量化访存并行加法的方法，然后我记录一下结果：
## 对于float4：
![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/img/20260928220810308.png)
![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/img/20260928223019423.png)
DRAM Throughput    = 89.29%
Compute Throughput = 6.27%
这说明 GPU大部分时间在搬数据，计算单元没有被充分使用，但这不是实现不好，而是向量加法本身的特征。

$Performance = \frac{1048576}{43.71 \times10^{-6}} \approx24.0\ \text{GFLOP/s}$

所以roofline的点在(0.0833 FLOP/byte, 24.0 GFLOP/s)

float4 向量加法每处理四个标量需要读取两个 float4、写入一个 float4，共移动48字节并执行4次浮点加法，因此计算强度仍为 4/48=1/12≈0.0833 FLOP/byte。向量化没有提高计算强度，而是减少了访存和地址计算指令。Nsight Compute 显示当前 kernel 的 DRAM Throughput 为89.29%，Compute Throughput 仅为6.27%，说明它是显存带宽受限算子。按43.71 μs计算，其有效性能约为24.0 GFLOP/s，已经接近当前带宽对应的 Roofline。

## 对于float2：
![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/img/20260928224458947.png)
![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/img/20260928224516082.png)
有效计算性能：
$\frac{1048576}{42.75\ \mu s}\approx24.53\ \text{GFLOP/s}$
float2 和 float4 都已经接近显存带宽 Roofline。float2 本次比 float4 快约2.25%，具有更高的 Waves/SM、更少的每线程寄存器，并取得略高的内存吞吐率。不过差距较小，需要 CUDA Event 多轮测量确认稳定性。

![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/img/20260928225150273.png)
scalar、float2 和 float4 分别生成了32位、64位和128位全局访存指令，但三者算法计算强度均为 1/12≈0.0833 FLOP/byte，逻辑内存流量也完全相同。在 RTX 3060 Laptop GPU 上，三个版本的 DRAM Throughput 均达到约88%～90%，说明它们都受显存带宽限制并接近相同的 Roofline。本次 NCU 采集中 float2 用时42.75 μs，略快于 scalar 的43.14 μs和 float4 的43.71 μs，但最大差距只有约2.2%，需要通过预热后的 CUDA Event 多轮测量判断差异是否稳定。

# 其它
后面还有个半精度的东西，但我懒得搞了，差不多都学明白了，包括roofline的使用，nvcc查看性能等等，就酱！

我发现拿AI去辅助学习这些内容还真是狗屎呢，它完全不考虑你学习曲线的问题，然后还一直去纠结一些不必要的问题，我也是麻了。后面还是自己拿ppt的资料学吧。

还是把ppt的内容粘上来吧www：
![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/img/20260928225804310.png)
