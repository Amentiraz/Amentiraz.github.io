---
title: DP
date: 2021-12-02 17:26:14
#cover: https://tva1.sinaimg.cn/large/008i3skNly1gwth07vmchj31jk0qktis.jpg
tags:
- DP
- 算法
categories:
- [代码,OI]
---
学了三天DP连个P都不会，总的来说就是寄了，每道题不看题解就做不来，试着做了做三道提高组难度的题，做出来了俩，另外一个没有思路。这俩题我都想出了大部分思路，但最后几步由于经验问题没想出来。做完后我以为我懂了，然后膨胀了，去挑战[低价购买](https://www.luogu.com.cn/problem/P1108)这道题。然后不出意外寄了。打算先不弄这个了，等以后在弄，先把之前写的贴上来吧。
<!--more-->
[珈百璃的堕落](https://www.luogu.com.cn/problem/P4832)
这番是好看的，题是不会的。
这道题有三个麻烦的点，一个是范围的确定，一个是dp数组的含义确定，还有一个是压缩数组的大小。
通过这道题我掌握了基本的DP递推的根据和要领，意思就是我能证明dp递推的正确性了，但然而并没有什么卵用，不会的还是不会。
我在高中时就做出来了这道题，但我认为在我高中的时候是不可能想出这道题的思路的，可以说我高中学竞赛就是在自欺欺人了（笑）。但讲道理的是，我起步太慢了，那个时候我也不是什么天才，依葫芦画瓢才是我应该干的，不管怎样我现在是不能这么干了。
一个很重要的点是，我们要继承上一个状态，又不能破坏现在的状态，所以起码要二维的数组，我们要尽力压缩空间，注意到第一维只会用到上一个的状态，所以我们调整一下。
代码：
```
#include<iostream>
#include<cstdio>
#include<algorithm>
#include<cstring>
#include<queue>
#include<cmath>

using namespace std ; 

int tots , totc , dp[2][2000006] ; 
int T = 1000000 ; 
char a[2000006] ; 

int main ( ) {
    int n ; scanf ( "%d" , & n ) ;
    int l = 0 , r = 0 ; 
    for ( int i = 0 ; i <= 2000006 ; i ++ ) dp[0][i] = dp[1][i] = -100000006 ; 
    dp[0][T] = 0 ; 
    for ( int i = 1 ; i <= n ; i ++ ) {
        scanf ( "%s" , a ) ; 
        int len = strlen ( a ) , tots = 0 , totc = 0 ; 
        for ( int j = 0 ; j < len ; j += 2 ) 
            a[j] == 's' ? tots ++ : totc ++ ; 
        int v = totc , w = tots - totc ;
        l = min ( l + w , l ) ; r = max ( r + w , r ) ; 
        for ( int j = l ; j <= r ; j ++ ) {
            dp[i&1][T+j] = max ( dp[i&1^1][T+j] , dp[i&1][T+j] ) ; 
            dp[i&1][T+j] = max ( dp[i&1^1][T+j-w] + v , dp[i&1][T+j] ) ; 
        }
    }
    cout << dp[n&1][T] ; 
    return 0 ; 
}
```
[垃圾陷阱](https://www.luogu.com.cn/problem/P1156)
其实高度和维持生命的时间可以换一下，就是时间做数组，生命做值，但太麻烦了，就没写。
要时刻记住当前状态由上一个状态推导而来，别自己吓自己。
```
#include<iostream>
#include<cstdio>
#include<cstring>
#include<cmath>
#include<algorithm>

using namespace std ; 

struct L {
    int t , f , h ; 
} trash[1005] ; 
int dp[105][105] ; 
bool cmp ( L x , L y ) { return x.t < y.t ; } 

int main ( ) {
    int D , G ; scanf ( "%d%d" , & D , & G ) ; 
    for ( int i = 1 ; i <= G ; i ++ ) scanf ( "%d%d%d" , & trash[i].t , & trash[i].f , & trash[i].h ) ; 
    sort ( trash + 1 , trash + 1 + G , cmp ) ;
    dp[0][0] = 10 ; 
    for ( int i = 1 ; i <= G ; i ++ ) {
        for ( int j = 0 ; j <= D ; j ++ ) {
            if ( j >= trash[i].h && dp[i-1][j-trash[i].h] >= trash[i].t ) {
                dp[i][j] = max ( dp[i-1][j-trash[i].h] ,dp[i][j] ) ;
            }
            if ( dp[i-1][j] >= trash[i].t ) {
                dp[i][j] = max ( dp[i-1][j] + trash[i].f , dp[i][j] ) ;
            }
        }
    }
    for ( int i = 1 ; i <= G ; i ++ ) {
        if ( dp[i][D] != 0 ) {
            cout << trash[i].t ; return 0 ; 
        }
    }
    int now = 10 ; 
    for ( int i = 1 ; i <= G; i ++ ) {
        if ( now < trash[i].t - trash[i-1].t ) { cout << trash[i-1].t + now ; return 0 ; }  
        else now = now - trash[i].t + trash[i-1].t + trash[i].f ; 
    }
    cout << trash[G].t + now ; 
    return 0 ; 
}
```

