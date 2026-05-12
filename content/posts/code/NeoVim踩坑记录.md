---
title: LazyVim学习笔记-安装LazyVim
date: 2025-04-24 14:33:12
tags:
- 代码
- neoVim
- LazyVim
categories:
- [代码,NeoVim]
---
感觉这个东西配起来十分的恶心，我打算按照[官方](https://lazyvim-ambitious-devs.phillips.codes/course/chapter-1/#_install_lazyvim)的操作来做一遍。

一方面自己大四闲的要死，找点事做总是好的，另一方面网络上确实关于lazyvim的教程要么收费，要么浅尝辄止没有深入或系统的指导，所以我自己开个坑，希望能系统而全面的介绍在windows系统下的对于LazyVim和NeoVim的使用和书写方法。

当然我也没学过lua，若有不够严谨的地方多多包涵。

# Windows Terminal

首先我们参考官方推荐的在Windows使用的终端。

推荐安装Windows Terminal，然后再打开系统自带的PowerShell，这里可以直接在*开始菜单*搜索Power Shell，效果如下：

![neovim1](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/blogpic/neovim1.png)

然后可以去[Nerd Font](https://www.nerdfonts.com/font-downloads)中下载自己感兴趣的字体，这里我使用的是*JetBrainsMono Nerd Font*,解压安装包，双击其中一个ttf文件，点击安装。然后重新打开PowerShell，点击上方的倒三角，点击设置，即可设置字体。
![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/blogpic/neovim2.png)

# NeoVim安装

去[官网](https://neovim.io/)安装。
我的Windows杂七杂八安装了太多东西，例如WSL，所以有的问题可能我没遇到但是作者提及了。

> 在 Windows 上，我建议使用 Windows Linux 子系统 (WSL) 并在其中进行所有开发。WSL 远远超出了本书的讨论范围，但微软和许多在线教程都对它进行了详尽的说明。选择兼容 WSL 的 Linux 发行版、进行设置并在所选终端中运行后，即可按照以下 Linux 说明安装 Neovim。
>
> 如果您有理由（或偏好）在原生 Windows 上进行开发，最简单的方法是从 GitHub 上的[neovim/neovim](https://github.com/neovim/neovim/)存储库的发布部分获取 MSI 安装程序。
>
> 如果您已经使用 Winget、Chocolatey 或 Scoop 来管理 Windows 机器上的包，那么它们每个中都有一个 Neovim 包。
>
> 请注意，如果您使用的 Windows 系统没有 WSL，则还需要安装 C 编译器才能获得 treesitter 支持（这基本上意味着更好的语法高亮和代码导航支持）。遗憾的是，这并非易事。相关文档已记录在 [nvim-treesitter/nvim-treesitter](https://github.com/nvim-treesitter/nvim-treesitter) GitHub 仓库中，因此我在此不再赘述。

这里可以先跳过这个所谓的C语言编译的板块，后面遇到了再做处理。

# 安装LazyVim

一般我们涉及到的文件夹是在 `C:\Users\你的名字\AppData\Local`下的nvim(自己创建的)和nvim-data文件夹，这里先对它们进行清空。
然后我们便可以克隆LazyVim的启动模板，然后删除.git文件夹（要是powershell内删不了直接手动定位过去删除一样的）

```bash
git clone https://github.com/LazyVim/starter $env:LOCALAPPDATA\nvim
Remove-Item $env:LOCALAPPDATA\nvim\.git -Recurse -Force
```

在PowerShell中输入nvim回车，等待它下载。

![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/blogpic/neovim3.png)
然后就进入到LazyVim界面了
![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/blogpic/neovim4.png)

按l键可以进入插件管理界面，Lazy.nvim 拥有众多实用功能，其中最引人注目的是仅在需要时加载插件（因此得名“Lazy”），这样你的编辑器启动速度就能飞快。它还拥有一个美观的用户界面，方便管理插件的安装和更新。如下图所示

![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/blogpic/neovim5.png)

# 插件的安装

## markdown-preview

我自己有写日志的习惯，所以我首先安装了对于Markdown的相关配置
我在[这个网站](https://dotfyle.com/neovim/plugins/trending)搜索markdown，并选择了markdown-preview插件，然后我们可以看到它提供的相关代码：

![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/blogpic/neovim6.png)

接下来我们可以在./lua/plugins/ 下创建markdown-preview.lua文件，并在文件中写入return加上大括号里面的内容即可。同时我们也可以进入它提供的github的[官网](https://github.com/iamcco/markdown-preview.nvim)。在MarkdownPreview Config中可以看到它默认的配置和相关的键位。这里我认为MarkdownPreview指令太长了，于是我改了一下键位，并且设置了不自动预览和当离开markdown buffer时Zion给关闭浏览器预览。

```lua
return {
  "iamcco/markdown-preview.nvim",
  build = "cd app && npm install",
  ft = { "markdown" },
  cmd = { "MarkdownPreview", "MarkdownPreviewStop", "MarkdownPreviewToggle" },
  init = function()
    vim.g.mkdp_auto_start = 0
    vim.g.mkdp_auto_close = 1
    vim.g.mkdp_refresh_slow = 0
    vim.g.mkdp_open_to_the_world = false
    vim.g.mkdp_browser = ""
    vim.g.mkdp_theme = "dark"
  end,
  keys = {
    { "<leader>mp", "<cmd>MarkdownPreviewToggle<cr>", desc = "Toggle Markdown Preview" },
  },
}
```

## 中文标红的解决

在写markdown文档时我发现中文的字符往往由于拼写检查标红了。我又添加了拼写检查英文、中日韩都合法的操作，完整的代码如下

```lua
return {
  "iamcco/markdown-preview.nvim",
  build = "cd app && npm install",
  ft = { "markdown" },
  cmd = { "MarkdownPreview", "MarkdownPreviewStop", "MarkdownPreviewToggle" },
  init = function()
    vim.g.mkdp_auto_start = 0
    vim.g.mkdp_auto_close = 1
    vim.g.mkdp_refresh_slow =  0
    vim.g.mkdp_open_to_the_world = false
    vim.g.mkdp_browser = ""
    vim.g.mkdp_theme = "dark"
    vim.api.nvim_create_autocmd("FileType", {
      pattern = "markdown",
      callback = function()
        vim.opt.spell = true
        vim.opt.spelllang = { "en", "cjk" }
      end,
    })
  end,
  keys = {
    { "<leader>mp", "<cmd>\begin{figure}
    \centering
    \includegraphics[width=1\linewidth]{bioPic.png}
    \caption{Human Liver和Stereo-seq的空间域划分}
    \label{fig:enter-label}
\end{figure}MarkdownPreviewToggle<cr>", desc = "Toggle Markdown Preview" },
  },
}\begin{figure}
    \centering
    \includegraphics[width=1\linewidth]{bioPic.png}
    \caption{Human Liver和Stereo-seq的空间域划分}
    \label{fig:enter-label}
\end{figure}
```

## 配置AI

在PowerShell中输入nvim回车，输入x进入Lazy Extras，然后找到copilot，定位到对应的位置输入x启用。重新进入nvim。输入`:Copilot auth`启用账户并按照提示操作，具体是找到对应的弹窗，进入它提示的网址，输入弹窗给出的验证码进入github进行验证。验证完毕后即可使用。具体操作我简单试了一下Copilot-bot，应该还具有代码补全的操作：

![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/blogpic/neovim7.png)

# 个性化的一些设置

## 打开terminal时自动定位到当前文件夹

考虑到跑python代码时，重新ding
