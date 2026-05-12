---
title: python学习笔记1
date: 2022-01-12 19:55:31
#cover: https://i.postimg.cc/Y03jkmWs/46985381-p0-master1200.jpg
#password: 123456
#abstract: test for encrypt
#message: don't be a dick
tags:
- python
- 学习笔记
categories: 
- [代码,编程语言]
---
除开函数外的python基础知识总汇，用于复习及查看，写的会很简略
<!--more-->
### 基础知识
普通的除法：1/2  0.5
整除: 1//2 0 
取模：%
乘方：2**3 (-3**2 等同于 -(3**2 ))

十六进制：0xAF
八进制：010

变量无需声明即可使用
```py
x = 3 
x * 2 
output : 6 
```

变量名命名同C语言

print 在python2是语句，在python3中是函数，所以应当加上（）

```py
>>> input ( "The meaning of life: " )
The meaning of life 42
42
>>> x = input ( "x: " ) 
x: 34 
>>> y = input ( "y: " ) 
y : 42 
>>> print ( x * y ) 
1428
```
```py
>>> pow ( 2 , 3 ) 
8 
```
round 函数会把浮点数四舍五入为最接近的整数值 （ py2 与py3 对于0.5的取值有所不同）
abs 绝对值函数

可以用变量来引用函数
```py
import math 
math.floor( 32.9 ) 

from math import floor
floor

foo = math.sqrt 
foo ( 4 ) 
```
math 中的sqrt不支持复数运算而cmath中支持

```py
>>> import cmath
>>> cmath.sqrt ( -1 ) 
1j
# 没有使用from 。。。import 。。。是因为一旦使用了这个语句那么就无法使用普通的sqrt了
>>> (1+3j) * (9+4j) 
(-3+31j) 
```

字符串是值，就像数字一样，单引号和双引号没有本质区别
\与C语言中一样使用
字符串之间可以拼接
```py
"hello," + "world"
```
转换成字符串有两种方式
str将对象转换成用户看的，repr转换成python表达式
```py
print ( repr ( "hello world" ) )
'hello world'
print ( str ( "hello world " ) )
hello world 
```

长字符串：
```py
print ( """ This is a very long string
It continues here 
And it's not over yet
Still here """ )
# 换行符可以被转义
print ( """ hello \ 
world """ ) 
```

原始字符串
``` py
path = 'c:\\program\\fnord'
path = r'c:\ll"
# r紧贴'且字符串末尾不是\
```
### 序列
列表和元组的区别在于列表可以修改而元组不可以

通用的序列操作：索引，分片，加，乘
索引同数组，数组最后一个元素的位置标号为-1如：greeting[-1]
print的返回值是一个序列，所以我们可以如此调用
```py
fourth = input ( "Year: " )[3] 
```
列表可以相加与相乘,例如
```py
endings = ['st','nd','rd']+17 * ['th',] \ 
+    ['st','nd','rd']+ 7 * ['th',]  \
+ ['st]
[1,2,3] + [4,5,6]
= [1,2,3,4,5,6]
# 初始化一个长度为10 的列表
sequence = [None] * 10 
```

分片
numbers[-3:-1]
numbers[-3:]
numbers[0::2]
numbers[-1:0:-2]

成员资格：in函数

长度：len
最大值：max
最小值：min
#### 列表
list函数 对立： ''.join(somelist) 
删除元素del names[2]
分片赋值:可以使用与原序列不等长的序列将分片替换（可以用来删除某一段）
```py
numbers[1:1] = [2, 3 ,4 ]
numbers[1:5] = [] 
```
.append( ) 
.count ( )
.extend ( ) 追加一个序列
.index( ) 找出第一个匹配项索引位置
.insert( i , value ) 插入
.pop( ) 移除最后一个值并返回值
.remove ( ) 移除第一个匹配项
.reserve ( ) 反向存放
.sort ( ) 会该表原来的列表修改，也就是说修改副本不会影响原本，反之不然
**sort里面可以有参数如cmp，key=len，reserve=True**
sorted ( ) 返回已排序的列表副本

#### 元组
如果你用逗号分隔了一些值，那么你就自动创建了元组
tuple ( ) 类比于list

### 字符串
```py
format = "hello , %s , %s enough for ya!" 
values = ( 'world' , 'Hot' ) 
print ( format % values ) 
```
模板字符串：
```py
from string import Template
s = Template ( '$x , glorious $x ' ) 
s.substitute ( x = 'slum' ) 

s = Template ( "It's ${x}tatic" ) 
s.substitute ( x = 'slum' ) 

s = Template ( 'A $thing must never $action' ) 
d = { } 
d['thing'] = 'gentleman' 
d['action'] = 'show his socks' 
s.substitute ( d ) 
```

转换符包括（注意顺序）
1. %
2. 转换标志 ，- : 左对齐,+ : 正负号,"" 正数前保留空格，0：位数不够用零来凑
3. 最小值宽（若为 * 则从元组读入）例如'%. * s' % ( 5 , 'dada' ) 
4. .后跟精确度

字符串方法：
.find ( "target" ,start ,end ) 查找字串(start end 可忽略)
sth.join ( ) 
.lower ( ) 转换成小写
.title ( )  // .capwords ( ) 标题
.replace ( A , B ) 查找并替换
.split ( ) join 的逆运算
.strip ( ) 去除两侧空格，可自己添加例如.strip ( ' * !' ) 
.translate ( ) && .maketrans python3有所区别，运用时自己网上查

### 字典
创建： phonebook = { 'A' : 1 , 'B' : 2 ......} 
dict ( 序列 ) 
len ( ) 
d[k]
d[k] = v 
del d[k] 
k in d 检查d中是否有含有键为k的项
字典可以嵌套，类比于多维数组
```py
template = "%(title)s , %(ooo)d " 
data = { 'title' : 'fff' , 'ooo' : 1 }
print ( template % data )  
``` 
.clear ( ) 原本操作
.copy ( ) 替换值不变原本，修改值会变
.deepcopy ( copy函数库中 ) 复制其包含的所有值
.fromkeys ( [ ] , 'default' ) or dict.fromkeys ( [ ] , 'default' ) 给给定的键建立新的字典
.get ( 'value' ) 访问不存在的项返回None
.has_key ( 'value' ) 查询是否有此键，py3中被__contains__(key) 替代
.items ( ) 把所有项以列表形式返回，且每一项返回(键,值)的形式
.iteritems ( )返回迭代器
.keys ( ) 返回键 ， 同上
.itereys ( ) 同上
.values ( ) 同上
.itervalues ( ) 同上
.pop ( '键' ) 删除对应的键值对
.popitem ( ) 随机弹出项
.setdefault ( 键 , 'default' )
.update ( x ) 有则不变，无则加之 

### 条件、循环和其它语句
print: ,即空格,print 即换行（除非在最后加，)
import somemodule
from sm import sf
from sm import sf as ( 可避免重名)

解包时可在最后用 * rest 把剩下的值都存入rest

+=
* =
```py
if ... : 
    代码块
    代码块
elif ... : 
    代码块
    代码块
else 
    代码块
    代码块
```

x is y x和y是同一对象
x is not y ...
x in y 
x not in y 
可以使用x<y<z

断言：assert 判断条件
如果不满足直接程序崩溃

while 判断 : 
    代码块
    代码块

for i in sequence : 
    ...
    ...

>>> range ( 3 ) 
[ 0 , 1 , 2 , 3 ]
>>> xrange ( 3 ) 
同range只不过是一个一个给出的，更为高效

