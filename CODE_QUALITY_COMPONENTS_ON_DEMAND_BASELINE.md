# 小程序组件按需载入与性能基线

## 1. 本次已落地项（Phase 1）

- 在 `app.json` 启用按需载入：
  - `"lazyCodeLoading": "requiredComponents"`
- 移除 `app.json` 全局 `usingComponents`。
- 清理页面冗余组件声明：
  - `pages/cart/cart.json` 删除 `van-loading`
  - `pages/index/index.json` 删除 `van-empty`
  - `pages/goods/goods.json` 删除 `van-empty`、`van-tag`

## 2. 质量扫描检查清单

在微信开发者工具执行：

1. 全量编译，确认无 `Component is not found`。
2. 打开“代码质量”并重新扫描。
3. 重点确认“组件 -> 启用组件按需注入”通过。

## 3. 性能基线采集模板（整改前/后都采集）

建议每次记录一组同机型、同网络、同构建方式数据。

### 3.1 采集项

1. 冷启动耗时（进入首页）
2. 首页首屏渲染耗时
3. 主包大小
4. 总包大小
5. 代码质量扫描截图（前/后）

### 3.2 记录表（可直接复制）

| 时间 | 分支/版本 | 冷启动(ms) | 首屏渲染(ms) | 主包(KB) | 总包(KB) | 代码质量结果 |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| YYYY-MM-DD HH:mm | before |  |  |  |  | 组件按需注入: 未通过 |
| YYYY-MM-DD HH:mm | after |  |  |  |  | 组件按需注入: 通过 |

## 4. 分包规划（Phase 2 方案，不在本轮强制落地）

## 4.1 原则

1. Tab 页保留主包：`index/category/cart/ucenter`
2. 低频、非首屏页面优先下沉到子包
3. 优先保证主包首开体验，不改业务逻辑

## 4.2 建议拆分

1. `ucenter-sub`
   - `pages/ucenter/address/index`
   - `pages/ucenter/address-detail/index`
   - `pages/ucenter/order-list/index`
   - `pages/ucenter/order-details/index`
   - `pages/ucenter/express-info/index`
   - `pages/ucenter/coupon/index`
   - `pages/ucenter/footprint/index`
   - `pages/ucenter/about/index`
   - `pages/ucenter/settings/index`
   - `pages/ucenter/goods-list/index`
2. `order-sub`
   - `pages/order-check/index`
   - `pages/order-coupon/index`
   - `pages/payResult/payResult`
   - `pages/payOffline/index`
3. `tool-sub`
   - `pages/share/index`
   - `pages/debug/network/index`
   - `pages/app-auth/index`

## 4.3 分包验收标准

1. 主包大小下降（相对当前基线）。
2. 首页冷启动耗时不回退。
3. 所有跳转路径正常，无分包资源缺失。
4. 代码质量扫描项保持通过。
