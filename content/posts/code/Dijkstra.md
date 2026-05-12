---
title: Dijkstra
date: 2021-11-27 15:44:01
# cover: https://tva1.sinaimg.cn/large/008i3skNly1gwth07vmchj31jk0qktis.jpg
tags:
- 算法
- Dijkstra
categories:
- [代码,OI]
---
Dijkstra算法用于解决单源最短路问题，假设起始点为S，在最开始我们可以知道S到某些点的距离，从中取出最小的一个，我们可以保证在我们取出这个最小值的时候不可能有任何路径可以更短的到达此点，，此过程使用了贪心的思想。每当我们找出一个这样的点就更新S到与此点相连的其它点的距离，我们每一次取点都保证取出的是最短的且未被访问的点，这就是Dijkstra算法。
<!--more-->
网上对于Dijkstra的优缺点有很好的描述我就直接引用了：

>优点:O(N\*N),加堆优化:O(N\*logN)
>缺点:    在单源最短路径问题的某些实例中，可能存在权为负的边。
>如果图G＝（V，E）不包含从源s可达的负权回路，
>则对所有v∈V，最短路径的权定义d(s,v)依然正确，
>即使它是一个负值也是如此。但如果存在一从s可达的负回路，
>最短路径的权的定义就不能成立。S到该回路上的结点就不存在最短路径。
>当有向图中出现负权时，则Dijkstra算法失效。当不存在源s可达的负回路时，
>我们可用Bellman-Ford算法实现。
>————————————————
>版权声明：本文为CSDN博主「Chandery」的原创文章，遵循CC 4.0 BY-SA版权协议，转载请附上原文出处链接及本声明。
>原文链接：https://blog.csdn.net/cdy1206473601/article/details/52648619

下面贴上我年轻时写的代码：
```
#include<cstdio>
#include<cstring>
#include<cmath>
#include<algorithm>
#include<iostream>
#include<queue>
#include<vector>

using namespace std ; 

const int maxn = 5000000 ;
int head[maxn] , nex[maxn] , to[maxn] , val[maxn] , cnt = 0 ; 
int vis[maxn] , dis[maxn] ; 
struct L {
    int val , id ; 
    bool operator < ( const L & x ) const {
        return val > x.val ; 
    }
} ; 

void add ( int x , int y , int z ) { nex[++cnt] = head[x] ; head[x] = cnt ; to[cnt] = y ; val[cnt] = z ; } 

void dijkstra ( int s ) { 
    priority_queue < L > Q ; Q.push ( ( L ) { 0 , s } ) ; dis[s] = 0 ; 
    while ( ! Q.empty ( ) ) {
        L u = Q.top ( ) ; int x = u.id ; Q.pop ( ) ; 
        if ( vis[x] ) continue ; vis[x] = 1 ; 
        for ( int i = head[x] ; i ; i = nex[i] ) { 
            if ( dis[to[i]] > dis[x] + val[i] ) {
                dis[to[i]] = dis[x] + val[i] ; 
                if ( ! vis[to[i]] ) Q.push ( ( L ) { dis[to[i]] , to[i] } ) ; 
            }
        }
    }
}

int main ( ) {
    int n , m , s ; scanf ( "%d%d%d" , & n , & m , & s ) ; 
    for ( int i = 1 ; i <= m ; i ++ ) {
        int x , y , z ; scanf ( "%d%d%d" , & x , & y , & z ) ; 
        add ( x , y , z ) ; 
    }
    for ( int i = 1 ; i <= n ; i ++ ) dis[i] = 0x7fffffff ; 
    dijkstra ( s ) ; 
    for ( int i = 1 ; i <= n ; i ++ ) printf ( "%d " , dis[i] ) ; 
}

```

