---
title: 系统学习python（二）对于pandas的整理 
date: 2025-05-03 18:15:08
tags:
- python
- 学习笔记
categories:
- [代码,python]
---
接着上文继续学习pandas的相关语法

<!--more-->
简单的pandas实例

```python
import pandas as pd

# 创建一个简单的 DataFrame
data = {'Name': ['Google', 'Runoob', 'Taobao'], 'Age': [25, 30, 35]}
df = pd.DataFrame(data)

# 查看 DataFrame
print(df)
```

可以使用 pd.Series() 构造函数创建一个 Series 对象，传递一个数据数组（可以是列表、NumPy 数组等）和一个可选的索引数组。

```python
pandas.Series(data=None, index=None, dtype=None, name=None, copy=False, fastpath=False)
```

- data：Series 的数据部分，可以是列表、数组、字典、标量值等。如果不提供此参数，则创建一个空的 Series。
- index：Series 的索引部分，用于对数据进行标记。可以是列表、数组、索引对象等。如果不提供此参数，则创建一个默认的整数索引。
- dtype：指定 Series 的数据类型。可以是 NumPy 的数据类型，例如 np.int64、np.float64 等。如果不提供此参数，则根据数据自动推断数据类型。
- name：Series 的名称，用于标识 Series 对象。如果提供了此参数，则创建的 Series 对象将具有指定的名称。
- copy：是否复制数据。默认为 False，表示不复制数据。如果设置为 True，则复制输入的数据。
- fastpath：是否启用快速路径。默认为 False。启用快速路径可能会在某些情况下提高性能。

```python
series = pd.Series([1, 2, 3, 4], name="A")
print(series)

custom_index = [1, 2, 3, 4]
series_with_index = pd.Series([1, 2, 3, 4], index=custom_index, name="A")
print(series_with_index)

myvar = pd.Series(["Google","Runoob","Wiki"],index=['x','y','z'])
print(myvar['x'])

sites = {1:"Google",2:"Runoob",3:"Wiki"}
myvar = pd.Series(sites)
print(myvar)
```


下面是Series常用的方法：

|方法名称	|功能描述|
|---|---|
|index	|获取 Series 的索引|
|values	|获取 Series 的数据部分（返回 NumPy 数组）|
|head(n)	|返回 Series 的前 n 行（默认为 5）|
|tail(n)	|返回 Series 的后 n 行（默认为 5）|
|dtype	|返回 Series 中数据的类型|
|shape	|返回 Series 的形状（行数）|
|describe()	|返回 Series 的统计描述（如均值、标准差、最小值等）|
|isnull()	|返回一个布尔 Series，表示每个元素是否为 NaN|
|notnull()	|返回一个布尔 Series，表示每个元素是否不是 NaN|
|unique()	|返回 Series 中的唯一值（去重）|
|value_counts()	|返回 Series 中每个唯一值的出现次数|
|map(func)	|将指定函数应用于 Series 中的每个元素|
|apply(func)	|将指定函数应用于 Series 中的每个元素，常用于自定义操作|
|astype(dtype)	|将 Series 转换为指定的类型|
|sort_values()	|对 Series 中的元素进行排序（按值排序）|
|sort_index()	|对 Series 的索引进行排序|
|dropna()	|删除 Series 中的缺失值（NaN）|
|fillna(value)	|填充 Series 中的缺失值（NaN）|
|replace(to_replace, value)	|替换 Series 中指定的值|
|cumsum()	|返回 Series 的累计求和|
|cumprod()	|返回 Series 的累计乘积|
|shift(periods)	|将 Series 中的元素按指定的步数进行位移|
|rank()	|返回 Series 中元素的排名|
|corr(other)	|计算 Series 与另一个 Series 的相关性（皮尔逊相关系数）|
|cov(other)	|计算 Series 与另一个 Series 的协方差|
|to_list()	|将 Series 转换为 Python 列表|
|to_frame()	|将 Series 转换为 DataFrame|
|iloc[]	|通过位置索引来选择数据|
|loc[]	|通过标签索引来选择数据|

```python
import pandas as pd

# 创建 Series
data = [1, 2, 3, 4, 5, 6]
index = ['a', 'b', 'c', 'd', 'e', 'f']
s = pd.Series(data, index=index)

# 查看基本信息
print("索引：", s.index)
print("数据：", s.values)
print("数据类型：", s.dtype)
print("前两行数据：", s.head(2))

# 使用 map 函数将每个元素加倍
s_doubled = s.map(lambda x: x * 2)
print("元素加倍后：", s_doubled)

# 计算累计和
cumsum_s = s.cumsum()
print("累计求和：", cumsum_s)

# 查找缺失值（这里没有缺失值，所以返回的全是 False）
print("缺失值判断：", s.isnull())

# 排序
sorted_s = s.sort_values()
print("排序后的 Series：", sorted_s)

# 使用列表创建 Series
s = pd.Series([1, 2, 3, 4])

# 使用 NumPy 数组创建 Series
s = pd.Series(np.array([1, 2, 3, 4]))

# 使用字典创建 Series
s = pd.Series({'a': 1, 'b': 2, 'c': 3, 'd': 4})

# 算术运算
result = series * 2  # 所有元素乘以2

# 过滤
filtered_series = series[series > 2]  # 选择大于2的元素

# 数学函数
import numpy as np
result = np.sqrt(series)  # 对每个元素取平方根

print(s.sum())  # 输出 Series 的总和
print(s.mean())  # 输出 Series 的平均值
print(s.max())  # 输出 Series 的最大值
print(s.min())  # 输出 Series 的最小值
print(s.std())  # 输出 Series 的标准差

# 获取索引
index = s.index

# 获取值数组
values = s.values

# 获取描述统计信息
stats = s.describe()

# 获取最大值和最小值的索引
max_index = s.idxmax()
min_index = s.idxmin()

# 其他属性和方法
print(s.dtype)   # 数据类型
print(s.shape)   # 形状
print(s.size)    # 元素个数
print(s.head())  # 前几个元素，默认是前 5 个
print(s.tail())  # 后几个元素，默认是后 5 个
print(s.sum())   # 求和
print(s.mean())  # 平均值
print(s.std())   # 标准差
print(s.min())   # 最小值
print(s.max())   # 最大值

```

# DataFrame
DataFrame的构造方法
```python
pandas.DataFrame(data=None, index=None, columns=None, dtype=None, copy=False)
```
- data：DataFrame 的数据部分，可以是字典、二维数组、Series、DataFrame 或其他可转换为 DataFrame 的对象。如果不提供此参数，则创建一个空的 DataFrame。
- index：DataFrame 的行索引，用于标识每行数据。可以是列表、数组、索引对象等。如果不提供此参数，则创建一个默认的整数索引。
- columns：DataFrame 的列索引，用于标识每列数据。可以是列表、数组、索引对象等。如果不提供此参数，则创建一个默认的整数索引。
- dtype：指定 DataFrame 的数据类型。可以是 NumPy 的数据类型，例如 np.int64、np.float64 等。如果不提供此参数，则根据数据自动推断数据类型。
- copy：是否复制数据。默认为 False，表示不复制数据。如果设置为 True，则复制输入的数据。

```python
import pandas as pd

data = {'Site':['Google', 'Runoob', 'Wiki'], 'Age':[10, 12, 13]}
df = pd.DataFrame(data)
print (df)import pandas as pd
data = [['Google', 10], ['Runoob', 12], ['Wiki', 13]]
# 创建DataFrame
df = pd.DataFrame(data, columns=['Site', 'Age'])
# 使用astype方法设置每列的数据类型
df['Site'] = df['Site'].astype(str)
df['Age'] = df['Age'].astype(float)
print(df)

data = {'Site':['Google', 'Runoob', 'Wiki'], 'Age':[10, 12, 13]}
df = pd.DataFrame(data)
print (df)

# 创建一个包含网站和年龄的二维ndarray
ndarray_data = np.array([
    ['Google', 10],
    ['Runoob', 12],
    ['Wiki', 13]
])
# 使用DataFrame构造函数创建数据帧
df = pd.DataFrame(ndarray_data, columns=['Site', 'Age'])
# 打印数据帧
print(df)
data = [{'a': 1, 'b': 2},{'a': 5, 'b': 10, 'c': 20}]
df = pd.DataFrame(data)
print (df)


data = {
  "calories": [420, 380, 390],
  "duration": [50, 40, 45]
}
# 数据载入到 DataFrame 对象
df = pd.DataFrame(data)
# 返回第一行和第二行
print(df.loc[[0, 1]])
```

DataFrame 的常用操作和方法如下表所示：

|方法名称	|功能描述|
|---|---|
|head(n)	|返回 DataFrame 的前 n 行数据（默认前 5 行）|
|tail(n)	|返回 DataFrame 的后 n 行数据（默认后 5 行）|
|info()	|显示 DataFrame 的简要信息，包括列名、数据类型、非空值数量等|
|describe()	|返回 DataFrame 数值列的统计信息，如均值、标准差、最小值等|
|shape	|返回 DataFrame 的行数和列数（行数, 列数）|
|columns	|返回 DataFrame 的所有列名|
|index	|返回 DataFrame 的行索引|
|dtypes	|返回每一列的数值数据类型|
|sort_values(by)	|按照指定列排序|
|sort_index()	|按行索引排序|
|dropna()	|删除含有缺失值（NaN）的行或列|
|fillna(value)	|用指定的值填充缺失值|
|isnull()	|判断缺失值，返回一个布尔值 DataFrame|
|notnull()	|判断非缺失值，返回一个布尔值 DataFrame|
|loc[]	|按标签索引选择数据|
|iloc[]	|按位置索引选择数据|
|at[]	|访问 DataFrame 中单个元素（比 loc[] 更高效）|
|iat[]	|访问 DataFrame 中单个元素（比 iloc[] 更高效）|
|apply(func)	|对 DataFrame 或 Series 应用一个函数|
|applymap(func)	|对 DataFrame 的每个元素应用函数（仅对 DataFrame）|
|groupby(by)	|分组操作，用于按某一列分组进行汇总统计|
|pivot_table()	|创建透视表|
|merge()	|合并多个 DataFrame（类似 SQL 的 JOIN 操作）|
|concat()	|按行或按列连接多个 DataFrame|
|to_csv()	|将 DataFrame 导出为 CSV 文件|
|to_excel()	|将 DataFrame 导出为 Excel 文件|
|to_json()	|将 DataFrame 导出为 JSON 格式|
|to_sql()	|将 DataFrame 导出为 SQL 数据库|
|query()	|使用 SQL 风格的语法查询 DataFrame|
|duplicated()	|返回布尔值 DataFrame，指示每行是否是重复的|
|drop_duplicates()	|删除重复的行|
|set_index()	|设置 DataFrame 的索引|
|reset_index()	|重置 DataFrame 的索引|
|transpose()	|转置 DataFrame（行列交换）|

```python
import pandas as pd

# 创建 DataFrame
data = {
    'Name': ['Alice', 'Bob', 'Charlie', 'David'],
    'Age': [25, 30, 35, 40],
    'City': ['New York', 'Los Angeles', 'Chicago', 'Houston']
}
df = pd.DataFrame(data)

# 查看前两行数据
print(df.head(2))

# 查看 DataFrame 的基本信息
print(df.info())

# 获取描述统计信息
print(df.describe())

# 按年龄排序
df_sorted = df.sort_values(by='Age', ascending=False)
print(df_sorted)

# 选择指定列
print(df[['Name', 'Age']])

# 按索引选择行
print(df.iloc[1:3])  # 选择第二到第三行（按位置）

# 按标签选择行
print(df.loc[1:2])  # 选择第二到第三行（按标签）

# 计算分组统计（按城市分组，计算平均年龄）
print(df.groupby('City')['Age'].mean())

# 处理缺失值（填充缺失值）
df['Age'] = df['Age'].fillna(30)

# 导出为 CSV 文件
df.to_csv('output.csv', index=False)

```

创建DataFrame
```python
import pandas as pd

# 通过字典创建 DataFrame
df = pd.DataFrame({'Column1': [1, 2, 3], 'Column2': [4, 5, 6]})
df = pd.DataFrame([[1, 2, 3], [4, 5, 6], [7, 8, 9]],
                  columns=['Column1', 'Column2', 'Column3'])
# 通过 NumPy 数组创建 DataFrame
df = pd.DataFrame(np.array([[1, 2, 3], [4, 5, 6], [7, 8, 9]]))
s1 = pd.Series(['Alice', 'Bob', 'Charlie'])
s2 = pd.Series([25, 30, 35])
s3 = pd.Series(['New York', 'Los Angeles', 'Chicago'])
df = pd.DataFrame({'Name': s1, 'Age': s2, 'City': s3})

# DataFrame 的属性和方法
print(df.shape)     # 形状
print(df.columns)   # 列名
print(df.index)     # 索引
print(df.head())    # 前几行数据，默认是前 5 行
print(df.tail())    # 后几行数据，默认是后 5 行
print(df.info())    # 数据信息
print(df.describe())# 描述统计信息
print(df.mean())    # 求平均值
print(df.sum())     # 求和
# 通过列名访问
print(df['Column1'])
# 通过属性访问
print(df.Name)     
# 通过 .loc[] 访问
print(df.loc[:, 'Column1'])
# 通过 .iloc[] 访问
print(df.iloc[:, 0])  # 假设 'Column1' 是第一列
# 访问单个元素
print(df['Name'][0])
# 通过行标签访问
print(df.loc[0, 'Column1'])

# 使用 loc 为特定索引添加新行
df.loc[3] = [13, 14, 15, 16]
# 使用 append 添加新行到末尾
new_row = {'Column1': 13, 'Column2': 14, 'NewColumn': 16}
df = df.append(new_row, ignore_index=True)
# 使用concat添加新行
new_row = pd.DataFrame([[4, 7]], columns=['A', 'B'])  # 创建一个只包含新行的DataFrame
df = pd.concat([df, new_row], ignore_index=True)  # 将新行添加到原始DataFrame
df_dropped = df.drop('Column1', axis=1)
df_dropped = df.drop(0)  # 删除索引为 0 的行
df.describe()
df['Column1'].sum()
df.mean()
df_reset = df.reset_index(drop=True)
df_set = df.set_index('Column1')
df[df['Column1'] > 2]
df.dtypes
df['Column1'] = df['Column1'].astype('float64')
# 纵向合并
pd.concat([df1, df2], ignore_index=True)
# 横向合并
pd.merge(df1, df2, on='Column1')
# 索引和切片
print(df[['Name', 'Age']])  # 提取多列
print(df[1:3])               # 切片行
print(df.loc[:, 'Name'])     # 提取单列
print(df.loc[1:2, ['Name', 'Age']])  # 标签索引提取指定行列
print(df.iloc[:, 1:])        # 位置索引提取指定列
```

# CSV

|方法名称	|功能描述	|常用参数|
|---|---|---|
|pd.read_csv()	|从 CSV 文件读取数据并加载为 DataFrame	|filepath_or_buffer (路径或文件对象)，sep (分隔符)，header (行标题)，names (自定义列名)，dtype (数据类型)，index_col (索引列)|
|DataFrame.to_csv()	|将 DataFrame 写入到 CSV 文件	|path_or_buffer (目标路径或文件对象)，sep (分隔符)，index (是否写入索引)，columns (指定列)，header (是否写入列名)，mode (写入模式)|

read_csv常用参数:
|参数	|说明	|默认值|
|---|---|---|
|filepath_or_buffer	|CSV 文件的路径或文件对象（支持 URL、文件路径、文件对象等）	|必需参数|
|sep	|定义字段分隔符，默认是逗号（,），可以改为其他字符，如制表符（\t）	|','|
|header	|指定行号作为列标题，默认为 0（表示第一行），或者设置为 None 没有标题	|0|
|names	|自定义列名，传入列名列表	|None|
|index_col	|用作行索引的列的列号或列名	|None|
|usecols	|读取指定的列，可以是列的名称或列的索引	|None|
|dtype	|强制将列转换为指定的数据类型	|None|
|skiprows	|跳过文件开头的指定行数，或者传入一个行号的列表	|None|
|nrows	|读取前 N 行数据	|None|
|na_values	|指定哪些值应视为缺失值（NaN）	|None|
|skipfooter	|跳过文件结尾的指定行数	|0|
|encoding	|文件的编码格式（如 utf-8，latin1 等）	|None|

to_csv常用参数 
| 参数            | 说明                                                         | 默认值   |
|-----------------|--------------------------------------------------------------|----------|
| path_or_buffer  | CSV 文件的路径或文件对象（支持文件路径、文件对象）           | 必需参数 |
| sep             | 定义字段分隔符，默认是逗号（,），可以改为其他字符，如制表符（\t） | ','      |
| index           | 是否写入行索引，默认 True 表示写入索引                       | True     |
| columns         | 指定写入的列，可以是列的名称列表                             | None     |
| header          | 是否写入列名，默认 True 表示写入列名，设置为 False 表示不写列名 | True     |
| mode            | 写入文件的模式，默认是 w（写模式），可以设置为 a（追加模式） | 'w'      |
| encoding        | 文件的编码格式，如 utf-8，latin1 等                           | None     |
| line_terminator | 定义行结束符，默认为 \n                                       | None     |
| quoting         | 设置如何对文件中的数据进行引号处理（0-3，具体引用方式可查文档） | None     |
| quotechar       | 设置用于引用的字符，默认为双引号 "                           | '"'      |
| date_format     | 自定义日期格式，如果列包含日期数据，则可以使用此参数指定日期格式 | None     |
| doublequote     | 如果为 True，则在写入时会将包含引号的文本使用双引号括起来    | True     |

## Excel

```python
pandas.read_excel(io, sheet_name=0, *, header=0, names=None, index_col=None, usecols=None, dtype=None, engine=None, converters=None, true_values=None, false_values=None, skiprows=None, nrows=None, na_values=None, keep_default_na=True, na_filter=True, verbose=False, parse_dates=False, date_parser=<no_default>, date_format=None, thousands=None, decimal='.', comment=None, skipfooter=0, storage_options=None, dtype_backend=<no_default>, engine_kwargs=None)
```

| 参数               | 说明                                                         | 默认值             |
|--------------------|--------------------------------------------------------------|--------------------|
| io                 | 这是必需的参数，指定了要读取的 Excel 文件的路径或文件对象。  | 必需参数           |
| sheet_name         | 指定要读取的工作表名称或索引。默认为0，即第一个工作表。      | 0                  |
| header             | 指定用作列名的行。默认为0，即第一行。                        | 0                  |
| names              | 用于指定列名的列表。如果提供，将覆盖文件中的列名。           | None               |
| index_col          | 指定用作行索引的列。可以是列的名称或数字。                   | None               |
| usecols            | 指定要读取的列。可以是列名的列表或列索引的列表。             | None               |
| dtype              | 指定列的数据类型。可以是字典格式，键为列名，值为数据类型。   | None               |
| engine             | 指定解析引擎。默认为None，pandas 会自动选择。                | None               |
| converters         | 用于转换数据的函数字典。                                     | None               |
| true_values        | 指定应该被视为布尔值True的值。                               | None               |
| false_values       | 指定应该被视为布尔值False的值。                              | None               |
| skiprows           | 指定要跳过的行数或要跳过的行的列表。                         | None               |
| nrows              | 指定要读取的行数。                                           | None               |
| na_values          | 指定应该被视为缺失值的值。                                   | None               |
| keep_default_na    | 指定是否要将默认的缺失值（例如NaN）解析为NA。                | True               |
| na_filter          | 指定是否要将数据转换为NA。                                   | True               |
| verbose            | 指定是否要输出详细的进度信息。                               | False              |
| parse_dates        | 指定是否要解析日期。                                         | False              |
| date_parser        | 用于解析日期的函数。                                         | `<no_default>`     |
| date_format        | 指定日期的格式。                                             | None               |
| thousands          | 指定千位分隔符。                                             | None               |
| decimal            | 指定小数点字符。                                             | '.'                |
| comment            | 指定注释字符。                                               | None               |
| skipfooter         | 指定要跳过的文件末尾的行数。                                 | 0                  |
| storage_options    | 用于云存储的参数字典。                                       | None               |
| dtype_backend      | 指定数据类型后端。                                           | `<no_default>`     |
| engine_kwargs      | 传递给引擎的额外参数字典。                                   | None               |


## 数据清洗
如果我们要删除包含空字段的行，可以使用 dropna() 方法:
```python
DataFrame.dropna(axis=0, how='any', thresh=None, subset=None, inplace=False)
```
- axis：默认为 0，表示逢空值剔除整行，如果设置参数 axis＝1 表示逢空值去掉整列。
- how：默认为 'any' 如果一行（或一列）里任何一个数据有出现 NA 就去掉整行，如果设置 how='all' 一行（或列）都是 NA 才去掉这整行。
- thresh：设置需要多少非空值的数据才可以保留下来的。
- subset：设置想要检查的列。如果是多个列，可以使用列名的 list 作为参数。
- inplace：如果设置 True，将计算得到的值直接覆盖之前的值并返回 None，修改的是源数据。

我们可以通过 isnull() 判断各个单元格是否为空。

我们也可以 fillna() 方法来替换一些空字段：`df.fillna(12345, inplace = True)`

```python
import pandas as pd

df = pd.read_csv('property-data.csv')

x = df["ST_NUM"].mean()

df["ST_NUM"].fillna(x, inplace = True)

print(df.to_string())
```
Pandas使用 mean()、median() 和 mode() 方法计算列的均值（所有值加起来的平均值）、中位数值（排序后排在中间的数）和众数（出现频率最高的数）。

如果我们要清洗重复数据，可以使用 duplicated() 和 drop_duplicates() 方法。

如果对应的数据是重复的，duplicated() 会返回 True，否则返回 False。

# 数据预处理操作汇总

| 操作               | 方法/步骤                       | 说明                                                                 | 常用函数/方法                                       |
|------------------|------------------------------|----------------------------------------------------------------------|--------------------------------------------------|
| 缺失值处理           | 填充缺失值                       | 使用指定的值（如均值、中位数、众数等）填充缺失值。                               | `df.fillna(value)`                              |
|                  | 删除缺失值                      | 删除包含缺失值的行或列。                                                       | `df.dropna()`                                   |
| 重复数据处理         | 删除重复数据                      | 删除 DataFrame 中的重复行。                                          | `df.drop_duplicates()`                          |
| 异常值处理           | 异常值检测（基于统计方法）            | 通过 Z-score 或 IQR 方法识别并处理异常值。                                  | 自定义函数（如基于 Z-score 或 IQR）                 |
|                  | 替换异常值                      | 使用合适的值（如均值或中位数）替换异常值。                                     | 自定义函数（如替换异常值）                          |
| 数据格式转换         | 转换数据类型                      | 将数据类型从一个类型转换为另一个类型，如将字符串转换为日期。                            | `df.astype()`                                   |
|                  | 日期时间格式转换                  | 转换字符串或数字为日期时间类型。                                           | `pd.to_datetime()`                              |
| 标准化与归一化        | 标准化                          | 将数据转换为均值为0，标准差为1的分布。                                        | `StandardScaler()`                              |
|                  | 归一化                         | 将数据缩放到指定的范围（如 [0, 1]）。                                     | `MinMaxScaler()`                                |
| 类别数据编码         | 标签编码                        | 将类别变量转换为整数形式。                                               | `LabelEncoder()`                                |
|                  | 独热编码（One-Hot Encoding）     | 将每个类别转换为一个新的二进制特征。                                         | `pd.get_dummies()`                              |
| 文本数据处理         | 去除停用词                      | 从文本中去除无关紧要的词，如 "the" 、 "is" 等。                            | 自定义函数（基于 `nltk` 或 `spaCy`）              |
|                  | 词干化与词形还原                  | 提取词干或恢复单词的基本形式。                                           | `nltk.stem.PorterStemmer()`                     |
|                  | 分词                          | 将文本分割成单词或子词。                                               | `nltk.word_tokenize()`                          |
| 数据抽样            | 随机抽样                        | 从数据中随机抽取一定比例的样本。                                           | `df.sample()`                                   |
|                  | 上采样与下采样                   | 通过过采样或欠采样来平衡数据集中的类别分布。                                   | `SMOTE()`（上采样）；`RandomUnderSampler()`（下采样） |
| 特征工程            | 特征选择                        | 选择对目标变量有影响的特征，去除冗余或无关特征。                                  | `SelectKBest()`                                 |
|                  | 特征提取                        | 从原始数据中创建新的特征，提升模型的预测能力。                                   | `PolynomialFeatures()`                          |
|                  | 特征缩放                        | 对数值特征进行缩放，使其具有相同的量级。                                        | `MinMaxScaler()`、`StandardScaler()`            |
|                  | 类别特征映射                     | 将类别变量映射为对应的数字编码。                                           | 自定义映射函数                                    |
| 数据合并与连接        | 合并数据                        | 将多个 DataFrame 按照某些列合并在一起，支持内连接、外连接、左连接、右连接等。              | `pd.merge()`                                    |
|                  | 连接数据                        | 将多个 DataFrame 进行行或列拼接。                                         | `pd.concat()`                                   |
| 数据重塑            | 数据透视表                       | 将数据根据某些维度进行分组并计算聚合结果。                                     | `pd.pivot_table()`                              |
|                  | 数据变形                        | 改变数据的形状，如从长格式转为宽格式或从宽格式转为长格式。                            | `df.melt()`、`df.pivot()`                        |
| 数据类型转换与处理     | 字符串处理                       | 对字符串数据进行处理，如去除空格、转换大小写等。                                  | `str.replace()`、`str.upper()` 等               |
| 分组计算            |                                 | 按照某个特征分组后进行聚合计算。                                           | `df.groupby()`                                  |
| 缺失值预测填充        | 使用模型预测填充缺失值               | 使用机器学习模型（如回归模型）预测缺失值，并填充缺失数据。                            | 自定义模型（如 `sklearn.linear_model.LinearRegression`） |
| 时间序列处理         | 时间序列缺失值填充                 | 使用时间序列的方法（如前向填充、后向填充）填充缺失值。                              | `df.fillna(method='ffill')`                     |
|                  | 滚动窗口计算                     | 使用滑动窗口进行时间序列数据的统计计算（如均值、标准差等）。                          | `df.rolling(window=5).mean()`                   |
| 数据转换与映射        | 数据映射与替换                    | 将数据中的某些值替换为其他值。                                             | `df.replace()`                                  |

```python
from sklearn.preprocessing import StandardScaler
import pandas as pd

# 示例数据
data = {'Age': [25, 30, 35, 40, 45],
        'Salary': [50000, 60000, 70000, 80000, 90000]}

df = pd.DataFrame(data)

# 标准化数据
scaler = StandardScaler()
df_scaled = scaler.fit_transform(df)

print(df_scaled)
```

## 相关性分析

```python

df.corr(method='pearson', min_periods=1)
spearman_correlation = df.corr(method='spearman')
# 计算肯德尔秩相关系数
kendall_correlation = df.corr(method='kendall')
# 计算相关性矩阵
correlation_matrix = df.corr()

# 绘制相关性热图
plt.figure(figsize=(8, 6))
sns.heatmap(df.corr(), annot=True, cmap='coolwarm', fmt='.2f', vmin=-1, vmax=1)
plt.title('Correlation Heatmap')
plt.show()


```

apply() — 应用函数到 DataFrame 或 Series 上
apply() 方法允许在 DataFrame 或 Series 上应用自定义函数，支持对行或列进行操作。
```python
import pandas as pd

# 示例数据
df = pd.DataFrame({'A': [1, 2, 3, 4], 'B': [10, 20, 30, 40]})

# 定义自定义函数
def custom_func(x):
    return x * 2

# 在列上应用函数
df['A'] = df['A'].apply(custom_func)
print(df)
```

对于具有重复值的字符串列，可以使用 category 类型来减少内存消耗。category 类型在内存中存储的是整数索引，而不是字符串本身。

```python
# 示例数据
df = pd.DataFrame({'Category': ['A', 'B', 'A', 'C', 'B', 'A']})

# 使用 category 类型
df['Category'] = df['Category'].astype('category')

print(df.dtypes)
```


