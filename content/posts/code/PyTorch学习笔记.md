---
title: PyTorch学习笔记
date: 2024-11-25 14:55:21
tags:
- 学习笔记
- 深度学习
- PyTorch
categories:
- [代码,PyTorch]
---
基于Pytorch官方教程

<!--more-->
Tensors(张量)，可以使用GPU进行计算
改变张量大小：
```python
x = torch.randn(4,4)
y = x.view(16)
z = x.view(-1,8) #2,8
```
使用.item()获取value
```python
x = torch.randn(1)
print(x)
print(x.item())
```

# PyTorch自动微分

如果想计算导数可以调用Tensor.backward().如果Tensor是标量，即它包含一个元素数据，则不需要指定任何参数backward,但是如果它有更多元素，则需要指定一个gradient参数，来指定张量的形状.
```python
import torch
x = torch.ones(2,2,requires_grad=True)
print(x)
y = x + 2 
print(y)
print(y.grad_fn)
z=y*y*3
out=z.mean()
print(z,out)
print(x.grad)
out.backward()
print(x.grad)
x.grad.zero_()
y = y.mean()
y.backward()
print(x.grad)
```


# PyTorch 神经网络
```python
import torch
import torch.nn as nn
import torch.nn.functional as F
class Net(nn.Module):
    def __init__(self):
        super(Net, self).__init__()
        # 1 input image channel, 6 output channels, 5x5 square convolution
        # kernel
        self.conv1 = nn.Conv2d(1, 6, 5)
        self.conv2 = nn.Conv2d(6, 16, 5)
        # an affine operation: y = Wx + b
        self.fc1 = nn.Linear(16 * 5 * 5, 120)
        self.fc2 = nn.Linear(120, 84)
        self.fc3 = nn.Linear(84, 10)
    def forward(self, x):
        # Max pooling over a (2, 2) window
        x = F.max_pool2d(F.relu(self.conv1(x)), (2, 2))
        # If the size is a square you can only specify a single number
        x = F.max_pool2d(F.relu(self.conv2(x)), 2)
        x = x.view(-1, self.num_flat_features(x))
        x = F.relu(self.fc1(x))
        x = F.relu(self.fc2(x))
        x = self.fc3(x)
        return x
    def num_flat_features(self, x):
        size = x.size()[1:] # all dimensions except the batch dimension
       num_features = 1
       for s in size:
            num_features *= s
        return num_features
net = Net()
print(net)
```
我们自己定义了一个前馈函数，然后反向传播函数被自动通过autograd定义了。可以使用任何张量操作在前馈函数上。

一个模型可训练的参数可以通过调用net.parameters()返回
```python
params = list(net.parameters())
print(len(params))
```

把所有参数梯度缓存器置零，用随机的梯度来反向传播：
```python
net.zero_grad()
out.backward(torch.randn(1,10))
```

损失函数：
一个损失函数需要一对输入：模型输出和目标，然后计算一个值来评估输出距离目标有多远。
有一些不同的损失函数在nn包中。一个简单的损失函数就是nn.MSELoss,这计算了均方误差

```python
output = net(input)
target = torch.randn(10)
target = target.view(1,-1)
criterion = nn.MSELoss()
loss = criterion(output,target)
print(loss)
```

现在，如果你跟随损失到反向传播路径，可以使用它的 .grad_fn 属性，你将会看到一个这样的计算图：

```
input -> conv2d -> relu -> maxpool2d -> conv2d -> relu -> maxpool2d
-> view -> linear -> relu -> linear -> relu -> linear
-> MSELoss
-> loss
```

所以，当我们调用 loss.backward()，整个图都会微分，而且所有的在图中的requires_grad=True的张量将会让他们的 grad 张量累计梯度。

反向传播：

```python
net.zero_grad() # zeroes the gradient buffers of all parameters
print('conv1.bias.grad before backward')
print(net.conv1.bias.grad)
loss.backward()
print('conv1.bias.grad after backward')
print(net.conv1.bias.grad)
```

更新神经网络参数：

随机梯度下降：
`weight = weight - learning_rate * gradient`
python实现：
```python
learning_rate = 0.01
for f in net.parameters():
    f.data.sub_(f.grad.data * learning_rate)
```
其它更新规则：

```python
import torch.optim as optim
# create your optimizer
optimizer = optim.SGD(net.parameters(), lr=0.01)
# in your training loop:
optimizer.zero_grad() # zero the gradient buffers
output = net(input)
loss = criterion(output, target)
loss.backward()
optimizer.step() # Does the update
```

学到这暂时够用了，不够有后面再补充学习
