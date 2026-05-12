---
title: LCA
date: 2021-11-29 11:20:10
#cover: https://tva1.sinaimg.cn/large/008i3skNly1gwth07vmchj31jk0qktis.jpg
tags:
- LCA
- 算法
categories:
- [代码,OI]
---

>LCA（Least Common Ancestors），即最近公共祖先，是指在有根树中，找出某两个结点u和v最近的公共祖先。 ———来自百度百科

对于一棵树来说，我们为了求它的最近公共祖先其实思路和快速幂是差不多的，我们不能直接一个个的向上查找，这样会使时间复杂度爆表，我们应当以2^k的速率往上找，这样可以使其时间复杂度降为log级别。
不得不说luogu上的题解实在是晦涩难懂，我能明白他们在寻找相同深度的点的时候使用log可以更快的找到，但是其实可以一层层的向上跳，可能时间复杂度常数上乘个5左右的数，但影响不大。（还是自己的代码好懂）
听说树链剖分也可以做，但这玩意写起来太麻烦了，我高中最快时写一遍也要半个小时（毕竟100多行）
总之，我们求LCA时首先找每个节点2^i的父亲，然后先将它们跳到相同的深度然后再同时向上跳，注意特判其中一个节点就是LCA。
<!--more-->
```
#include<cstdio>
#include<cstring>
#include<algorithm>
#include<cmath>
#include<iostream>

using namespace std ;

const int maxn = 1000005 ;
int n , m , s ;
int head[maxn] , to[maxn] , nex[maxn] , cnt = 0 ;
int father[maxn][20] , dep[maxn] ;

void add ( int x , int y ) { nex[++cnt] = head[x] ; head[x] = cnt ; to[cnt] = y ; }

void dfs ( int x , int fa , int depth ) {
    father[x][0] = fa ; dep[x] = depth ;
    for ( int i = 1 ; i <= 19 ; i ++ ) {
        father[x][i] = father[father[x][i-1]][i-1] ;
    }
    for ( int i = head[x] ; i ; i = nex[i] ) {
        if ( to[i] == fa ) continue ;
        dfs ( to[i] , x , depth + 1 ) ;
    }
}

int LCA ( int x , int y ) {
    if ( dep[x] < dep[y] ) swap ( x , y ) ;
    for ( int i = 19 ; i >= 0 ; i -- ) {
        if ( dep[father[x][i]] >= dep[y] ) {
            x = father[x][i] ;
        }
    }
    if ( x == y ) return x ;
    for ( int i = 19 ; i >= 0 ; i -- ) {
        if ( father[x][i] != father[y][i] ) {
            x = father[x][i] , y = father[y][i] ;
        }
    }
    return father[x][0] ;
}

int main ( ) {
    scanf ( "%d%d%d" , & n , & m , & s ) ;
    for ( int i = 1 ; i < n ; i ++ ) {
        int x , y ; scanf ( "%d%d" , & x , & y ) ;
        add ( x , y ) ; add ( y , x ) ;
    }
    dfs ( s , 0 , 1 ) ;
    while ( m -- ) {
        int x , y ; scanf ( "%d%d" , & x , & y ) ;
        printf ( "%d\n" , LCA ( x , y ) ) ;
    }
}
```
