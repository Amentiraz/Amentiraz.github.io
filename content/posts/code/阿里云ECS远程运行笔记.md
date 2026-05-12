---
title: 阿里云ECS远程运行笔记
date: 2024-12-22 15:54:48
tags:
- 代码
- ECS
categories:
- [代码,ECS]
---

第一次尝试远程跑代码，记录一下流程，免得以后忘了。

<!--more-->

先用的它的免费送的一个试用版，配置是2核(vGPU)8GiB 通用算力型u1，Ubuntu系统

# 配置安全组

![](https://amentirazblogpic.oss-cn-hangzhou.aliyuncs.com/blogpic/ECS1.png)

默认应该是好的

# 连接到ECS实例

1. 本地生成SSH密钥

```bash
ssh-keygen -t rsa -b 4096
```

2. 登录ECS
```bash
ssh root@<ECS实例公网IP>
```

第一次登陆会出现提示，直接点yes就行

发现连接不上，去阿里云主页的这个实例下点击远程链接，重置了密码Simp4hanekawa

然后在浏览器上登录显示成功。

再次尝试在命令指示符运行该指令显示登陆成功

# 设置权限

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
```

# 上传公钥

```bash
echo "<粘贴公钥内容>" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

# 在pycharm中配置环境

1. 配置 SSH 连接
2. 打开 PyCharm，点击顶部菜单 File > Settings。
3. 进入 Project: <Your Project> > Python Interpreter。
4. 点击右上角的齿轮图标，选择 Add Interpreter > SSH Interpreter。
5. 输入 ECS 实例的公网 IP 和用户名（通常是 root 或创建的用户）。
6. 配置 SSH 密钥或密码完成连接。

# 在实例中安装conda

 ```bash
mkdir -p ~/miniconda3
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O ~/miniconda3/miniconda.sh
bash ~/miniconda3/miniconda.sh -b -u -p ~/miniconda3
rm ~/miniconda3/miniconda.sh
 ```

按照官方的说法进行了安装
然后剩下的操作就很简单了，直接用conda创建环境就行了

注意每次重新启动后需要再输入下列指令激活

```bash
source ~/miniconda3/bin/activate
```

---

使用 `scp`（Secure Copy Protocol）命令可以安全地将文件从本地计算机上传到远程服务器，或者从远程服务器下载到本地。它基于 SSH 协议工作，因此既安全又方便。

---

### **`scp` 命令的基本逻辑**

#### **命令格式**
```bash
scp [选项] [源路径] [目标路径]
```

- **源路径**：要复制的文件或目录的路径。
- **目标路径**：复制文件的目的地。
- **选项**：可选的参数，用于控制 `scp` 的行为。

#### **常用场景**

##### **1. 上传本地文件到远程服务器**
```bash
scp /本地/文件路径/filename root@服务器IP:/远程/目标路径/
```
示例：
```bash
scp /Users/yourname/Desktop/test.txt root@47.108.248.138:/root/data/
```
解释：
- `/Users/yourname/Desktop/test.txt` 是本地文件路径。
- `root@47.108.248.138` 是远程服务器的用户名和 IP 地址。
- `/root/data/` 是远程服务器上的目标路径。

##### **2. 上传本地目录到远程服务器**
使用 `-r` 选项递归地复制整个目录：
```bash
scp -r /本地/目录路径 root@服务器IP:/远程/目标路径/
```
示例：
```bash
scp -r /Users/yourname/Desktop/DATA root@47.108.248.138:/root/
```
这会将本地 `DATA` 目录及其所有内容上传到远程服务器的 `/root/` 目录中。

---

##### **3. 从远程服务器下载文件到本地**
```bash
scp root@服务器IP:/远程/文件路径/filename /本地/目标路径/
```
示例：
```bash
scp root@47.108.248.138:/root/data/test.txt /Users/yourname/Desktop/
```

##### **4. 从远程服务器下载目录到本地**
使用 `-r` 选项递归下载目录：
```bash
scp -r root@服务器IP:/远程/目录路径 /本地/目标路径/
```
示例：
```bash
scp -r root@47.108.248.138:/root/DATA /Users/yourname/Desktop/
```

---

### **常用选项**

| 选项 | 含义                           |
|------|--------------------------------|
| `-r` | 递归复制整个目录               |
| `-P` | 指定远程服务器的端口号（默认为22） |
| `-C` | 启用压缩传输，提高速度         |
| `-v` | 显示详细的传输过程（调试用）   |

---

### **操作步骤示例**

#### **1. 上传文件**
假设文件路径为 `/local/path/151673_filtered_feature_bc_matrix.h5`，远程服务器的目标路径为 `/root/DATA/`：

运行命令：
```bash
scp /local/path/151673_filtered_feature_bc_matrix.h5 root@47.108.248.138:/root/DATA/
```

#### **2. 验证文件是否成功上传**
登录到远程服务器，检查文件是否存在：
```bash
ssh root@47.108.248.138
ls -lh /root/DATA/151673_filtered_feature_bc_matrix.h5
```

在 Linux 环境下安装 `rpy2` 和 `R` 需要按照以下步骤进行：

---

### 1. 安装 R
R 是 `rpy2` 的依赖，必须先安装。

#### 方法 1：通过包管理器安装（推荐）
1. 更新系统包索引：
   ```bash
   sudo apt update  # 对于基于 Debian/Ubuntu 的系统
   sudo yum update  # 对于基于 Red Hat/CentOS 的系统
   ```

2. 安装 R：
   - **Ubuntu/Debian**：
     ```bash
     sudo apt install r-base
     ```
   - **CentOS/Red Hat**：
     ```bash
     sudo yum install epel-release
     sudo yum install R
     ```

#### 方法 2：从源码编译安装
如果需要特定版本，可以从 [CRAN](https://cran.r-project.org/) 下载源码并手动编译：
```bash
wget https://cran.r-project.org/src/base/R-4/R-4.x.x.tar.gz  # 替换为需要的版本
tar -xzvf R-4.x.x.tar.gz
cd R-4.x.x
./configure
make
sudo make install
```

#### 验证安装：
运行以下命令，检查 R 是否安装成功：
```bash
R --version
```

---

### 2. 安装 `rpy2`
`rpy2` 是连接 Python 和 R 的桥梁。

#### 方法 1：通过 pip 安装（推荐）
```bash
pip install rpy2
```

#### 方法 2：通过 Conda 安装
如果使用 Conda 环境，可以通过 Conda 安装：
```bash
conda install -c conda-forge rpy2
```

#### 方法 3：从源码安装
如果需要从源码安装：
```bash
git clone https://github.com/rpy2/rpy2.git
cd rpy2
python setup.py install
```

---

### 3. 配置环境变量（必要时）
有时需要确保 R 的路径已正确配置为系统环境变量。编辑 `~/.bashrc` 文件：
```bash
export R_HOME=/usr/lib/R
export R_LIBS_USER=~/.local/lib/R
export PATH=$PATH:/usr/lib/R/bin
```
然后加载配置：
```bash
source ~/.bashrc
```

---

### 4. 验证安装
启动 Python，验证是否能够成功导入 `rpy2`：
```python
import rpy2.robjects as ro

# 测试调用 R 函数
ro.r('print("Hello from R")')
```

如果输出 `Hello from R`，说明安装成功。

---

### 5. 常见问题
- **问题：R 没有安装成功？**
  确认 R 的安装路径正确，或检查是否有未满足的依赖包（例如 `gfortran`、`gcc`）。
  
- **问题：rpy2 安装报错？**
  - 确保 Python 版本与 `rpy2` 兼容（推荐使用 Python >= 3.6）。
  - 确保安装了 `R` 并且 R 的路径可被 `rpy2` 检测到。

如果问题持续，可以提供错误日志，我会进一步协助！
