---
title: CUDA学习之transpose代码书写
date: 2026-10-03 18:06:08
tags:
- CUDA 
categories:
- 学习笔记
---
简单学一下这个板块的内容，这里其实没有多深入

<!--more-->
大致分为三个步骤，分别是naive版本，tiling版本和最终的padding版本。

# Naive版本 
```c++ 
#include <iostream>
#include <iomanip>
#include <vector>
#include <cmath>
#include <algorithm>
#include <cstdlib>
#include <cuda_runtime.h>
#include <cstdint> 
#include <type_traits>


#define CUDA_CHECK(call) { \
    cudaError_t err = call ;   \
    if (err != cudaSuccess){ \
        std::cerr << "CUDA error at " << __FILE__ << ":" << __LINE__ << ": " \
                  << cudaGetErrorString(err) << '\n'; \
        exit(1); \
    }    \
} \

template <typename T> 
__global__ void transpose_naive(T *output, const T *input, size_t N, size_t M){
    size_t col = blockIdx.x * blockDim.x + threadIdx.x;
    size_t row = blockIdx.y * blockDim.y + threadIdx.y;

    if (row < N && col < M) {
        output[col * N + row] = input[row * M + col];
    }
}

int main () {
    const size_t N = 1024;
    const size_t M = 1024;
    std::vector<float> h_matrix(N*M);

    std::vector<float> ref_transpose(M*N);
    std::vector<float> ans_transpose(M*N);

    for (size_t i = 0; i < N; i ++) {
        for (size_t j = 0; j < M; j ++) {
            h_matrix[i * M + j] = static_cast<float>(i % 97) - static_cast<float>(j);
            ref_transpose[j * N + i] = h_matrix[i * M + j];
        }
    }

    float *d_matrix = nullptr;
    float *d_transpose = nullptr;
    CUDA_CHECK(cudaMalloc(&d_matrix, static_cast<size_t>(N * M * sizeof(float))));
    CUDA_CHECK(cudaMalloc(&d_transpose, static_cast<size_t>(N * M * sizeof(float))));

    CUDA_CHECK(cudaMemcpy(d_matrix, h_matrix.data(), static_cast<size_t>(N * M * sizeof(float)), cudaMemcpyHostToDevice));
    CUDA_CHECK(cudaMemset(d_transpose, 0, static_cast<size_t>(N * M * sizeof(float))));

    unsigned int block_size = 32;
    dim3 block(block_size, block_size);
    unsigned grid_size_x = (M + block.x - 1) / block.x;
    unsigned grid_size_y = (N + block.y - 1) / block.y;
    dim3 grid(grid_size_x, grid_size_y);
    
    transpose_naive<float><<<grid, block>>> (d_transpose, d_matrix, N, M);
    CUDA_CHECK(cudaGetLastError());
    CUDA_CHECK(cudaDeviceSynchronize());

    CUDA_CHECK(cudaMemcpy(ans_transpose.data(), d_transpose, N * M * sizeof(float), cudaMemcpyDeviceToHost));

    for (size_t i = 0; i < N; i ++) {
        for (size_t j = 0; j < M; j ++) {
            if (fabs(ref_transpose[i * M + j] - ans_transpose[i * M + j]) > 1e-5) {
                std::cerr << "wrong" ;
                exit(1);
            }
        }
    }

    std::cout << "passed!\n\n";

    return 0;
}
```
这里我的block_size是32，那么每个block就有32 * 32个线程，所以每个block负责矩阵的一个32 * 32的区域。

然后计算gridDim，一个block一行能处理32 columns，那么x方向就需要N / 32个block。

然后送入参数即可。

然后转置的算法是：
```c++ 
B[col * N + row] = A[row * N + col];
```

这也是为什么我要这样写的原因。

这里看上去性能应该很不错，但实际也有它的问题，首先第一个问题时，我们的warp在访问内存的时候时离散的，这不太好。

这里补充一个知识点，在GPU中，硬件调度的基本单位是Warp，当一个 Warp 中的 32 个线程同时执行一条“加载/存储（Load/Store）”指令时：

- 如果这 32 个线程访问的内存地址是连续且对齐的。

- 硬件奇迹就发生了：GPU 的内存控制器（Memory Controller）会把这 32 个线程的零散请求合并（Coalesce）成 1次（或极少数几次） 硬件内存事务（Memory Transaction）。

GPU 的全局内存（Global Memory，即显存）和 L2/L1 缓存之间，数据传输是以“块”（通常是 32字节、64字节或 128字节的扇区）为单位进行的。

- 假设类型是 float（每个 4 字节），一个 Warp 共 32 个线程，总共需要读取 $32 \times 4 = 128$ 字节的数据。
- 理想情况（连续访问）：Thread 0 读 A[0]，Thread 1 读 A[1] ... Thread 31 读 A[31]。这 32 个地址正好凑够连续的 128 字节，完美契合一个硬件缓存扇区。GPU 只需发射 1 次内存请求，128 字节全部被充分利用，带宽利用率 100%。

所以这本质上是GPU带宽的问题。

这里我们能够想到的问题是，读的时候我们希望线程跟着row走，但是写转置矩阵的时候有希望跟着col走，所以直接从A到B是做不到的，所以我们引入一个中间站，Shared Memory。

# Tiled版本 

```c++
#include <iostream>
#include <iomanip>
#include <vector>
#include <cmath>
#include <algorithm>
#include <cstdlib>
#include <cuda_runtime.h>
#include <cstdint> 
#include <type_traits>


#define CUDA_CHECK(call) { \
    cudaError_t err = call ;   \
    if (err != cudaSuccess){ \
        std::cerr << "CUDA error at " << __FILE__ << ":" << __LINE__ << ": " \
                  << cudaGetErrorString(err) << '\n'; \
        exit(1); \
    }    \
} \

constexpr size_t BLOCK_DIM = 32;

template <typename T> 
__global__ void transpose_tiled(T *output, const T *input, const size_t N, const size_t M){
    __shared__ T tile[BLOCK_DIM][BLOCK_DIM];
    size_t col = blockIdx.x * blockDim.x + threadIdx.x;
    size_t row = blockIdx.y * blockDim.y + threadIdx.y;

    if (row < N && col < M) {
        tile[threadIdx.y][threadIdx.x] = input[row * M + col];
    }

    __syncthreads();

    size_t transposed_row = blockIdx.x * blockDim.x + threadIdx.y;
    size_t transposed_col = blockIdx.y * blockDim.y + threadIdx.x;

    if (transposed_row < M && transposed_col < N) {
        output[transposed_row * N + transposed_col] = tile[threadIdx.x][threadIdx.y];
    }
}

int main () {
    const size_t N = 1024;
    const size_t M = 1024;
    std::vector<float> h_matrix(N*M);

    std::vector<float> ref_transpose(M*N);
    std::vector<float> ans_transpose(M*N);

    for (size_t i = 0; i < N; i ++) {
        for (size_t j = 0; j < M; j ++) {
            h_matrix[i * M + j] = static_cast<float>(i % 97) - static_cast<float>(j);
            ref_transpose[j * N + i] = h_matrix[i * M + j];
        }
    }

    float *d_matrix = nullptr;
    float *d_transpose = nullptr;
    CUDA_CHECK(cudaMalloc(&d_matrix, static_cast<size_t>(N * M * sizeof(float))));
    CUDA_CHECK(cudaMalloc(&d_transpose, static_cast<size_t>(N * M * sizeof(float))));

    CUDA_CHECK(cudaMemcpy(d_matrix, h_matrix.data(), static_cast<size_t>(N * M * sizeof(float)), cudaMemcpyHostToDevice));
    CUDA_CHECK(cudaMemset(d_transpose, 0, static_cast<size_t>(N * M * sizeof(float))));

    unsigned int block_size = 32;
    dim3 block(block_size, block_size);
    unsigned grid_size_x = (M + block.x - 1) / block.x;
    unsigned grid_size_y = (N + block.y - 1) / block.y;
    dim3 grid(grid_size_x, grid_size_y);
    size_t smem_size = block_size * block_size * sizeof(float);
    
    transpose_tiled<float><<<grid, block, smem_size>>> (d_transpose, d_matrix, N, M);
    CUDA_CHECK(cudaGetLastError());
    CUDA_CHECK(cudaDeviceSynchronize());

    CUDA_CHECK(cudaMemcpy(ans_transpose.data(), d_transpose, N * M * sizeof(float), cudaMemcpyDeviceToHost));

    for (size_t i = 0; i < N; i ++) {
        for (size_t j = 0; j < M; j ++) {
            if (fabs(ref_transpose[i * M + j] - ans_transpose[i * M + j]) > 1e-5) {
                std::cerr << "wrong" ;
                exit(1);
            }
        }
    }

    std::cout << "passed!\n\n";

    return 0;
}
```
这里为什么能避免刚才那个问题，是因为通常同一个warp内，threadIdx.y固定，而threadIdx.x = 0, 1, 2, ..., 31. 

现在我们终于能够处理Bank Confict问题了！

# Tiled Padding 版本 
```c++ #include <iostream>
template <typename T> 
__global__ void transpose_tiled(T *output, const T *input, const size_t N, const size_t M){
    __shared__ T tile[BLOCK_DIM][BLOCK_DIM+1];
    size_t col = blockIdx.x * blockDim.x + threadIdx.x;
    size_t row = blockIdx.y * blockDim.y + threadIdx.y;

    if (row < N && col < M) {
        tile[threadIdx.y][threadIdx.x] = input[row * M + col];
    }

    __syncthreads();

    size_t transposed_row = blockIdx.x * blockDim.x + threadIdx.y;
    size_t transposed_col = blockIdx.y * blockDim.y + threadIdx.x;

    if (transposed_row < M && transposed_col < N) {
        output[transposed_row * N + transposed_col] = tile[threadIdx.x][threadIdx.y];
    }
}
```
这一块就看上一节我最后的图片理解吧，感觉并不难理解

![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/img/20261004233812569.png)

补充：
![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/img/20261004233953893.png)
![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/img/20261004234037767.png)
