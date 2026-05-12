---
title: 系统学习python（四）对于Scanpy的整理 
date: 2025-05-05 11:20:06
tags:
- python 
- 学习笔记
categories:
- [代码,python]
---
接着上文继续学习Scanpy的相关语法 ，[参考网页](https://scanpy-tutorials.readthedocs.io/en/latest/basic-scrna-tutorial.html)
<!--more-->


# Preprocessing and clustering 

```python 
import scanpy as sc
import anndata as ad

sc.settings.set_figure_params(dpi=50, facecolor="white")

# EXAMPLE_DATA = pooch.create(
#    path=pooch.os_cache("scverse_tutorials"),
#    base_url="doi:10.6084/m9.figshare.22716739.v1/",
# )
# EXAMPLE_DATA.load_registry_from_doi()

samples = {
    "s1d1": "D:\\articleCode\\research\\s1d1_filtered_feature_bc_matrix.h5",
    "s1d3": "D:\\articleCode\\research\\s1d3_filtered_feature_bc_matrix.h5",
}
adatas = {}

for sample_id, path in samples.items():
    sample_adata = sc.read_10x_h5(path)
    sample_adata.var_names_make_unique()
    print(sample_adata)
    adatas[sample_id] = sample_adata

adata = ad.concat(adatas, label="sample")
adata.obs_names_make_unique()
print(adata.obs["sample"].value_counts())
print(adata)
```


