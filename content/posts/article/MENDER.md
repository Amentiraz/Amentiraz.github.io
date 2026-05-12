---
title: MENDER
date: 2024-12-01 12:12:31
tags:
- 生物
- 学习笔记类
- 算法
categories:
- 论文
math: true
---
MENDER: fast and scalable tissue structur identification in spatial omics data.

<!--more-->

这次笔记尝试一下只记录我认为重要的地方，就不按部就班的来了，但总体还是分为文章-代码的结构

# 摘要

总体概括以下这个MENDER(Multi-range cEll conNtext DEciphereR)干了什么：

1. offers substantial improvements over modern complex models while automatically aligning labels across slices, despite using much less running time than the second-fastest.
2. MENDER's identification power allows the uncovering of previously overlooked spatial domains that exhibit strong association with brain aging.
3. MENDER's sclability makes it freely appliable on a million-level brain spatial stlas.
4. MENDER's discriminative power enables the differentiation of breast cancer patiant subtypes obsured by single-cell analysis

# Introduction

In a typical SRSC dataset, the spatial coordinates and gene-expression profiles of each cell are measured. Such datat representation naturally forms a spatial graph with cells as nodes and gene expression as node attributes, which motivated the two major modeling paradigms in this field:
1. Graph Neural Network(GNN)
    - GNN-based methods introduced dedicated neural modules, loss functions, and network architectures.
2. Bayesian Network(BN)
    - BN-based methods extend additional hideen variables, varianle dependencies, and specified priors.

MENDER has 3 highlighted points:
1. multi-slice spatial domain identification that challenges many advanced methods.
2. scalability to million-level datasets
3. improved running time efficiency without the need of GPU

# Results

![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/blogpic/MENDER1.png)
All GNN-based methods have better scalability and speed than BN-based methods and they can also output the context representations for cells.

The common limitations of GNN-based methods are the lack of stability and interpretability inherited from general deep-learning models. 

BN-based methods, on the contrary, have better output stability and interpretability than GNN-based methods since they are generally built on well-defined probabilistic variable dependencies. 

But they cannot guarantee good scalability to large datasets with short running time, and generally don’t output the cell context representations 

MENDER的Overview
![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/blogpic/MENDER2.png)
![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/blogpic/MENDER3.png)

这玩意不结合数学公式来看确实也看不懂，我这里直接把Methods里面的东西弄过来

## 输入
G genes, M cells from S slices

The "Gene expression matrix"(Nrows $\times$ Gcolumns)

The "Spatial matrix (Nrows $\times$ 2 columns, for 2D data, 3 columns for 3D data)

The slice ID identifier(a vector of length N)

## Cell group compution

说白了就是用Leiden给gene expression数据聚类，得到Cell group，分两种情况（batch effect）

## Multi-range neighborhood Representation Computation

根据上面的操作，现在手上的数据有"Spatial matrix", "Silce ID", and "Cell Group"

首先，为了放着不同slice的细胞成为neighbors，先将它们按照slice进行parallelization操作.

For each slice, around every cell, S ranges of spatial neighborhoods are created, forming S ring areas around the central cell (the radius is set to 15um by default). The cell index located within each ring area is recorded for each central cell. 

这里的ranges指的是有多少个环，也就是radius扩大多少次。

Formally, suppose the total number of cells across all input slices is N, the first step partitioned all cells into C distinct cell states.
这里的C distinct cell states应该指的是 Cell Group里面聚类出来的不同细胞类型
noted as $G=\{g_c\}$,$c\in[1,C]$

The cell state of the i-th cell is noted as $cell_i$,$i\in [1,N]$.

The origin slice of the i-th cell is noted as $slice_i$,$i\in[1,N]$.

The spatial coordinate of the i-th cell is nored as $(x_i,y_i)$,$i\in[1,N]$

The number of ranges if set to $S$. The radius is set to $R$.

Then the multi-range neighborhood representation matrix,$M\in Z^{+N\times (S\times C)}$, in which the i-th row is the context-aware representation of the i-th cell.
$$\begin{array}{c}
M_{i,(s-1)\times C+c=|{j|(s-1)\times R\leq Dist(i,j)<s\times R}\cap{j|slice_j=slice_i}\cap{j|cell_j=g_c}|} \\
where: \\
Dist{i,j} = \sqrt {(x_j-x_i)^2+(y_j-y_i)^2} \\
i,j\in [1,N] \\
s \in [1,S] \\ 
c \in [1,C]
\end{array}$$

这里的M指的是满足这个条件的数量,$|\cdot|$表示数量的计算。

## 总结一下

说白了这玩意还是把基因的信息和spatial的基因结合并凸显它们的特征然后利用得到的信息进行聚类，只不过把范围扩大到了多slice的情况。

# 评价环节

又到了喜闻乐见的吹水环节，这里就把我认为比较有代表性的图片粘贴上来

![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/blogpic/MENDER4.png)

![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/blogpic/MENDER5.png)

![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/blogpic/MENDER6.png)

![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/blogpic/MENDER7.png)

The original publication supplied both fine and coarse cell classifications.

we define patient representation using MENDER domain proportion as "MENDER repr".

![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/blogpic/MENDER8.png)

这里的每一个点指的是S slice $\times$ replicated runs

![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/blogpic/MENDER9.png)

这张图片表示了对于同一个spatial domain也能体现出细胞context的variation。对于后两个图片是基于不同的分辨率得到的。

![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/blogpic/MENDER10.png)

这是对于图片的解释

# Discussions
这篇文章的discussion写的确实挺不错的，有些观点可以记录一下

There are primarily two factors that can influence the determination of spatial domain labels:
1. The first factor is cellular context because MENDER relies on the representation of cellular context tot determine spatial domain labels.
2. The second factor is the Leiden clustering resolution.

There were two folds of analytical contributions:
1. we identified consistent nerghborhood statistics across different spatial technologies in different tissue systems,
2. we found that simple cellular context analysis might have improved performance compared to state-of-art complex models in both supervised and unsupervised settings.


# Code


没什么好写的，就是把上面的内容给复现了罢了
