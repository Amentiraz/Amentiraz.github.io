---
title: TOPSIS-MATLAB
date: 2021-09-22 18:35:13
#cover: https://tva1.sinaimg.cn/large/008i3skNly1gwsuvf4o55j31hb0u0k68.jpg
tags:
- 数学建模
- TOPSIS
- Matlab
categories: 
- [代码,数学建模]
---
代码如下
<!--more-->
### 主函数代码
``` 
clear;clc
load data_water_quality.mat
//正向化
[n,m] = size ( X ) ;
disp ( ['共有'num2str ( n ) '个评价对象,'num2str ( m ) '个评价指标] ) 
Judge = input (['这'num2str(m)'个指标是否需要经过正向化处理，需要输入1，不需要输入0:']);
if Judge == 1 
    Position = input ('请输入需要正向化处理的指标所在的列，例如第2、3、6三列需要处理，那么你需要输入[2,3,6]:') ; 
    disp ( '请输入需要处理的这些列的指标类型（1:极小型，2:中间型，3:区间型）') 
    Type = input ('例如2极小，3区间，6中间就输入[1,3,2]:' ) ;
    for i = 1 : size ( Position , 2 ) 
    X ( : , Position ( i ) ) = Positivization ( X ( : , Position ( i )  ) , Type ( i ) , Position ( i ) ) ;
    //Positization是我们定义的函数
    end
    disp ('正向化后的举证X=' ) 
    disp ( X ) 
end
//对正向化对举证进行标准化
Z = X ./ repmat ( sum ( X .* X ) .^ 0.5 , n , 1 ) ;
disp ( '标准化矩阵Z=' ） 
disp (Z) 
//计算最大值与最小值的距离，并算出得分
D_P = sum ( [Z - repmat ( max ( Z ) , n , 1 ) .^ 2 ] , 2 ) .^ 0.5 ; 
D_N = sum ( [Z - repmat ( min ( Z ) , n , 1 ) .^ 2 ] , 2 ) .^ 0.5 ;   
S = D_N ./ ( D_P + D_N ) ; 
disp ( '最后的得分为：' ) 
stand_S = S / sum ( S ) 
[sorted_S , index] = sort ( stand_S , 'descend' ) 
```

### Positivization函数
```
function [ posit_x ] = Positivization ( x , type , i ) 
    if type == 1 
    disp(['第'num2str ( i ) '列是极小型，正在正向化']) 
    posit_x = Min2Max ( x ) ; 
    disp(['第'num2str ( i ) '列正向化处理完成])
    disp('~~~~~~~~~~~~~~~~~~~~~分界线~~~~~~~~~~~~~~~~~~~~~~~~')
    else if type == 2 
    dis ( ['第'num2str ( i ) '列是中间型'])
    best = input ('请输入最佳的那一个值:') ; 
    posit_x = Mid2Max ( x , best ) ; 
    disp(['第'num2str ( i ) '列正向化处理完成]) ;
    disp('~~~~~~~~~~~~~~~~~~~~~分界线~~~~~~~~~~~~~~~~~~~~~~~~')
    else if type == 3                                          
    dis ( ['第'num2str ( i ) '列是区间型'])                    
    a = input ('请输入区间的下界') ;                   
    b = input ('请输入区间的上界') ;         
    posit_x = Inter2Max ( x , a , b ) ;                           
    disp(['第'num2str ( i ) '列正向化处理完成]) ;              
    disp('~~~~~~~~~~~~~~~~~~~~~分界线~~~~~~~~~~~~~~~~~~~~~~~~')
    else 
    disp ('没有这种类型的指标请检查Type向量中是否有除了1、2、3以外的其他值') 
    end
end
```

### Min2Max(x)函数
```
function [ posit_x ] = Min2Max ( x ) 
    posit_x = max ( x ) - x ; 
end
```

### Mid2Max(x,best)函数
```
function [ posit_x ] = Mid2Max ( x , best )  
    M = max ( abs ( x - best ) ) ; 
    posit_x = 1 - abs ( x - best ) / M ; 
end
```

### Inter2Max(x,a,b)函数
```
function [ posit_x ] = Inter2Max ( x , a , b ) ; 
    M = max ([ a - min ( x ) , max ( x ) - b ] ) ; 
    r_x = size ( x , 1 ) ; 
    posit_x = zeros ( r_x , 1 ) ; 
    for i = 1 : r_x
        if x(i) < a 
            posit_x(i) = 1 - ( a - x(i) ) / M ;
        else if x(i) > b 
            posit_x(i) = 1 - ( x(i) - b ) / M ; 
        else posit_x(i) = 1 ; 
        end
    end
end
```

### 原始矩阵正向化
将Excel内的数据直接粘贴进matlab里，赋值给变量
将此变量另存为至与代码相同的目录下
调用直接用load xxx.mat

### sort函数
sort(A)若A是向量不管是列还是行向量，默认都是对A进行升序排序，sort(A)是默认的升序，而sort(A,'descend')是降序
若A是矩阵，默认对A的割裂进行升序排列
sort ( A , dim ) ; 
dim = 1 时 等效于sort ( A ) ; 
dim = 2 时 表示对A的各列进行升序排列
若欲爆裂排列前的索引，则可用[sA,index] = sort ( A , 'decend' ) ; 
A = [ 2 , 1 , 3 , 8 ] 
sA = [ 8 , 3 , 2 , 1 ] 
index = [ 4 , 3 , 1 , 2 ] 

### 定义函数
function [输出变量] = 函数名称（输入变量） 
函数的中间部分都是函数体
函数的最后要用end结尾
输出变量和输入变量可以有多个，用逗号隔开
例如：

```
function [ a , b , c ] = test ( d , e , f ) 
a = d + e ;
b = e + f ; 
c = f + d ; 
end 
```

### zeros, ones函数
zeros ( 3 ) ; 
```
ans = 
0 0 0 
0 0 0 
0 0 0 
```
zeros ( 3 , 1 ) ; 
```
ans = 
0 
0
0
```
ones同理
