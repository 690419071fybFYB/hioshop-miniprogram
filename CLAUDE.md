# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个微信小程序商城（海风小店），采用原生微信小程序开发。需要配合服务端项目 [hioshop-server](https://github.com/iamdarcy/hioshop-server) 使用。

## 开发环境

1. 在 [微信小程序平台](https://mp.weixin.qq.com/) 注册小程序，获取 `appid` 和 `secret`
2. 使用微信开发者工具打开项目
3. 在 `project.config.json` 中设置 `appid`
4. 在服务端项目 `hioshop-server` 的 `config.js` 中配置 `appid` 和 `secret`

## API 配置

服务端 API 地址配置在 `config/api.js` 中：

```javascript
// 修改 ApiRoot 指向实际服务端地址
const ApiRoot = 'http://localhost:8360';  // 或你的服务器地址
```

所有 API 端点都在此文件中定义，遵循 `/api/` 路径前缀。

## 架构结构

### 核心模块

| 目录 | 用途 |
|------|------|
| `config/` | API 端点配置 |
| `utils/` | 通用工具函数（网络请求、时间格式化、支付等） |
| `services/` | 业务服务层（用户登录、支付） |
| `lib/wxParse/` | 富文本解析库 |

### 页面结构

```
pages/
├── index/          # 首页
├── category/       # 分类页
├── goods/          # 商品详情
├── cart/           # 购物车
├── search/         # 搜索页
├── app-auth/       # 授权登录
├── order-check/    # 订单确认
├── payResult/      # 支付结果
└── ucenter/        # 用户中心
    ├── index/      # 我的
    ├── order-list/ # 订单列表
    ├── address/    # 收货地址
    └── footprint/  # 浏览足迹
```

## 网络请求

所有网络请求通过 `utils/util.js` 中的 `request()` 函数封装：

```javascript
util.request(api.EndpointName, data, 'POST').then(res => {
    if (res.errno === 0) {
        // 成功处理
    }
});
```

请求自动携带 `X-Hioshop-Token` 头（从 `storage.token` 读取）。

## 认证流程

1. 小程序启动时（`app.js`）自动调用 `wx.login()` 获取 code
2. 调用 `api.AuthLoginByWeixin` 登录远程服务器
3. 服务器返回 `token` 和 `userInfo`，存储到本地缓存

检查登录状态使用 `services/user.js` 中的 `checkLogin()`。

## 支付流程

支付功能位于 `services/pay.js`，调用微信支付：

```javascript
const pay = require('../../services/pay.js');
pay.payOrder(orderId).then(res => {
    // 支付成功
});
```

开发调试时可直接支付成功（注释 `wx.requestPayment` 部分，取消注释 `resolve(res)`）。

## 页面开发模式

每个页面遵循微信小程序标准结构：

```
pages/xxx/
├── index.js    # 页面逻辑
├── index.wxml  # 页面结构
├── index.wxss  # 页面样式
└── index.json  # 页面配置
```

使用 `Page()` 构造器创建页面，`getApp()` 获取全局应用实例。

## TabBar 配置

底部导航配置在 `app.json` 中，包含：首页、分类、购物车、我的四个入口。购物车 Tab 支持角标显示商品数量。
