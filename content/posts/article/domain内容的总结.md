---
layout: 对spatial domain内容总结
title: 对spatial domain内容的总结
date: 2025-03-15 21:38:28
tags:
- 生物
- 学习笔记类
- 算法
categories:
- 论文
math: true
---
总结一下以往看过的文章对于background，尤其是对于spatial domain相关知识的介绍

# Benchmarking spatial clustering methods with spatially resolved transcriptomics data

Spatial clustering, which shares an analogy with single-cell clustering, has expanded the scope of tissue physiology from cell-centriod to structure-centroid with spatially resolved transcriptomics(SRT) data.


advancements in spatially resolved transcriptomics(SRT) enable the multiplexed spatial mapping of gene expression, allowing researchers to move beyond cell clustering to identify higher-order tissue structures, or spatial domains, through the provisdion of additional spatial information.

Identifying spatial domains by spatial clustering has become a standard initial step in constructing spatial atlas and has proven to be a crucial in visualizing tissue anatomy, inferring tissue spatial signatures of development and disease, and identifying domain-dependent molecular regulatory networks.

## Supplymentary Note

Spatial clustering, also known as spatial domain identification, aims to utilize both gene expression profiles and spatial information to identify tissue regions with spatially coherent gene expression patterns.

The primary applied spatial data types are spot-like non-single-cell resolution technologies, such as 10X Visium and ST. With the development of advanced technologies that have improved spatial resolution, the applied data type has been extended to single-cell level datasets, such as Slide-seq, Slide-seqV2, Stereo-seq, STARmap, MERFISH, and seqFISH1, among others. 

These methods are useful in the following aspects:
- The identification of tissue structures. Traditionally, histological experts annotate tissue structures, which is a highly labor-demanding and subjective approach. However, spatial clustering provides an unbiased and efficient way to segregate tissue structures without human supervision, saving a lot of time and effort. For example, the classical dorsolateral prefrontal cortex (DLPFC) dataset was originally annotated by experts, but current advances in spatial clustering methods have been able to automatically annotate the tissue with very similar performance to human labels. Other brain regions were also annotated computationally, such as the hypothalamic preoptic region, primary visual area, hippocampus, and cerebellum. In the future, other brain regions, the whole brain, and more complex tissues and organs will hopefully be annotated in an unbiased and effective manner by advancements in computational methods.
- Some tissue structures cannot be trivially identified by referring to H&E images. An important example is the liver. In a liver lobule, the tissue spatially is classically divided into different zones (termed liver zonation), and each zone contains major portions of hepatocytes having different metabolic functions while displaying similar morphological features. In such tissue, manual annotation is especially challenging, given the large amount of liver lobules with complex shapes. Computational methods are very important in such cases.
- The identification of tissue spatial continuity. Some tissues display continuous spatial patterns instead of having sharp tissue interfaces. For example, the brain cortex, although partitioned into several discrete layers, may not have strictly defined boundaries. Many genes exhibited strong continuity along the cortical axis, and some higher-level cellular organizations also showed continuity, such as cell type complexity and spatial heterogeneity, which were reported to have strong correlations with cortical depth. The continuity sometimes has clinical significance in disease and cancer. Investigations have been made in studying the gradual structural changes from adjacent normal tissue to cancerous tissue to understand the molecular and tissue biology of cancer.
- The identification of domain-specific marker genes. Different from cell-type-specific marker genes, domain-specific marker genes show stronger spatial autocorrelations.Their functions are more likely to be spatially related or display specificity to certain proximities to certain microenvironments. Traditionally, gene markers that define specific brain regions are identified by traditional assays (such as bulk or scRNA-seq) from selected brain domains. Such practice is labor-demanding and has limited domain specificity. Some genes within certain domains or tissue microenvironments are strongly related to their localizations. For example, in disease, molecular polarizations have been found in liver fibrosis, where metabolites related to glycolysis within the hepatic domains showed polarization patterns towards the fibrosis domain boundary. In another example in cancer, some immune-related proteins showed polarization patterns within the immune regions towards tumor domain boundaries, which is reported to be associated with tumor-immune interactions.
- Mining spatial signatures of development and disease. In the single-cell era, cell type proportions were typically used to differentiate different patient groups for better diagnosis. However, many diseases and cancers do not show significant differences in cell type proportions but only have differences in terms of the spatial organizations of cells30,31. Such cases have been reported in different cancers (e.g., breast cancer12 and colorectal cancer30) and COVID-19 diseases31. Pioneer computational methods have already illustrated the diagnostic significance of such cases.
- Identifying domain-dependent molecular regulatory networks. Such studies are mainly concentrated on investigating the distribution of disease-related molecules (e.g., proteins) across spatial domains. A recent study developed STARmapPlus to simultaneously spatially profile targeted proteins and gene expressions. They used the new technology to study the different distributions of Alzheimer's disease-related proteins within domains. Another study utilized computational methods to predict the abundance of such proteins by incorporating spatial microenvironment information.

# SpaGCN

Recent technological advances in SRT have enabled gene expression profilingh with spatial information in tissue.

Knoledge of the relative locations of different cells in a tissue is critical for understanding disease pathology because spatial information helps in understanding how the gene expression of a cell is influenced by its surrounding environment.

methods for SRT:
+ in situ hybridization or sequencing-based technologies with single-cell resolution
    - e.g. seqFISH, seqFISH+, MERFISH, STARmap and FISSEQ that measure the expression level for hundred to thousands of genes in cells within their tissue context.
    - 因为能达到单细胞分辨率，这些技术适合于高精度分析，用于深入理解细胞在组织结构中的分布以及细胞间的相互作用。
+ in situ capturing-based technologies with spatial barcoding followed by sequencing 
    - e.g. spatial transcriptomics(ST), SLIDE-seq, SLIDE-seqV2, HDST and 10x Visium that measure the expression level for thousands of genes in captured locations, referred to as spots.
    - 由于通常只能定位到捕获区域的水平，这类技术的空间分辨率低于单细胞分辨率，但它们适合于大规模研究，因为能够同时检测数千个基因。

To link spatial domains with biological functions, it is crucial to identify genes that show enriched expression in the identified domains. Methods such as Trendsceek, SpatialDE and SPARK have been developed to detect spatially variable genes(SVGs).

# BayesSpace 

Knowledge of the spatial location of transript expression can provide vital insights into biological function and pathology.

Single-cell RNA sequencing(scRNA-seq) achieves high-throughput and high-resolution profiling of gene expression, but because tissue is dissociated for sample preparation, spatial information is not retained.

Recent methods for high-throughput profiling of gene expression while retaining spatial information allow analyses to be made within the context of the biological tissue.Studies performed with the Spatial Transcriptomics(ST) platform and the improved Visium platform have already generated insights into diverse areas such as tumor heterogeneity, brain function and the pathophysiology of sepsis. The primary technological limitation of these spatial gene expression platforms is resolution, with the unit of observation being spots that are 100 μm in diameter on the ST platform and 55 μm in diameter on the Visium platform.  As such, the number of cells within a spot may range from one to 30 on the Visium platform and up to 200 on the older ST platform, depending on the biological tissue. Alternative approaches include fluorescence in situ hybridization (FISH) technologies, such as seqFISH and multiplexed error-robust FISH, and other recently developed spatial sequencing methods, such as Slide-seq and ZipSeq. While these methods provide increased resolution, most are lower throughput, less sensitive, rely on custom protocols or are not widely available.

+++解释 
这段话主要讨论了不同**空间转录组技术（spatial transcriptomics, ST）**在**分辨率（resolution）、通量（throughput）、灵敏度（sensitivity）和可用性（availability）**方面的差异。可以从以下几个方面理解：  

---

### **1. Visium 与 ST 平台的细胞数差异**  
- 在 **10X Genomics Visium** 平台上，每个检测点（spot）可能包含 **1 到 30 个细胞**，具体取决于生物组织的密度。  
- 在 **较早的 ST（Spatial Transcriptomics）平台** 上，每个检测点可能包含**多达 200 个细胞**。  
- 这表明 **Visium 提供了更高的分辨率**，因为每个 spot 覆盖的细胞数量更少，可以更精细地解析基因表达的空间分布。  

---

### **2. 其他高分辨率技术：FISH 和新型空间测序方法**  
- **荧光原位杂交（FISH）技术**：
  - **seqFISH（sequential FISH）**
  - **MERFISH（multiplexed error-robust FISH）**  
  这些技术通过荧光探针直接检测 RNA 分子，可以达到单细胞甚至亚细胞（subcellular）级别的分辨率。  

- **其他新型空间测序方法**：
  - **Slide-seq**：将 RNA 分子定位到微珠阵列（bead array）上，实现高分辨率空间测序。  
  - **ZipSeq**：结合光学方法和条形码标记（barcoding）来进行空间解析。  

---

### **3. 这些方法的局限性**
尽管 **seqFISH、MERFISH、Slide-seq 和 ZipSeq** 在分辨率方面优于 Visium 和 ST 平台，但它们存在以下不足：  
1. **通量较低（lower throughput）**：一次实验可以检测的 RNA 分子或细胞数量有限，难以大规模应用。  
2. **灵敏度较低（less sensitive）**：相比于 Visium 这样的商业化平台，FISH 技术可能在检测低丰度基因表达时存在问题。  
3. **依赖定制实验流程（custom protocols）**：这些方法往往需要特殊的实验设置，不如 Visium 这样的平台易于使用。  
4. **尚未广泛可用（not widely available）**：这些技术可能仍处于实验室研发阶段，尚未大规模商业化，难以在各类实验室推广。  

---

### **总结**
| 技术 | 细胞覆盖范围 | 分辨率 | 通量 | 灵敏度 | 可用性 |
|------|------------|------|------|------|------|
| **Visium** | 1-30 细胞/spot | 中等 | 高 | 高 | 商业化，易获取 |
| **ST（老版）** | 高达 200 细胞/spot | 低 | 高 | 高 | 商业化，易获取 |
| **seqFISH / MERFISH** | 单细胞甚至亚细胞级 | 高 | 低 | 低 | 需要特殊设备和协议 |
| **Slide-seq / ZipSeq** | 取决于条形码技术 | 高 | 低 | 低 | 仍在研究中，尚未大规模应用 |

**核心理解**：Visium 和 ST 平台虽然分辨率不如 seqFISH 或 Slide-seq，但它们的**通量高、灵敏度强、实验流程标准化，适用于大规模应用**。而 FISH 和新型空间测序方法提供了更高分辨率，但**实验复杂度高，难以大规模推广**。
+++

# STAGATE
Deciphering spatial domains (i.e., regions with similar spatial expression patterns) is one of the great challenges from STs.For example, the laminar organization of the human cerebral cortex is especially related to its biological functions, in which cells residing within different cortical layers often differ in expressions, morphology and physiology. 

These non-spatial methods can be roughly divided into two categories. The first category uses traditional clustering methods such as k-means and Louvain algorithm. These methods are limited to the small number of spots or the sparsity according to the different resolutions of ST technologies, and clustering results may be discontinuous in the tissue section. The second category utilizes the cell type signatures defined by single-cell RNA-seq to deconvolute the spots. They are not applicable to ST data at a resolution of cellular or subcellular levels.

Some recent algorithms adapt the clustering methods by considering the similarity between adjacent spots to better account for the spatial dependency of gene expressions. These methods show significant improvements in identifying spatial domains of sections from brain and cancer tissues. For example, BayesSpace is a Bayesian statistical method that encourages neighboring spots to belong to the same cluster by introducing spatial neighbor structure into the prior. Giotto identifies spatial domains by implementing a hidden Markov random field (HMRF) model with the spatial neighbor prior. stLearn defines the morphological distance based on features extracted from a histology image and utilizes such distances as well as spatial neighbor structure to smooth gene expressions. SEDR employs a deep auto-encoder network for learning gene representations and uses a variational graph auto-encoder to simultaneously embed spatial information. SpaGCN also applies the graph convolutional network to integrate gene expression and spatial location, and further coupled with a self-supervised module to identify domains. Besides, a recent developed method named RESEPT leverages the supervised image segmentation method to perform tissue structure identification. Although these methods consider the spatial structure of STs, the similarity of neighboring spots defined by them is pre-defined before training and cannot be learned adaptively. Moreover, these methods do not consider the spatial similarity of spots at the boundary of spatial domains in more detail and do not well integrate spatial information to impute and denoise gene expressions. More importantly, these approaches cannot be applied to multiple consecutive sections to reconstruct a three-dimensional (3D) ST model and extract 3D expression domains.

全是英文看的想吐，这里补充一下中文的版本：

# Benchmarking


空间转录组学（SRT）的进步实现了基因表达的多重空间定位，使研究人员能够突破传统的细胞聚类，借助额外的空间信息识别更高层级的组织结构，即空间域（spatial domains）[^1,^2,^3]。通过空间聚类识别空间域已成为构建空间图谱（spatial atlas）的标准初始步骤[^4–^8]，并在可视化组织解剖结构[^9]、推断组织空间连续性[^10,^11]、检测空间域特异性标志基因[^12,^13]、挖掘发育与疾病的空间特征[^14,^15]、识别空间域依赖的分子调控网络[^16,^17]等方面发挥了关键作用（见补充说明1）。

尽管近年来已经提出了基于概率图模型和图神经网络（GNNs）等多种识别空间域的计算方法[^18,^19]，但由于所用数据集和评估指标缺乏一致性与全面性，仍面临较大挑战。这些问题的产生原因包括：空间技术快速迭代、部分应用中评估指标过于有限，以及数据往往来自特定实验室基于特定组织和技术生成的数据集（见补充说明2）。

尽管已有一些空间转录组数据的基准评估工作，尤其聚焦于细胞类型识别[^20]，但针对空间聚类方法用于空间域识别的系统性基准研究仍然缺失（见扩展图1）。在本项研究中，我们从四个维度——预测准确性、空间域连续性、空间标志基因识别能力以及方法的可扩展性（详见方法部分）——设定了十项评估指标。需要说明的是，本文中“准确性”一词的含义较传统统计学术语更广，而“数据”（data）指的是来自同一切片的空间转录组数据，“数据集”（dataset）则表示来源于同一篇文献、基于相同技术生成的一组数据。


# SpaGCN
近年来空间转录组技术（SRT）的快速发展，使得我们能够在组织中获取带有空间信息的基因表达谱[^1]。在理解疾病病理过程中，不同细胞在组织中的相对位置尤为关键，因为空间信息有助于揭示细胞基因表达如何受到其周围微环境的影响。

目前常用的空间转录组实验方法大致可分为两类：
第一类是基于原位杂交或测序的技术，具有单细胞分辨率，代表性方法包括 seqFISH[^2,^3]、seqFISH+[^4]、MERFISH[^5,^6]、STARmap[^7] 和 FISSEQ[^8]，它们可在保持组织结构的同时测量数百到上千个基因的表达水平。
第二类是基于原位捕获的技术，通过空间条形码标记并后续进行测序，代表性方法包括 Spatial Transcriptomics（ST）[^9]、SLIDE-seq[^10]、SLIDE-seqV2[^11]、HDST[^12] 以及 10x Visium。这类技术可以在被称为“spot”的捕获位置上检测数千个基因的表达。

这些多样化的SRT技术使得揭示异质性组织中复杂的转录组结构成为可能，也极大地拓展了我们对疾病相关细胞机制的理解[^13,^14]。

在空间转录组研究中，识别“空间域”是一个重要步骤——空间域是指在基因表达和组织形态上都具有空间连续性的区域。传统聚类方法如 K-means 和 Louvain 算法[^15]仅依赖基因表达数据，忽略了空间和组织结构信息，往往会得到不连续或生物学解释性较差的聚类结果。

为了解决这一问题，近年来发展了多种考虑空间依赖性的聚类方法。例如，Zhu 等人[^16]提出了基于隐马尔可夫随机场（HMRF）的模型来捕捉基因表达的空间依赖关系；stLearn[^17] 在聚类前融合了组织学图像特征以及邻近spot的表达信息以归一化数据；BayesSpace[^18] 则通过贝叶斯方法引入物理邻近性作为先验来优化聚类效果。这些方法虽能有效将spot或细胞划分为不同组，但由于在处理不同数据类型（模态）上的灵活性不足，限制了其广泛适用性。随着新一代空间转录组技术不断涌现[^19–^22]，亟需开发更具通用性的方法来适配多种平台。

为了进一步探究空间域的生物学功能，识别在特定空间区域中高表达的基因是至关重要的一步。为此，研究者已开发出多种方法来检测具有空间差异表达的基因（spatially variable genes, SVGs），如 Trendsceek[^23]、SpatialDE[^24] 和 SPARK[^25]。这些方法通常逐个基因独立评估其空间变异性，并通过P值反映其空间表达的显著性。然而，由于这些方法未考虑空间域的整体结构，所筛选出的基因可能缺乏明确的空间表达模式，从而限制了其在后续生物学研究中的应用潜力。

# STAGATE


复杂组织的功能在根本上与不同细胞类型的空间环境密切相关[^1]。组织中转录表达的相对位置对于理解其生物学功能、描述细胞间的交互网络具有重要意义[^2]。近年来，空间转录组（Spatial Transcriptomics, ST）技术取得了突破性进展，如 10x Visium[^3]、Slide-seq[^4,^5]、Stereo-seq[^6] 和 PIXEL-seq[^7] 等，使得我们能够在被称为“spot”的捕获位置上，以数个细胞甚至亚细胞级别的分辨率进行全基因组水平的表达谱分析。

解析空间域（即表达模式相似的区域）是空间转录组研究面临的重要挑战之一。例如，人类大脑皮层的层状结构与其生物学功能密切相关，其中不同皮层层级中的细胞在基因表达、形态结构和生理功能上往往存在显著差异[^8]。然而，多数现有聚类方法未能有效利用空间信息。这些非空间方法大致可分为两类：
第一类是传统聚类算法，如 K-means 和 Louvain 算法[^9]，它们在spot数量较少或数据稀疏时（因ST技术分辨率不同）效果有限，且常导致聚类结果在组织切片中不连续；
第二类方法基于单细胞RNA测序定义的细胞类型特征对spot进行解卷积[^10,^11]，但该类方法并不适用于细胞或亚细胞分辨率的ST数据。

为更好地建模基因表达的空间依赖性，部分近期算法在聚类时引入了邻近spot之间的相似性考虑，从而在脑组织和癌症组织的空间域识别方面取得了显著进展[^12,^13,^14]。
例如，BayesSpace 是一种贝叶斯统计方法，通过在先验中引入空间邻近结构，鼓励相邻spot属于同一聚类[^12]；Giotto 采用隐马尔可夫随机场（HMRF）模型，结合空间邻接信息以识别空间域[^15]；stLearn 利用组织切片图像中提取的形态特征定义“形态距离”，并结合空间邻接结构对基因表达进行平滑处理[^13]；SEDR 则通过深度自动编码器学习基因表达表示，并利用变分图自编码器嵌入空间信息[^14]；SpaGCN 应用了图卷积网络来整合基因表达与空间位置，并通过自监督模块提升空间域识别效果[^16]；此外，新近提出的 RESEPT 方法则借助有监督图像分割方法进行组织结构识别[^17]。

虽然这些方法均考虑了ST的空间结构，但它们所定义的邻近spot间相似性在训练前是固定的，无法自适应学习；同时，这些方法在处理空间域边界处spot之间的空间相似性上考虑不足，亦未能充分整合空间信息对基因表达进行插补与去噪。更重要的是，这些方法无法应用于多张连续切片，进而无法构建三维（3D）ST模型，也无法识别三维空间表达域（详见补充表 S1）。

# BayesSpace

了解转录表达的空间位置可以为生物功能和病理过程提供重要的洞见。单细胞RNA测序（scRNA-seq）虽然可以实现高通量和高分辨率的基因表达谱分析，但由于组织在样本制备过程中被解离，空间信息无法保留。近年来，一些新方法能够在保留空间信息的同时进行高通量的基因表达分析，使得研究可以在生物组织的上下文中进行[^1]。

基于 Spatial Transcriptomics（ST）平台及其改进版 Visium 平台的研究，已经在多个领域产生了新的见解，如肿瘤异质性[^2,^3]、脑功能[^4]以及败血症的病理生理机制[^5]。这些空间基因表达平台的主要技术限制在于分辨率：在ST平台上，观察单位是直径为100 μm的spot，而在Visium平台上为55 μm。因此，在Visium平台的一个spot中，可能包含1至30个细胞，而在老一代ST平台中，这一数量可达200个，具体取决于所研究的组织类型[^6]。

其他替代方法包括荧光原位杂交（FISH）技术，如 seqFISH 和多重误差稳健 FISH（MERFISH），以及最近发展的一些空间测序方法，如 Slide-seq 和 ZipSeq[^7,^8,^9,^10]。尽管这些方法在空间分辨率上有所提高，但它们多数通量较低、灵敏度较差、依赖定制实验方案，或尚未广泛普及。

# MENDER

空间分辨单细胞（SRSC, Spatially Resolved Single-Cell）技术的最新进展，使得在组织环境中对细胞基因表达进行高精度分析成为可能，从而可以全面地刻画各种生物系统的空间特征[^1,^2,^3,^4,^5,^6,^7]。在不同基因表达状态的细胞协同作用下，空间域作为更高阶的功能单元，在组织空间中呈现出规律性的分布，并与组织生理功能密切相关[^8,^9]。在癌症等复杂疾病中，越来越多的证据表明，特定空间域在疾病的诊断与监测中发挥着关键作用[^10,^11,^12]。

随着SRSC数据的不断积累[^13,^14]，众多计算方法被提出以识别这些空间域[^15,^16,^17]。

在典型的SRSC数据集中，每个细胞都被测量了其空间坐标和基因表达谱。这种数据结构天然地构成了一个空间图，其中细胞作为图的节点，基因表达作为节点属性。这一结构促生了该领域的两大主流建模范式：图神经网络（GNN, Graph Neural Network）[^18,^19,^20] 和 贝叶斯网络（BN, Bayesian Network）[^21,^22,^23]。

这两种建模路线的发展，大多数方法都是通过增加模型复杂度来提升性能。GNN方法通常引入了专门的神经模块、损失函数和网络结构；而BN方法则扩展了隐变量、变量之间的依赖关系及先验知识。虽然模型复杂度的提升往往带来性能的增强，但近年来的一些研究显示，这种提升正呈现出边际收益递减的趋势[^24]。

此外，模型的复杂性还可能带来如下问题：参数调整困难、时间效率低、泛化能力下降。因此，这些挑战共同呼唤一种新的建模范式，以突破当前领域的发展瓶颈。

我们首先解释为何在已有众多方法的前提下，仍然需要一种新的空间域识别方法。我们选取了近两年发表的8种现有方法，并从6个评估维度进行比较，包括：是否支持多切片分析、稳定性、可解释性、可扩展性、运行速度，以及是否能输出细胞上下文表示（见补充图1A）。每个评估维度的简要定义见补充图1A，详细说明见“方法”部分中“从六个方面评估现有方法”章节。

这8种方法包括4种基于图神经网络（GNN）的模型（SpaGCN[^18]、STAGATE[^19]、CCST[^25] 和 SpaceFlow[^20]），以及4种基于贝叶斯网络（BN）的模型（BayesSpace[^21]、BASS[^23]、SpatialPCA[^26] 和 SOTIP[^27]）。

从结果中可以看到，多数评估指标与方法的基本原理密切相关（见补充图1A）。所有GNN类方法在可扩展性和运行速度（在使用GPU的前提下）方面表现更好，并且能够输出细胞的上下文表示。但这类方法也继承了深度学习模型普遍存在的缺陷：稳定性差、可解释性不足。相较之下，BN类方法在输出结果的稳定性和可解释性上更具优势，因为它们通常构建在明确的概率变量依赖关系上。然而，这类方法往往无法很好地适配大规模数据集，运行时间较长，且通常不能输出细胞上下文表示（SpatialPCA[^26] 是个例外）。

这些评估结果不仅被我们在本文中的基准测试所验证，也得到了近期相关研究[^20,^23]的支持。

特别地，在空间组学迈入“大数据时代”的背景下，上述某些指标变得尤为关键。目前，许多大型科研合作项目已生成了包含上百万个细胞、跨多个切片的大规模空间组学数据集[^28,^29,^30]。在这种情境下，方法的可扩展性、运行效率和对多切片分析的支持变得格外重要。

因此，尽管现有空间域识别方法种类繁多，仍然需要新的创新方法，以尽可能满足上述关键评估标准。

组织内多种细胞类型复杂的空间组织结构，对于理解其生物学功能和病理状态至关重要。近年来，空间转录组学（Spatially Resolved Transcriptomics, SRT）技术取得了显著进展，如 10x Visium 等平台，通过原位测序大幅提升了我们在转录组水平上绘制组织结构和细胞间相互作用图谱的能力[^1–4]。在分析空间转录组数据时，一个关键任务是将测点（spot）准确划分到空间域（spatial domain）中，这些空间域通常在基因表达模式和组织学结构上具有一致性。对复杂组织区域的准确划分对后续分析具有重要意义，例如识别空间变异基因（Spatially Variable Genes, SVGs）[^5]、解析组织异质性[^6]，以及**探索细胞-细胞间相互作用[^7]**等。
# EnSDD
当前的空间域检测（Spatial Domain Detection, SDD）方法大致可分为非空间聚类方法与空间聚类方法。传统的非空间聚类方法，如 K-means 和 Louvain 算法[^8]，仅利用基因表达数据，常常导致聚类结果在空间上不连贯。相比之下，空间聚类方法（如 BayesSpace[^9]、DR-SC[^10]、GraphST[^11] 和 STAGATE[^12]）在分析中引入了 SRT 数据的空间坐标，从而考虑基因表达的空间依赖性。这些方法通常会根据基因表达和空间位置对相邻 spot 进行联合聚类，通过不同的空间邻域建模策略来捕捉空间关系。虽然这些方法在脑组织和癌症组织中表现出显著优势[^12]，但它们往往忽略了组织学图像中蕴含的形态学信息，这可能导致划分出的空间域与真实组织结构不一致[^13]。

为了解决这一问题，出现了一类融合多模态信息的方法，如 SpaGCN[^13]、stLearn[^14]、SiGra[^15] 和 spaVAE[^16]，它们将基因表达、空间坐标和组织学图像等多种信息结合，通过学习相邻 spot 间的空间依赖关系，从而在表达和形态学两方面都实现连续一致的空间域检测。

由于各类空间聚类方法在假设和数据依赖方面存在差异，它们在划分空间域时产生的结果也存在差异[^17]。具体方法的效果还会受到组织复杂程度的影响[^18]，这也增加了在新数据集中选择合适方法的难度。一个应对策略是开发集成方法（ensemble methods），通过整合多个基础方法的结果提高稳健性[^19]。然而，集成方法也面临两个主要挑战：（i）不同基础方法可能生成不同数量和类型的空间域，使得结果整合变得复杂；（ii）方法性能在不同数据集间表现不一致，难以自动评估并融合各方法的效果。
