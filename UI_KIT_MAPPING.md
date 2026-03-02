# 小程序 UI V2 规范与映射

## 视觉规范

- 风格：轻奢简洁
- 主色：`#e74f72`
- 强调色：`#cf3a5d`
- 页面背景：`#f7f8fb`
- 卡片背景：`#ffffff`
- 主文本：`#1f2533`
- 次文本：`#596273`
- 弱文本：`#8d96a7`
- 圆角：`10rpx / 16rpx / 24rpx`
- 间距：`8rpx / 16rpx / 24rpx / 32rpx / 40rpx`

## 组件映射

| 场景 | 旧实现 | 新实现（V2） |
|---|---|---|
| 错误提示 | 页面内联 `view + button` | `ui-error-card + van-button` |
| 加载态 | 本地 loading 图片 | `van-loading` |
| 空态 | 自定义空态块 | `van-empty` |
| 新品标识 | 自定义 `view.new-tag` | `van-tag` |
| 操作按钮 | 原生 `view/button` | `van-button` |
| 个人中心列表 | 纯自定义行 | `van-cell-group + van-cell` |

## 页面落地范围

- 首页：`pages/index/index.*`
- 分类：`pages/category/index.*`
- 商品详情：`pages/goods/goods.*`
- 购物车：`pages/cart/cart.*`
- 我的：`pages/ucenter/index/index.*`

## Feature Flags

在 `config/api.js` 通过开关控制：

- `features.newUiV2`
- `features.vantEnabled`

默认关闭，便于灰度与回滚。
