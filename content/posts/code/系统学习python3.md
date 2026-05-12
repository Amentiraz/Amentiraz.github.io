---
title: 系统学习python（三）对于Anndata的整理
date: 2025-05-04 16:51:40
tags:
- python 
- 学习笔记
categories:
- [代码,python]
---
接着上文继续学习Anndata的相关语法,[参考网页](https://anndata.readthedocs.io/en/latest/tutorials/notebooks/getting-started.html)

<!--more-->

`AnnData` is specifically designed for matrix-like data. By this we mean that we have `n`observations, each of which can be represented as `d`-dimensional vectors, where each dimension corresponds to a variable or feature. Both the rows and columns of this $n \times d$ matrix are special in the sense that they are indexed.

For instance, in scRNA-seq data, each row corresponds to a cell with a barcode, and each column corresponds to a gene with a gene id. Furthermore, for each cell and each gene we might have additional metadata, like (1) donor information for each cell, or (2) alternative gene symbols for each gene.

# Initializing AnnData

```python
counts = csr_matrix(np.random.poisson(1, size=(100, 2000)), dtype=np.float32)
# 生成一个参数为1的泊松分布的稀疏矩阵
adata = ad.AnnData(counts)
print(adata)

adata.obs_names = [f"Cell_{i:d}" for i in range(adata.n_obs)]
adata.var_names = [f"Gene_{i:d}" for i in range(adata.n_vars)]
print(adata.obs_names)

print(adata[["Cell_1", "Cell_10"], ["Gene_5", "Gene_1900"]])
```

# Adding aligned metadata

```python
ct = np.random.choice(["B", "T", "Monocyte"], size=(adata.n_obs))
adata.obs["cell_type"] = pd.Categorical(ct)
print(adata.obs)

bdata = adata[adata.obs.cell_type == "B"]
print(bdata)
```

# Observation / variable-level matrices 
We might also have metadata at either level that has many dimensions to it, such as a `UMAP` embedding of the data. For this type of metadata, AnnData has the `.obsm/.varm` attributes. We use keys to identify the different matrices we insert. The restriction of `.obsm/.varm` are that `.obsm` matrices must length equal to the number of observations as .n_obs and `.varm` matrices must length equal to `.n_vars`. They can each independently have different number of dimensions.
```python
adata.obsm["X_umap"] = np.random.normal(0,1,size=(adata.n_obs,2))
adata.varm["gene_stuff"] = np.random.normal(0,1,size=(adata.n_vars,5))
print(adata)
```

A few more notes about `.obsm/.varm`

- The “array-like” metadata can originate from a Pandas DataFrame, scipy sparse matrix, or numpy dense array.

- When using scanpy, their values (columns) are not easily plotted, where instead items from .obs are easily plotted on, e.g., UMAP plots.

# Unstructured metadata
AnnData has `.uns`, which allows for any unstructured metadata. This can be anything, like a list or a dictionary with some general information that was useful in the analysis of our data.

```python
adata.uns["random"] = [1, 2, 3]
adata.uns
```

# Layers
Finally, we may have different forms of our original core data, perhaps one that is normalized and one that is not. These can be stored in different layers in AnnData. For example, let’s log transform the original data and store it in a layer:

# Conversion to DataFrame
We can also ask AnnData to return us a DataFrame from one of the layers:
```python
adata.to_df(layer="log_transformed")
```
We see that the .obs_names/.var_names are used in the creation of this Pandas object.

# Writing the results to disk 
AnnData comes with its own persistent HDF5-based file format: h5ad. If string columns with small number of categories aren’t yet categoricals, AnnData will auto-transform to categoricals.

```python
adata.write('my_results.h5ad', compression="gzip")
```

# Views and copies 
Imagine that the observations come from instruments characterizing 10 readouts in a multi-year study with samples taken from different subjects at different sites. We’d typically get that information in some format and then store it in a DataFrame:

```python
obs_meta = pd.DataFrame({
        'time_yr': np.random.choice([0, 2, 4, 8], adata.n_obs),
        'subject_id': np.random.choice(['subject 1', 'subject 2', 'subject 4', 'subject 8'], adata.n_obs),
        'instrument_type': np.random.choice(['type a', 'type b'], adata.n_obs),
        'site': np.random.choice(['site x', 'site y'], adata.n_obs),
    },
    index=adata.obs.index,    # these are the same IDs of observations as above!
)
```

This is how we join the readout data with the metadata. Of course, the first argument of the following call for X could also just be a DataFrame.

```python
adata = ad.AnnData(adata.X, obs=obs_meta, var=adata.var)
```

```python
# View
adata[:5, ["Gene_1", "Gene_3"]]
# .toarray()表示转换为稠密的 NumPy数组，.tolist()表示转换成Python列表，方便查看
print(adata[:3, "Gene_1"].X.toarray().tolist())
print(adata[:3, "Gene_1"].X.toarray())
adata[:3, "Gene_1"].X = [0, 0, 0]
print(adata[:3, "Gene_1"].X.toarray().tolist())
# Copy
adata_subset = adata[:5, ["Gene_1", "Gene_3"]].copy()

```

# Partial reading of large data
If a single `.h5ad` is very large, you can partially read it into memory by using backed mode:
```python 
adata = ad.read('my_results.h5ad', backed='r')
adata.isbacked
```

If you do this, you’ll need to remember that the AnnData object has an open connection to the file used for reading:
```python
adata.filename
PosixPath('my_results.h5ad')
```

As we’re using it in read-only mode, we can’t damage anything. To proceed with this tutorial, we still need to explicitly close it:
```python 
adata.file.close()
```
As usual, you should rather use with statements to avoid dangling open files (up-coming feature).

Manipulating the object on disk is possible, but experimental for sparse data. Hence, we leave it out of this tutorial.

上面包含了一些非常基础的操作，考虑到时间关系和后面的内容有些难，我先去学习一下scanpy的操作流程
