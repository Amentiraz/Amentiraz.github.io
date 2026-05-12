---
title: Tarjan
date: 2021-11-29 16:50:27
# cover: https://tva1.sinaimg.cn/large/008i3skNly1gwth07vmchj31jk0qktis.jpg
tags:
- Tarjan
- 算法
categories:
- [代码,OI]
---
想当年高中组织活动的时候我还专门写过Tarjan的流程和证明，如今已经忘的干干净净，原来的代码也找不到了，只能现写了。
总的来说就是利用一个栈，将每个访问到的点push入栈，在寻找的过程中记录两个值，一个是dfn——它是第几个搜索到的，一个是low——它能衍生的点中dfn最小的值。如果一个点dfn==low说明它本身就是最小的点，把它及它栈以上的点全部pop出来就行，因为它上面的点必定是与它形成强联通分量。我们不妨假设它上面的点有不是它强联通分量的，那么此点在回溯到它本身的时候只有两种情况，一是它本身是强联通最小的点，那么在找到此点时会把它上面的点全部pop出去，另一种是它不是最小点，那么在遍历的过程中总会到第一种情况把它排除。
Tarjan程序是正确无误的，然后最后要跑一个拓扑，然鹅我不大会。luogu上爆了40pt，然后去看别人的题解秒懂。用拓扑可以优化掉ans、Q、new\_val等等数组，估计就80pt了，然后我们还得用dp去解决菊花图这种类型的数据。
这道题还给人一个教训是，对于缩点的题，我们记录下每条路径的开始与结束去构造新图，没必要单独列个Q这种数组。
40pt代码如下：
（其实会个Tarjan就行了吧）
<!--more-->
```
#include<iostream>
#include<cstdio>
#include<queue>
#include<algorithm>
#include<cstring>
#include<cmath>

using namespace std ; 
const int maxn = 100005 ; 
int n , m ; 
int head[maxn] , val[maxn] , nex[maxn] , cnt , to[maxn] , group[10004] ; 
int tot , ind , a[10004] , stac[10004] , dfn[10004] , vis[10004] , low[10004] ;
queue < int > Q[10004] ; int col , in[10004] , new_val[10004] ; 
int ans[10004] , num ; 
void add ( int x , int y ) { nex[++cnt] = head[x] ; head[x] = cnt ; to[cnt] = y ; } 

void Tarjan ( int u ) {
    dfn[u] = low[u] = ++ tot ; vis[u] = 1 ; stac[++ind] = u ;  
    for ( int i = head[u] ; i ; i = nex[i] ) {
        if ( ! dfn[to[i]] ) {
            Tarjan ( to[i] ) ; 
            low[u] = min ( low[u] , low[to[i]] ) ; 
        }   
        else if ( vis[to[i]] ) {
            low[u] = min ( low[u] , low[to[i]] ) ; 
        }
    }
    if ( low[u] == dfn[u] ) {
        int v ; col ++ ;  
        while ( v = stac[ind--] ) {
            Q[col].push ( v ) ; group[v] = col ;  
            vis[v] = 0 ; 
            if ( v == u ) break ; 
        }
    }
}

void dfs ( int x , int val ) {
    int flag = 0 ; 
    for ( int i = head[x] ; i ; i ++ ) {
        flag = 1 ; 
        dfs ( to[i] , val + new_val[to[i]] ) ; 
    }
    if ( ! flag ) {
        ans[++num] = val ; 
    }
}

void topo ( ) {
    for ( int i = 1 ; i <= col ; i ++ ) {
        if ( in[i] == 0 ) {
            dfs ( i + n , new_val[i] ) ; 
        }
    }
}

bool cmp ( int x , int y ) { return x > y ; } 

int main ( ) {
    scanf ( "%d%d" , & n , & m ) ; 
    for ( int i = 1 ; i <= n ; i ++ ) scanf ( "%d" , & a[i] ) ; 
    while ( m -- ) {
        int x , y ; scanf ( "%d%d" , & x , & y ) ; 
        add ( x , y ) ; 
    }
    for ( int i = 1 ; i <= n ; i ++ ) {
        if ( ! dfn[i] ) Tarjan ( i ) ; 
    }
    for ( int i = 1 ; i <= col ; i ++ ) {
        int new_node = i + n , val = 0 ;
        while ( ! Q[i].empty ( ) ) {
            int x = Q[i].front ( ) ; Q[i].pop ( ) ; val += a[x] ; 
            for ( int j = head[x] ; j ; j = nex[j] ) {
                if ( group[to[j]] == group[x] ) continue ; 
                add ( new_node , group[to[j]] + n ) ;
                in[to[j]] ++ ; 
            }
        }
        new_val[i] = val ; 
    }
    topo ( ) ; 
    sort ( ans + 1 , ans + 1 + num , cmp ) ; 
    printf ( "%d" , ans[1] ) ; 
    return 0 ; 
}

```
