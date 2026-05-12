---
title: scanpy数据使用笔记
date: 2024-12-06 10:40:37
tags:
- 生物
- 学习笔记类
categories:
- [论文,数据]
---
Scanpy 是一个专门用于单细胞 RNA 测序 (scRNA-seq) 数据分析的 Python 库，它的核心数据结构是 `AnnData`（Annotated Data）。了解 `AnnData` 数据类型是使用 Scanpy 的关键。以下是对 `AnnData` 的详细介绍：

---

### **1. `AnnData` 的结构**
`AnnData` 是一种基于矩阵的数据结构，专为处理大规模高维数据设计。它将表达矩阵和注释信息结合起来，支持存储和处理实验数据的多个层面。

**核心组成部分：**
- **`X` (主矩阵)**：存储主要的数据，例如基因表达矩阵。
  - 数据类型：通常是 NumPy 数组 (`numpy.ndarray`) 或稀疏矩阵 (`scipy.sparse`)，以节省内存。
  - 维度：形状为 `(n_obs, n_vars)`，即细胞数 × 基因数。
  
- **`obs` (观测样本注释)**：存储细胞的元数据。
  - 类型：`pandas.DataFrame`
  - 行：对应细胞，列：存储细胞的注释信息（如细胞类型、实验条件等）。

- **`var` (变量注释)**：存储基因的元数据。
  - 类型：`pandas.DataFrame`
  - 行：对应基因，列：存储基因的注释信息（如基因名称、功能分类等）。

- **`obsm` (观测样本多维数据)**：存储额外的细胞数据，例如降维结果（如 PCA、t-SNE 或 UMAP）。
  - 类型：字典，值通常是 NumPy 数组或稀疏矩阵。

- **`varm` (变量多维数据)**：存储额外的基因数据，例如 PCA 的基因负载矩阵。
  - 类型：字典。

- **`uns` (未分类信息)**：存储任意未分类的附加信息，例如绘图参数或聚类结果的元数据。
  - 类型：字典。

- **`layers`**：支持存储多个版本的主矩阵 `X`，例如原始数据、归一化数据、去噪数据等。
  - 类型：字典，键为层的名称，值为矩阵。

---

### **2. 示例结构**

```python
import scanpy as sc
import numpy as np
import pandas as pd

# 创建一个简单的 AnnData 对象
X = np.random.rand(5, 3)  # 5 个细胞 × 3 个基因
obs = pd.DataFrame(index=["cell1", "cell2", "cell3", "cell4", "cell5"])
obs["group"] = ["A", "A", "B", "B", "C"]  # 每个细胞的分组信息
var = pd.DataFrame(index=["gene1", "gene2", "gene3"])
var["type"] = ["TF", "TF", "Enzyme"]  # 每个基因的类型信息

adata = sc.AnnData(X, obs=obs, var=var)

# 查看 AnnData 的基本信息
print(adata)
```

输出结果：
```
AnnData object with n_obs × n_vars = 5 × 3
    obs: 'group'
    var: 'type'
```

---

### **3. 常用方法**

- **数据访问与修改：**
  ```python
  adata.X           # 主矩阵数据
  adata.obs         # 细胞注释
  adata.var         # 基因注释
  adata.obsm        # 多维细胞数据（降维结果等）
  adata.layers["raw"] = adata.X.copy()  # 创建新数据层
  ```

- **读写文件：**
  ```python
  adata.write("data.h5ad")  # 保存到文件
  adata = sc.read("data.h5ad")  # 从文件加载
  ```

- **数据筛选：**
  ```python
  adata = adata[adata.obs["group"] == "A", :]  # 筛选分组为 A 的细胞
  ```

---

### **4. 使用场景**

1. **降维分析**：`obsm` 中存储 PCA、t-SNE 或 UMAP 的结果。
2. **细胞聚类**：`obs` 中存储聚类标签。
3. **基因功能注释**：`var` 中存储基因相关信息。
4. **可视化**：通过 `uns` 传递绘图参数。

---

### **5. 优势**
- **高效内存管理**：支持稀疏矩阵存储大规模数据。
- **灵活性强**：便于同时存储多种数据层和分析结果。
- **兼容性好**：与 NumPy、Pandas 和其他生物信息学工具协作性强。

# 使用实例

后面记录一下自己遇到的处理scanpy数据的python代码


----

```python
adata.obs[obs_name].cat.categories
```
这个返回的是`adata.obs`指定列:`obs_name`的所有类别值

`.cat`意味着我们可以访问与分类相关的操作和属性

`.categories`返回这一列所有类别值（唯一值）

-----

```python
spatialmat = adata.obsm['spatial']
cur_distmat = squareform(pdist(spatialmat))
```
这里的`adata.obsm['spatial']`表示的是一个n_cell * dimension的数据，表示它的空间距离

`pdist` 返回长度为 `n_cells * (n_cells - 1) / 2` 的一维数组。目的是计算`spatialmat`中所有点两两之间的欧氏距离

`squareform`将`pdist`的数据转换成方阵的形式，也就是距离矩阵`n_cells*n_cells`

---
这段代码使用了 Squidpy 的功能来计算空间邻居关系，涉及构建空间图（spatial graph），它是 Squidpy 的核心工具之一，用于分析空间转录组数据的空间关系。让我们逐步解析每个参数和方法的作用。


### **1. 方法介绍**
`sq.gr.spatial_neighbors()` 是 Squidpy 提供的函数，用于基于空间坐标计算邻接关系（spatial neighbors）。它会在 `AnnData` 对象中添加与邻接关系相关的信息，通常用于后续的图分析和空间分析。

#### **调用语法**
```python
sq.gr.spatial_neighbors(
    adata, 
    coord_type="generic", 
    n_neighs=6, 
    radius=None, 
    delaunay=True, 
    key_added="spatial_neighbors", 
    set_diag=False
)
```


### **2. 参数解析**

#### **`adata_tmp`**
- 输入的 `AnnData` 对象。
- 包含细胞的空间坐标，通常存储在 `adata_tmp.obsm['spatial']` 中。

#### **`coord_type='generic'`**
- 指定空间坐标的类型。  
  - `'generic'`：使用任意空间坐标。
  - `'grid'`：适用于规则网格数据。
  - `'visium'`：专门用于 10x Genomics Visium 数据。
- **作用**：告诉函数如何解释 `adata.obsm['spatial']` 中的坐标。

#### **`n_neighs=self.nn_para+cur_scale`**
- 指定每个点的邻居数。
- 具体值是 `self.nn_para`（一个基准邻居数）加上 `cur_scale`（可能是一个动态调整的值）。
- **作用**：决定空间图中每个点将连接多少个邻居。

#### **`set_diag=self.include_self`**
- 控制邻接矩阵是否设置对角线为 1（即点是否与自己相连）。
- 如果 `self.include_self=True`，邻接矩阵的对角线值会被设置为 1。


### **3. 函数的主要功能**
- **输入：**
  1. 空间坐标：来自 `adata.obsm['spatial']`。
  2. 邻居数、对角线选项等配置。
  
- **处理：**
  1. 根据空间坐标构建 K 邻居图或基于 Delaunay 三角剖分的邻居关系图。
  2. 生成邻接矩阵并存储到 `AnnData` 对象中。

- **输出：**
  1. 在 `adata_tmp.uns` 中添加邻接关系的元数据（默认键为 `'spatial_neighbors'`）。
  2. 在 `adata_tmp.obsp` 中添加稀疏邻接矩阵（默认键为 `'spatial_distances'` 和 `'spatial_connectivities'`）。

### **4. 工作原理**
- **邻接图构建：**
  - 如果 `n_neighs` 被指定，会使用 K-邻居算法。
  - 如果没有指定 `n_neighs`，默认使用 Delaunay 三角剖分算法构建邻接图。

- **稀疏矩阵生成：**
  - `spatial_distances`：存储点之间的距离（欧氏距离）。
  - `spatial_connectivities`：存储点之间的连接权重（默认是 0 或 1，表示是否连接）。


### **5. 示例**
```python
import squidpy as sq
import scanpy as sc

# 创建一个 AnnData 对象并添加空间坐标
adata_tmp = sc.AnnData()
adata_tmp.obsm['spatial'] = [[0, 0], [0, 1], [1, 0], [1, 1]]

# 使用 spatial_neighbors 计算邻接图
sq.gr.spatial_neighbors(adata_tmp, coord_type='generic', n_neighs=2, set_diag=True)

# 查看结果
print(adata_tmp.obsp['spatial_connectivities'].toarray())  # 稀疏连接矩阵
print(adata_tmp.uns['spatial_neighbors'])  # 元数据信息
```

输出可能类似：
```
[[1. 1. 1. 0.]
 [1. 1. 0. 1.]
 [1. 0. 1. 1.]
 [0. 1. 1. 1.]]
{'n_neighs': 2, 'coord_type': 'generic', 'params': {...}}
```

---

Scanpy 是一个用于单细胞转录组数据分析的 Python 包，它集成了多种功能，涵盖了数据的预处理、降维、聚类、差异基因分析以及可视化等多种步骤。以下是一些常用的函数及其用途。

---

### **1. 数据读取和保存**
#### **1.1 `sc.read()`**
- 用于读取 `.h5ad` 格式的 AnnData 文件。
- 示例：
  ```python
  import scanpy as sc
  adata = sc.read('example.h5ad')
  ```

#### **1.2 `sc.read_10x_mtx()`**
- 读取 10x Genomics 数据（稀疏矩阵格式）。
- 示例：
  ```python
  adata = sc.read_10x_mtx('filtered_feature_bc_matrix/')
  ```

#### **1.3 `adata.write()`**
- 保存 AnnData 对象到文件。
- 示例：
  ```python
  adata.write('output.h5ad')
  ```

---

### **2. 数据预处理**
#### **2.1 `sc.pp.filter_cells()` 和 `sc.pp.filter_genes()`**
- 按细胞或基因的特定条件过滤。
- 示例：去除少于 200 个基因表达的细胞：
  ```python
  sc.pp.filter_cells(adata, min_genes=200)
  ```

#### **2.2 `sc.pp.normalize_total()`**
- 对数据进行归一化，使每个细胞的总表达量相同。
- 示例：
  ```python
  sc.pp.normalize_total(adata, target_sum=1e4)
  ```

#### **2.3 `sc.pp.log1p()`**
- 对归一化数据取对数变换。
- 示例：
  ```python
  sc.pp.log1p(adata)
  ```

#### **2.4 `sc.pp.highly_variable_genes()`**
- 筛选高变异基因。
- 示例：
  ```python
  sc.pp.highly_variable_genes(adata, n_top_genes=2000)
  ```

#### **2.5 `sc.pp.scale()`**
- 标准化每个基因，使其均值为 0、标准差为 1。
- 示例：
  ```python
  sc.pp.scale(adata)
  ```

---

### **3. 降维**
#### **3.1 `sc.pp.pca()`**
- 进行主成分分析（PCA）。
- 示例：
  ```python
  sc.pp.pca(adata, n_comps=50)
  ```

#### **3.2 `sc.tl.tsne()`**
- 进行 t-SNE 分析。
- 示例：
  ```python
  sc.tl.tsne(adata)
  ```

#### **3.3 `sc.tl.umap()`**
- 计算 UMAP（常用的降维可视化方法）。
- 示例：
  ```python
  sc.pp.neighbors(adata)  # 先构建邻居图
  sc.tl.umap(adata)
  ```

---

### **4. 聚类**
#### **4.1 `sc.tl.leiden()`**
- Leiden 聚类算法。
- 示例：
  ```python
  sc.tl.leiden(adata, resolution=0.5)
  ```

#### **4.2 `sc.tl.louvain()`**
- Louvain 聚类算法。
- 示例：
  ```python
  sc.tl.louvain(adata, resolution=0.5)
  ```

---

### **5. 差异表达分析**
#### **5.1 `sc.tl.rank_genes_groups()`**
- 对聚类的分组进行差异表达分析。
- 示例：
  ```python
  sc.tl.rank_genes_groups(adata, groupby='leiden', method='t-test')
  ```

#### **5.2 `sc.pl.rank_genes_groups()`**
- 可视化差异基因分析结果。
- 示例：
  ```python
  sc.pl.rank_genes_groups(adata, n_genes=10)
  ```

---

### **6. 可视化**
#### **6.1 `sc.pl.pca()`**
- PCA 结果可视化。
- 示例：
  ```python
  sc.pl.pca(adata, color='leiden')
  ```

#### **6.2 `sc.pl.umap()`**
- UMAP 结果可视化。
- 示例：
  ```python
  sc.pl.umap(adata, color='leiden')
  ```

#### **6.3 `sc.pl.tsne()`**
- t-SNE 结果可视化。
- 示例：
  ```python
  sc.pl.tsne(adata, color='leiden')
  ```

#### **6.4 `sc.pl.heatmap()`**
- 绘制热图，显示差异基因在各组中的表达情况。
- 示例：
  ```python
  sc.pl.heatmap(adata, var_names=['gene1', 'gene2'], groupby='leiden')
  ```

#### **6.5 `sc.pl.stacked_violin()`**
- 绘制分组基因表达的堆叠小提琴图。
- 示例：
  ```python
  sc.pl.stacked_violin(adata, var_names=['gene1', 'gene2'], groupby='leiden')
  ```

---

### **7. 计算基因集评分**
#### **7.1 `sc.tl.score_genes()`**
- 为指定基因集计算评分。
- 示例：
  ```python
  sc.tl.score_genes(adata, gene_list=['Gene1', 'Gene2'], score_name='Gene_Score')
  ```

#### **7.2 `sc.tl.score_genes_cell_cycle()`**
- 计算细胞周期评分。
- 示例：
  ```python
  sc.tl.score_genes_cell_cycle(adata, s_genes=your_s_genes, g2m_genes=your_g2m_genes)
  ```

---

### **8. 扩展功能**
#### **8.1 数据整合**
- 使用 `sc.pp.bbknn()` 或 `sc.external.pp.harmony_integrate()` 实现跨批次数据整合。

#### **8.2 可视化空间数据**
- 如果处理空间转录组数据，可以用 `squidpy`（与 Scanpy 兼容）实现更高级的空间可视化。
