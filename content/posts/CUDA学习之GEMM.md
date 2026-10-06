---
title: CUDA学习之GEMM
date: 2026-10-06 18:46:47
tags:
- CUDA 
categories:
- 学习笔记
---
这一节按照ppt完成以下任务，分别是矩阵乘法GEMM的Naive版本，内存合并版本，SMEM分块版本，1D Blocktiling版本，2DBlocktiling版本等等。我感觉还挺恶心的，这个做完我就拿去当我简历上的东西了，直到后面我们完成了FlashAttention的优化。

认真做做吧！
<!--more-->
# 前置芝士
GEMM是计算密集型算子，那么我们怎么论证的呢。

对于计算复杂度，结果矩阵的每个数都会进行一个点积操作O(N),一共有N * N个数，所以计算的总复杂度是$O(N^3)$

对于访存，一共三个矩阵，每个矩阵是O(N^2),所以访存复杂度是$O(N^2)$

GEMM: $C = \alpha A * B + \beta D$

![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/img/20261006191314372.png)
# Naive 版本 
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
__global__ void gemm_naive(int M, int N, int K, float alpha, const T *A, const T *B, float beta, T *C){
    int row = blockIdx.y * blockDim.y + threadIdx.y;
    int col = blockIdx.x * blockDim.x + threadIdx.x;

    if (row < M && col < N) {
        float sum = 0.0f;
        for (int k = 0; k < K; k ++){
            sum += A[row * K + k] * B[k * N + col];
        }
        C[row * N + col] = alpha * sum + beta * C[row * N + col];
    }
}

int main () {
    const int N = 1024;
    const int M = 1024;
    const int K = 512;
    float alpha = 1.3f;
    float beta = 2.1f;
    std::vector<float> h_A_matrix(M*K);
    std::vector<float> h_B_matrix(K*N);

    std::vector<float> ref_C(M*N, 1.0f);
    std::vector<float> ans_C(M*N, 1.0f);

    for (size_t i = 0; i < M; i ++) {
        for (size_t j = 0; j < K; j ++) {
            h_A_matrix[i * K + j] = static_cast<float>(i % 97) - static_cast<float>(j);
        }
    }

    for (size_t i = 0; i < K; i ++) {
        for (size_t j = 0; j < N; j ++) {
            h_B_matrix[i * N + j] = static_cast<float>(i % 53) - static_cast<float>(j);
        }
    }

    for (size_t i = 0; i < M; i ++) {
        for (size_t j = 0; j < N; j ++){
            float sum = 0.0f;
            for (size_t k = 0; k < K; k++)
            {
                sum += h_A_matrix[i*K+k] * h_B_matrix[k*N+j];
            }
            ref_C[i*N+j] = alpha * sum + beta * ref_C[i*N+j];
        }
    }

    float *d_A_matrix = nullptr;
    float *d_B_matrix = nullptr;
    float *d_C = nullptr;
    CUDA_CHECK(cudaMalloc(&d_A_matrix, static_cast<size_t>(M * K * sizeof(float))));
    CUDA_CHECK(cudaMalloc(&d_B_matrix, static_cast<size_t>(K * N * sizeof(float))));
    CUDA_CHECK(cudaMalloc(&d_C, static_cast<size_t>(M * N * sizeof(float))));

    CUDA_CHECK(cudaMemcpy(d_A_matrix, h_A_matrix.data(), static_cast<size_t>(M * K * sizeof(float)), cudaMemcpyHostToDevice));
    CUDA_CHECK(cudaMemcpy(d_B_matrix, h_B_matrix.data(), static_cast<size_t>(K * N * sizeof(float)), cudaMemcpyHostToDevice));
    CUDA_CHECK(cudaMemcpy(d_C, ans_C.data(), static_cast<size_t>(M * N * sizeof(float)), cudaMemcpyHostToDevice));

    unsigned int block_size = 32;
    dim3 block(block_size, block_size);
    unsigned grid_size_x = (N + block.x - 1) / block.x;
    unsigned grid_size_y = (M + block.y - 1) / block.y;
    dim3 grid(grid_size_x, grid_size_y);
    
    gemm_naive<float><<<grid, block>>> (M, N, K, alpha, d_A_matrix, d_B_matrix, beta, d_C);
    CUDA_CHECK(cudaGetLastError());
    CUDA_CHECK(cudaDeviceSynchronize());

    CUDA_CHECK(cudaMemcpy(ans_C.data(), d_C, M * N * sizeof(float), cudaMemcpyDeviceToHost));

    for (size_t i = 0; i < M; i ++) {
        for (size_t j = 0; j < N; j ++) {
            if (fabs(ref_C[i * N + j] - ans_C[i * N + j]) > 1e-3f * std::max(1.0f, fabs(ref_C[i * N + j]))) {
                std::cerr << "wrong" ;
                exit(1);
            }
        }
    }

    CUDA_CHECK(cudaFree(d_A_matrix));
    CUDA_CHECK(cudaFree(d_B_matrix));
    CUDA_CHECK(cudaFree(d_C));

    std::cout << "passed!\n\n";

    return 0;
}

```
没什么好讲的，很写到现在已经很简单了
