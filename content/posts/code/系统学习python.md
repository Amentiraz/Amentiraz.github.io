---
title: 系统学习python(一）对于NumPy的整理
date: 2025-05-02 15:59:00
tags:
- python 
- 学习笔记 
categories:
- [代码,python]
---
重新系统学习一下python

<!--more-->

首先我们对于AnnData的结构进行回顾


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


# NumPy
然后我们发现我们并没有系统的学习过Numpy是个什么东西，这里我们补充一下相关的知识。

这里我们根据RUNOOB上的教程进行补充学习。

## NumPy ndarray对象
NumPy 最重要的一个特点是其 N 维数组对象 ndarray，它是一系列同类型数据的集合，以 0 下标为开始进行集合中元素的索引。

ndarray 对象是用于存放同类型元素的多维数组。

ndarray 中的每个元素在内存中都有相同存储大小的区域。

ndarray 内部由以下内容组成：

一个指向数据（内存或内存映射文件中的一块数据）的指针。

数据类型或 dtype，描述在数组中的固定大小值的格子。

一个表示数组形状（shape）的元组，表示各维度大小的元组。

一个跨度元组（stride），其中的整数指的是为了前进到当前维度下一个元素需要"跨过"的字节数。

创建一个ndarray只需调用NumPy的array函数即可：

```pythoj

numpy.array(object, dtype = None, copy = True, order = None, subok = False, ndmin = 0)
```

- object表示数组或嵌套的数列
- dtype表示数组元素的数据类型
- copy表示对象是否需要复制
- order表示创建数组的样式，C为行方向，F为列方向，A为任意方向(默认)
- subok 默认返回一个与积累类型一致的数组
- ndmin 指定生成数组的最小维度

```python
import numpy as np

a = np.array([1, 2, 3])
print(a)

b = np.array([[1, 2], [3, 4]])
print(b)

c = np.array([1, 2, 3, 4, 5], ndmin=2)
print(c)

d = np.array([1, 2, 3], dtype=complex)
print(d)
```


## NumPy 数据类型
下表列举了常用的NumPy的基本类型
|名称|描述|
|----|----|
|bool|略|
|int|...|
|float|...|
|complex|...|

数据类型对象（numpy.dtype 类的实例）用来描述与数组对应的内存区域是如何使用，它描述了数据的以下几个方面：：

数据的类型（整数，浮点数或者 Python 对象）
数据的大小（例如， 整数使用多少个字节存储）
数据的字节顺序（小端法或大端法）
在结构化类型的情况下，字段的名称、每个字段的数据类型和每个字段所取的内存块的部分
如果数据类型是子数组，那么它的形状和数据类型是什么。
字节顺序是通过对数据类型预先设定 < 或 > 来决定的。 < 意味着小端法(最小值存储在最小的地址，即低位组放在最前面)。> 意味着大端法(最重要的字节存储在最小的地址，即高位组放在最前面)。

dtype 对象是使用以下语法构造的：

```python 
numpy.dtype(object, align, copy)
```

object - 要转换为的数据类型对象
align - 如果为 true，填充字段使其类似 C 的结构体。
copy - 复制 dtype 对象 ，如果为 false，则是对内置数据类型对象的引用

```python
import numpy as np

dt = np.dtype(np.int8)
print(dt)

# 结构化数据类型
dt = np.dtype([("age", np.int8)])
a = np.array([(10,), (20,), (30,)], dtype=dt)
print(a)

print(a["age"])

student = np.dtype([("name", "S20"), ("age", "i4"), ("marks", "f4")])
print(student)
b = np.array([("abc", 21, 50), ("xyz", 18, 75)], dtype=student)
print(b)
```


|字符|对应类型|
|---|---|
|b|布尔型|
|i|有符号整形|
|u|无符号整形integer|
|f|浮点型|
|c|复数浮点型|
|m|timedelta|
|M|datatime|
|O|（python）对象|
|S，a|（byte-）字符串|
|U|Unicode|
|V|原始数据（void)|


# 数组属性 
NumPy 数组的维数称为秩（rank），秩就是轴的数量，即数组的维度，一维数组的秩为 1，二维数组的秩为 2，以此类推。

在 NumPy中，每一个线性的数组称为是一个轴（axis），也就是维度（dimensions）。比如说，二维数组相当于是两个一维数组，其中第一个一维数组中每个元素又是一个一维数组。所以一维数组就是 NumPy 中的轴（axis），第一个轴相当于是底层数组，第二个轴是底层数组里的数组。而轴的数量——秩，就是数组的维数。

很多时候可以声明 axis。axis=0，表示沿着第 0 轴进行操作，即对每一列进行操作；axis=1，表示沿着第1轴进行操作，即对每一行进行操作。

NumPy 的数组中比较重要 ndarray 对象属性有：


|属性	|说明|
|----|----|
|ndarray.ndim	|数组的秩（rank），即数组的维度数量或轴的数量。|
|ndarray.shape| 	数组的维度，表示数组在每个轴上的大小。对于二维数组（矩阵），表示其行数和列数。|
|ndarray.size| 	数组中元素的总个数，等于 ndarray.shape 中各个轴上大小的乘积。|
|ndarray.dtype	|数组中元素的数据类型。|
|ndarray.itemsize	|数组中每个元素的大小，以字节为单位。|
|ndarray.flags | 	包含有关内存布局的信息，如是否为 C 或 Fortran 连续存储，是否为只读等。|
|ndarray.real	|数组中每个元素的实部（如果元素类型为复数）。|
|ndarray.imag	 |数组中每个元素的虚部（如果元素类型为复数）。|
|ndarray.data | 	实际存储数组元素的缓冲区，一般通过索引访问元素，不直接使用该属性。|


ndarray.flags 返回 ndarray 对象的内存信息，包含以下属性：



|属性	|描述|
|----|----|
|C_CONTIGUOUS (C)| 	数据是在一个单一的C风格的连续段中|
|F_CONTIGUOUS (F)	|数据是在一个单一的Fortran风格的连续段中|
|OWNDATA (O)	|数组拥有它所使用的内存或从另一个对象中借用它|
|WRITEABLE (W)	|数据区域可以被写入，将该值设置为 False，则数据为只读|
|ALIGNED (A)	|数据和所有元素都适当地对齐到硬件上|
|UPDATEIFCOPY (U)| 	这个数组是其它数组的一个副本，当这个数组被释放时，原数组的内容将被更新|


```python
import numpy as np

a = np.arange(24)
print(a)
print(a.ndim)
b = a.reshape(2, 4, 3)
print(b)
print(b.ndim)

c = np.array([[1, 2, 3], [4, 5, 6]])
print(c.shape)

d = np.array([[1, 2, 3], [4, 5, 6]])
d.shape = (3, 2)
print(d)

x = np.array([1, 2, 3, 4, 5], dtype=np.int8)
print(x.itemsize)

x = np.array([1, 2, 3, 4, 5])
print(x.flags)
```


## 创建数组 
numpy.empty 方法用来创建一个指定形状（shape）、数据类型（dtype）且未初始化的数组：
```python
numpy.empty(shape, dtype = float, order = 'C')
```

```python
import numpy as np 
x = np.empty([3,2], dtype = int) 
print (x)
```

numpy.zeros
创建指定大小的数组，数组元素以 0 来填充：

```python
numpy.zeros(shape, dtype = float, order = 'C')
```numpy.ones_like
numpy.ones_like 用于创建一个与给定数组具有相同形状的数组，数组元素以 1 来填充。

numpy.ones 和 numpy.ones_like 都是用于创建一个指定形状的数组，其中所有元素都是 1。

它们之间的区别在于：numpy.ones 可以直接指定要创建的数组的形状，而 numpy.ones_like 则是创建一个与给定数组具有相同形状的数组。

numpy.ones
创建指定形状的数组，数组元素以 1 来填充：

```python
numpy.ones(shape, dtype = None, order = 'C')
```
numpy.zeros_like 用于创建一个与给定数组具有相同形状的数组，数组元素以 0 来填充。

numpy.zeros 和 numpy.zeros_like 都是用于创建一个指定形状的数组，其中所有元素都是 0。

它们之间的区别在于：numpy.zeros 可以直接指定要创建的数组的形状，而 numpy.zeros_like 则是创建一个与给定数组具有相同形状的数组。
```python
numpy.zeros_like(a, dtype=None, order='K', subok=True, shape=None)
```

numpy.ones_like
numpy.ones_like 用于创建一个与给定数组具有相同形状的数组，数组元素以 1 来填充。

numpy.ones 和 numpy.ones_like 都是用于创建一个指定形状的数组，其中所有元素都是 1。

它们之间的区别在于：numpy.ones 可以直接指定要创建的数组的形状，而 numpy.ones_like 则是创建一个与给定数组具有相同形状的数组。

## 从数值范围创建数组

```python
numpy.arange(start, stop, step, dtype)
```


numpy.linspace 函数用于创建一个一维数组，数组是一个等差数列构成的，格式如下：

```python
np.linspace(start, stop, num=50, endpoint=True, retstep=False, dtype=None)
```


|参数	|描述|
|---|---|
|start	|序列的起始值|
|stop	|序列的终止值，如果endpoint为true，该值包含于数列中|
|num	|要生成的等步长的样本数量，默认为50|
|endpoint	|该值为 true 时，数列中包含stop值，反之不包含，默认是True。|
|retstep	|如果为 True 时，生成的数组中会显示间距，反之不显示。|
|dtype| 	ndarray 的数据类型|

numpy.logspace 函数用于创建一个于等比数列。格式如下：
```python
np.logspace(start, stop, num=50, endpoint=True, base=10.0, dtype=None)
```
base 参数意思是取对数的时候 log 的下标。


## 引索与切片

冒号 : 的解释：如果只放置一个参数，如 [2]，将返回与该索引相对应的单个元素。如果为 [2:]，表示从该索引开始以后的所有项都将被提取。如果使用了两个参数，如 [2:7]，那么则提取两个索引(不包括停止索引)之间的项。

```python
import numpy as np

a = np.arange(10)
s = slice(2, 7, 2)
print(a[s])

b = np.arange(10)
c = b[2:7:2]
print(c)

d = np.arange(10)
print(d[2:])

e = np.array([[1, 2, 3], [3, 4, 5], [4, 5, 6]])
print(e)
print("从数组引索a[1:]处开始切割")
print(e[1:])

f = e.copy()
print(f)
print(f[..., 1])  # 第二列元素
print(f[1, ...])  # 第二列元素
print(f[..., 1:])
```

## 高级引索

整数数组索引是指使用一个数组来访问另一个数组的元素。这个数组中的每个元素都是目标数组中某个维度上的索引值。

以下实例获取数组中 (0,0)，(1,1) 和 (2,0) 位置处的元素。
```python
import numpy as np 
 
x = np.array([[1,  2],  [3,  4],  [5,  6]]) 
y = x[[0,1,2],  [0,1,0]]  
print (y)
```

```python
import numpy as np

x = np.array([[1, 2], [3, 4], [5, 6]])
y = x[[0, 1, 2], [0, 1, 0]]
print(y)

x = np.array([[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11]])
print(x)
print("\n")
rows = np.array([[0, 0], [3, 3]])
cols = np.array([[0, 2], [0, 2]])
y = x[rows, cols]
print(y)

a = np.array([[1, 2, 3], [4, 5, 6], [7, 8, 9]])
b = a[1:3, 1:3]
c = a[1:3, [1, 2]]
d = a[..., 1:]
print(b)
print(c)
print(d)


x = np.array([[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11]])
print("x:")
print(x)
print("\n")
print("x>5")
print(x[x > 5])


a = np.array([np.nan, 1, 2, np.nan, 3, 4, 5])
print(a[~np.isnan(a)])

a = np.array([1, 2 + 6j, 5, 3.5 + 5j])
print(a[np.iscomplex(a)])

x = np.arange(9)
print("---------------------")
print(x)
x2 = x[[0, 6]]
print(x2)
print(x2[0])
print(x2[1])

x = np.arange(32).reshape((8, 4))
print(x)
print("读取下标对应的行")
print(x[[4, 2, 1, 7]])
print("倒序索引")
print(x[[-4, -2, -1, -7]])
```

## 广播
广播(Broadcast)是 numpy 对不同形状(shape)的数组进行数值计算的方式， 对数组的算术运算通常在相应的元素上进行。

如果两个数组 a 和 b 形状相同，即满足 a.shape == b.shape，那么 a*b 的结果就是 a 与 b 数组对应位相乘。这要求维数相同，且各维度的长度相同。

```python
import numpy as np 
 
a = np.array([1,2,3,4]) 
b = np.array([10,20,30,40]) 
c = a * b 
print (c)
```
输出结果：`[ 10  40  90 160]`
当运算中的 2 个数组的形状不同时，numpy 将自动触发广播机制。如：
```python
import numpy as np 
 
a = np.array([[ 0, 0, 0],
           [10,10,10],
           [20,20,20],
           [30,30,30]])
b = np.array([0,1,2])
print(a + b)
```


输出结果为：
```
[[ 0  1  2]
 [10 11 12]
 [20 21 22]
 [30 31 32]]
```


## 迭代数组
```python
import numpy as np

a = np.arange(6).reshape(2, 3)
print(a)

print("迭代输出元素：")

for x in np.nditer(a):
    print(x, end=", ")
print("\n")


for x in np.nditer(a.T):
    print(x, end=", ")
print("\n")

for x in np.nditer(a.T.copy(order="C")):
    print(x, end=", ")
print("\n")

# output
# 0, 1, 2, 3, 4, 5,
# 0, 3, 1, 4, 2, 5,


# for x in np.nditer(a, order='F'):Fortran order，即是列序优先；
# for x in np.nditer(a.T, order='C'):C order，即是行序优先；


a = np.arange(0, 60, 5)
a = a.reshape(3, 4)
print("原始数组是：")
print(a)
print("\n")
print("以 C 风格顺序排序：")
for x in np.nditer(a, order="C"):
    print(x, end=", ")
print("\n")
print("以 F 风格顺序排序：")
for x in np.nditer(a, order="F"):
    print(x, end=", ")

# nditer 对象有另一个可选参数 op_flags。 默认情况下，nditer 将视待迭代遍历的数组为只读对象（read-only），为了在遍历数组的同时，实现对数组元素值的修改，必须指定 readwrite 或者 writeonly 的模式。


a = np.arange(0, 60, 5)
a = a.reshape(3, 4)
print("原始数组是：")
print(a)
print("\n")
# for x in np.nditer(a, op_flags=["readwrite"]):
#    x[...] = 2 * x
print("修改后的数组是：")
print(a)


a = np.arange(0, 60, 5)
a = a.reshape(3, 4)
print("第一个数组为：")
print(a)
print("\n")
print("第二个数组为：")
b = np.array([1, 2, 3, 4], dtype=int)
print(b)
print("\n")
print("修改后的数组为：")
for x, y in np.nditer([a, b]):
    print("%d:%d" % (x, y), end=", ")
```


## 数组操作 
```python
import numpy as np

a = np.arange(8)
print("原始数组：")
print(a)

b = a.reshape(4, 2)
print("修改后的数组：")
print(b)

a = np.arange(9).reshape((3, 3))
print("原始数组：")
for row in a:
    print(row)

print("迭代后的数组：")
for element in a.flat:
    print(element)

a = np.arange(8).reshape(2, 4)
print("原数组：")
print(a)

print("展开后的数组:")
print(a.flatten())
print("\n")

print("以F风格顺序展开的数组：")
print(a.flatten(order="F"))

# numpy.ravel() 展平的数组元素，顺序通常是"C风格"，返回的是数组视图（view，有点类似 C/C++引用reference的意味），修改会影响原始数组。

a = np.arange(8).reshape(2, 4)

print("原数组：")
print(a)
print("\n")

print("调用 ravel 函数之后：")
print(a.ravel())
print("\n")

print("以 F 风格顺序调用 ravel 函数之后：")
print(a.ravel(order="F"))

a = np.arange(12).reshape(3, 4)
print(np.transpose(a))
print(a.T)


# 创建了三维的 ndarray
a = np.arange(8).reshape(2, 2, 2)

print("原数组：")
print(a)
print("获取数组中一个值：")
print(np.where(a == 6))
print(a[1, 1, 0])  # 为 6
print("\n")


# 将轴 2 滚动到轴 0（宽度到深度）

print("调用 rollaxis 函数：")
b = np.rollaxis(a, 2, 0)
print(b)
# 查看元素 a[1,1,0]，即 6 的坐标，变成 [0, 1, 1]
# 最后一个 0 移动到最前面
print(np.where(b == 6))
print("\n")

# 将轴 2 滚动到轴 1：（宽度到高度）

print("调用 rollaxis 函数：")
c = np.rollaxis(a, 2, 1)
print(c)
# 查看元素 a[1,1,0]，即 6 的坐标，变成 [1, 0, 1]
# 最后的 0 和 它前面的 1 对换位置
print(np.where(c == 6))
print("\n")


# 创建了三维的 ndarray
a = np.arange(8).reshape(2, 2, 2)

print("原数组：")
print(a)
print("\n")
# 现在交换轴 0（深度方向）到轴 2（宽度方向）

print("调用 swapaxes 函数后的数组：")
print(np.swapaxes(a, 2, 0))

# numpy.broadcast_to 函数将数组广播到新形状。它在原始数组上返回只读视图。 它通常不连续。 如果新形状不符合 NumPy 的广播规则，该函数可能会抛出ValueError。


a = np.arange(4).reshape(1, 4)

print("原数组：")
print(a)
print("\n")

print("调用 broadcast_to 函数之后：")
print(np.broadcast_to(a, (4, 4)))


# numpy.expand_dims 函数通过在指定位置插入新的轴来扩展数组形状，函数格式如下:


x = np.array(([1, 2], [3, 4]))

print("数组 x：")
print(x)
print("\n")
y = np.expand_dims(x, axis=0)

print("数组 y：")
print(y)
print("\n")

print("数组 x 和 y 的形状：")
print(x.shape, y.shape)
print("\n")
# 在位置 1 插入轴
y = np.expand_dims(x, axis=1)

print("在位置 1 插入轴之后的数组 y：")
print(y)
print("\n")

print("x.ndim 和 y.ndim：")
print(x.ndim, y.ndim)
print("\n")

print("x.shape 和 y.shape：")
print(x.shape, y.shape)

# numpy.squeeze 函数从给定数组的形状中删除一维的条目，函数格式如下：


x = np.arange(9).reshape(1, 3, 3)

print("数组 x：")
print(x)
print("\n")
y = np.squeeze(x)

print("数组 y：")
print(y)
print("\n")

print("数组 x 和 y 的形状：")
print(x.shape, y.shape)

# numpy.concatenate 函数用于沿指定轴连接相同形状的两个或多个数组

a = np.array([[1, 2], [3, 4]])
b = np.array([[5, 6], [7, 8]])
print("沿着轴0链接两个数组：")
print(np.concatenate((a, b)))
print("沿着轴1链接两个数组：")
print(np.concatenate((a, b), axis=1))
print(np.concatenate((a, b), axis=1).shape)


# numpy.stack 函数用于沿新轴连接数组序列

a = np.array([[1, 2], [3, 4]])

print("第一个数组：")
print(a)
print("\n")
b = np.array([[5, 6], [7, 8]])

print("第二个数组：")
print(b)
print("\n")

print("沿轴 0 堆叠两个数组：")
print(np.stack((a, b), 0))
print("\n")

print("沿轴 1 堆叠两个数组：")
print(np.stack((a, b), 1))

print(np.stack((a, b), 0).shape)
print(np.stack((a, b), 1).shape)


```



|函数	|数组及操作|
|---|---|
|split	|将一个数组分割为多个子数组|
|hsplit	|将一个数组水平分割为多个子数组（按列）|
|vsplit	|将一个数组垂直分割为多个子数组（按行）|

```python
import numpy as np

a = np.arange(9)
print("第一个数组：")
print(a)
print("将数组分为三个大小相等的数组:")
print(np.split(a, 3))
print("标明位置的分割：")
print(np.split(a, [4, 7]))
print("rest")
print(np.split(a, 3)[2])



a = np.arange(16).reshape(4, 4)
print('第一个数组：')
print(a)
print('\n')
print('默认分割（0轴）：')
b = np.split(a,2)
print(b)
print('\n')

print('沿水平方向分割：')
c = np.split(a,2,1)
print(c)
print('\n')

print('沿水平方向分割：')
d= np.hsplit(a,2)
print(d)


```

## 数组元素的添加与删除
|函数	|元素及描述|
|----|---|
|resize	|返回指定形状的新数组|
|append	|将值添加到数组末尾|
|insert	|沿指定轴将值插入到指定下标之前|
|delete	|删掉某个轴的子数组，并返回删除后的新数组|
|unique	|查找数组内的唯一元素|

```python
import numpy as np

a = np.array([[1, 2, 3], [4, 5, 6]])
b = np.resize(a, (3, 2))
c = np.resize(a, (4, 5))
print("b:")
print(b)
print("c:")
print(c)


print(np.append(a, [7, 8, 9]))
print("\n")
print(np.append(a, [[7, 8, 9]], axis=0))
print("\n")
print(np.append(a, [[5, 5, 5], [7, 8, 9]], axis=1))


a = np.array([[1, 2], [3, 4], [5, 6]])
print("未传递Axis参数，在删除之前输入数组会被展开")
print(np.insert(a, 3, [11, 12]))
print("\n")
print("未传递Axis参数，会广播值数组来匹配输入数组")
print(np.insert(a, 1, 11, axis=0))
print("\n")
print(np.insert(a, 1, 11, axis=1))


a = np.arange(12).reshape(3, 4)
print(a)
print("\n")

print("未传递Axis参数，在删除之前输入数组会被展开")
print(np.delete(a, 5))
print("删除第二列：")
print(np.delete(a, 1, axis=1))
print("\n")
print("包含从数组中删除的替代值的切片：")
a = np.array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
print(np.delete(a, np.s_[::2]))


a = np.array([5, 2, 6, 2, 7, 5, 6, 8, 2, 9])
print("第一个数组的去重值：")
print(np.unique(a))
print("去重数组的索引数组：")
u, indices = np.unique(a, return_index=True)
print(indices)
print("\n")
print("去重数组的下标：")
u, indices = np.unique(a, return_inverse=True)
print(indices)
print("\n")
print(u[indices])
print("返回去重元素的重复数量：")
u, indices = np.unique(a, return_counts=True)
print(u)
print(indices)
```

## 位运算
略
## 字符串函数
虽然似乎用不上（主要是看累了），但还是把表列出来

|函数	|描述|
|---|---|
|add()	|对两个数组的逐个字符串元素进行连接|
|multiply()	|返回按元素多重连接后的字符串|
|center()	|居中字符串|
|capitalize()	|将字符串第一个字母转换为大写|
|title()	|将字符串的每个单词的第一个字母转换为大写|
|lower()	|数组元素转换为小写|
|upper()	|数组元素转换为大写|
|split()	|指定分隔符对字符串进行分割，并返回数组列表|
|splitlines()	|返回元素中的行列表，以换行符分割|
|strip()	|移除元素开头或者结尾处的特定字符|
|join()	|通过指定分隔符来连接数组中的元素|
|replace()	|使用新字符串替换字符串中的所有子字符串|
|decode()	|数组元素依次调用str.decode|
|encode()	|数组元素依次调用str.encode|
```python
import numpy as np


print("连接两个字符串：")
print(np.char.add(["hello"], [" xyz"]))
print("\n")
print("连接示例：")
print(np.char.add(["hello", "hi"], [" abc", " xyz"]))

print(np.char.multiply("Runoob ", 3))

# 分隔符默认为空格
print(np.char.split("i love you"))
# 分隔符指定
print(np.char.split("www.baidu.com", sep="."))


# numpy.char.splitlines() 函数以换行符作为分隔符来分割字符串，并返回数组。
# 换行符 \n
print (np.char.splitlines('i\nlike runoob?')) 
print (np.char.splitlines('i\rlike runoob?'))

# 操作字符串
print (np.char.join(':','runoob'))
# 指定多个分隔符操作数组元素
print (np.char.join([':','-'],['runoob','google']))


print (np.char.replace ('i like runoob', 'oo', 'cc'))


```

## 数学函数 
- np.sin()
- np.cos()
- np.tan()
- np.around() 四舍五入
- np.floor()
- np.ceil()

## 算术函数 
- np.add()
- np.subtract()
- np.multiply()
- np.divide()
- np.reciprocal() 求倒数 
- np.power() 幂函数
- np.mod() 取模

## 统计函数
numpy.amin() 用于计算数组中的元素沿指定轴的最小值。
```python
numpy.amin(a, axis=None, out=None, keepdims=<no value>, initial=<no value>, where=<no value>)
```
numpy.amax() 用于计算数组中的元素沿指定轴的最大值。
```python
numpy.amax(a, axis=None, out=None, keepdims=<no value>, initial=<no value>, where=<no value>)
```

参数说明：

- a: 输入的数组，可以是一个NumPy数组或类似数组的对象。
- axis: 可选参数，用于指定在哪个轴上计算最小值。如果不提供此参数，则返回整个数组的最小值。可以是一个整数表示轴的索引，也可以是一个元组表示多个轴。
- out: 可选参数，用于指定结果的存储位置。
- keepdims: 可选参数，如果为True，将保持结果数组的维度数目与输入数组相同。如果为False（默认值），则会去除计算后维度为1的轴。
- initial: 可选参数，用于指定一个初始值，然后在数组的元素上计算最小值。
- where: 可选参数，一个布尔数组，用于指定仅考虑满足条件的元素。

```python
import numpy as np 
 
a = np.array([[3,7,5],[8,4,3],[2,4,9]])  
print ('我们的数组是：')
print (a)
print ('\n')
print ('调用 amin() 函数：')
print (np.amin(a,1))
print ('\n')
print ('再次调用 amin() 函数：')
print (np.amin(a,0))
print ('\n')
print ('调用 amax() 函数：')
print (np.amax(a))
print ('\n')
print ('再次调用 amax() 函数：')
print (np.amax(a, axis =  0))
```
numpy.ptp() 函数计算数组中元素最大值与最小值的差（最大值 - 最小值）。
```python
numpy.ptp(a, axis=None, out=None, keepdims=<no value>, initial=<no value>, where=<no value>)
```

numpy.percentile()
百分位数是统计中使用的度量，表示小于这个值的观察值的百分比。 函数numpy.percentile()接受以下参数。
```python
numpy.percentile(a, q, axis)
```

```python
import numpy as np 
 
a = np.array([[10, 7, 4], [3, 2, 1]])
print ('我们的数组是：')
print (a)
 
print ('调用 percentile() 函数：')
# 50% 的分位数，就是 a 里排序之后的中位数
print (np.percentile(a, 50)) 
 
# axis 为 0，在纵列上求
print (np.percentile(a, 50, axis=0)) 
 
# axis 为 1，在横行上求
print (np.percentile(a, 50, axis=1)) 
 
# 保持维度不变
print (np.percentile(a, 50, axis=1, keepdims=True))
```

numpy.median() 函数用于计算数组 a 中元素的中位数（中值）

```python
numpy.median(a, axis=None, out=None, overwrite_input=False, keepdims=<no value>)
```

numpy.mean() 函数返回数组中元素的算术平均值，如果提供了轴，则沿其计算。

算术平均值是沿轴的元素的总和除以元素的数量。
```python
numpy.mean(a, axis=None, dtype=None, out=None, keepdims=<no value>)
```

numpy.average() 函数根据在另一个数组中给出的各自的权重计算数组中元素的加权平均值。

该函数可以接受一个轴参数。 如果没有指定轴，则数组会被展开。

加权平均值即将各数值乘以相应的权数，然后加总求和得到总体值，再除以总的单位数。

考虑数组[1,2,3,4]和相应的权重[4,3,2,1]，通过将相应元素的乘积相加，并将和除以权重的和，来计算加权平均值。
```python
numpy.average(a, axis=None, weights=None, returned=False)

import numpy as np 
 
a = np.array([1,2,3,4])  
print ('我们的数组是：')
print (a)
print ('\n')
print ('调用 average() 函数：')
print (np.average(a))
print ('\n')
# 不指定权重时相当于 mean 函数
wts = np.array([4,3,2,1])  
print ('再次调用 average() 函数：')
print (np.average(a,weights = wts))
print ('\n')
# 如果 returned 参数设为 true，则返回权重的和  
print ('权重的和：')
print (np.average([1,2,3,  4],weights =  [4,3,2,1], returned =  True))

```

标准差：np.std()
方差：np.var()

##  排序、条件筛选函数 

|种类	|速度	|最坏情况	|工作空间	|稳定性|
|---|---|---|---|---|
|'quicksort'（快速排序）	|1	|O(n^2)	|0	|否|
|'mergesort'（归并排序）	|2	|O(n*log(n))	| ~n/2 | 	是|
|'heapsort'（堆排序）	|3	|O(n*log(n))	|0	|否|

```python
numpy.sort(a, axis, kind, order)
```

numpy.argsort() 函数返回的是数组值从小到大的索引值。

|函数	|描述|
|---|---|
|msort(a)	|数组按第一个轴排序，返回排序后的数组副本。np.msort(a) 相等于 np.sort(a, axis=0)。|
|sort_complex(a)	|对复数按照先实部后虚部的顺序进行排序。|
|partition(a, kth[, axis, kind, order])	|指定一个数，对数组进行分区|
|argpartition(a, kth[, axis, kind, order])	|可以通过关键字 kind 指定算法沿着指定轴对数组进行分区|

numpy.argmax() 和 numpy.argmin()函数分别沿给定轴返回最大和最小元素的索引。

numpy.nonzero() 函数返回输入数组中非零元素的索引。

numpy.where() 函数返回输入数组中满足给定条件的元素的索引。

numpy.extract() 函数根据某个条件从数组中抽取元素，返回满条件的元素。
```python
import numpy as np 
 
x = np.arange(9.).reshape(3,  3)  
print ('我们的数组是：')
print (x)
# 定义条件, 选择偶数元素
condition = np.mod(x,2)  ==  0  
print ('按元素的条件值：')
print (condition)
print ('使用条件提取元素：')
print (np.extract(condition, x))
```


## 矩阵库np.matlib
- matlib.empty() 函数返回一个新的矩阵
- numpy.matlib.zeros() 函数创建一个以 0 填充的矩阵。
- numpy.matlib.ones()函数创建一个以 1 填充的矩阵。
- numpy.matlib.eye() 函数返回一个矩阵，对角线元素为 1，其他位置为零。
- numpy.matlib.identity() 函数返回给定大小的单位矩阵。
- numpy.matlib.rand() 函数创建一个给定大小的矩阵，数据是随机填充的。


## 线性代数

|函数	|描述|
|---|---|
|dot	|两个数组的点积，即元素对应相乘。|
|vdot	|两个向量的点积|
|inner	|两个数组的内积|
|matmul	|两个数组的矩阵积|
|determinant	|数组的行列式|
|solve	|求解线性矩阵方程|
|inv	|计算矩阵的乘法逆矩阵|

## IO
savetxt() 函数是以简单的文本文件格式存储数据，对应的使用 loadtxt() 函数来获取数据。

```python
np.loadtxt(FILENAME, dtype=int, delimiter=' ')
np.savetxt(FILENAME, a, fmt="%d", delimiter=",")

import numpy as np 
 
 
a=np.arange(0,10,0.5).reshape(4,-1)
np.savetxt("out.txt",a,fmt="%d",delimiter=",") # 改为保存为整数，以逗号分隔
b = np.loadtxt("out.txt",delimiter=",") # load 时也要指定为逗号分隔
print(b)
```

## matlibPlot

```python
import numpy as np 
from matplotlib import pyplot as plt 
 
x = np.arange(1,11) 
y =  2  * x +  5 
plt.title("Matplotlib demo") 
plt.xlabel("x axis caption") 
plt.ylabel("y axis caption") 
plt.plot(x,y) 
plt.show()

import numpy as np 
import matplotlib.pyplot as plt 
# 计算正弦和余弦曲线上的点的 x 和 y 坐标 
x = np.arange(0,  3  * np.pi,  0.1) 
y_sin = np.sin(x) 
y_cos = np.cos(x)  
# 建立 subplot 网格，高为 2，宽为 1  
# 激活第一个 subplot
plt.subplot(2,  1,  1)  
# 绘制第一个图像 
plt.plot(x, y_sin) 
plt.title('Sine')  
# 将第二个 subplot 激活，并绘制第二个图像
plt.subplot(2,  1,  2) 
plt.plot(x, y_cos) 
plt.title('Cosine')  
# 展示图像
plt.show()
# pyplot 子模块提供 bar() 函数来生成条形图。
from matplotlib import pyplot as plt 
x =  [5,8,10] 
y =  [12,16,6] 
x2 =  [6,9,11] 
y2 =  [6,15,7] 
plt.bar(x, y, align =  'center') 
plt.bar(x2, y2, color =  'g', align =  'center') 
plt.title('Bar graph') 
plt.ylabel('Y axis') 
plt.xlabel('X axis') 
plt.show()
```


