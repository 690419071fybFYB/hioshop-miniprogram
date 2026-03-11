// 统一管理后端 API 根地址（ApiRoot）与各业务接口 URL 的配置文件。
//
// 核心职责：
// 1) 根据运行环境（真机/开发者工具）选择默认 API Root
// 2) 支持通过本地缓存 apiRootOverride 覆盖 API Root，方便联调切环境
// 3) 基于 ApiRoot 拼出所有接口地址（api.CartList / api.OrderSubmit ...）
//
// 约定：
// - api.ApiRoot 形如 https://xxx.com
// - 具体接口会拼上 /api/ 前缀：`${ApiRoot}/api/...`
let platform = '';
try {
  const sys = wx.getSystemInfoSync();
  platform = (sys && sys.platform) || '';
} catch (e) {}

// 默认 API Root：
// - 真机：通常走线上域名（避免真机请求 127.0.0.1/内网地址导致无法访问）
// - 开发者工具：默认走本地服务，便于本地调试
const DEFAULT_DEVICE_API_ROOT = 'https://api.fybshop.site';
const DEFAULT_DEVTOOLS_API_ROOT = 'http://127.0.0.1:8360';

// 本地覆盖 key（由 app.js onLaunch 解析启动参数后写入/清除）
const API_ROOT_OVERRIDE_KEY = 'apiRootOverride';

const TRUSTED_EXACT_HOSTS = [
  'api.fybshop.site',
  '127.0.0.1',
  'localhost',
  '0.0.0.0'
];

function normalizeRoot(root) {
  const value = String(root || '').trim();
  if (!value) return '';
  // 去掉末尾多余的 /
  return value.replace(/\/+$/, '');
}

// 判断是否为本地/内网地址（用于真机兜底：真机访问本地地址通常不可达）
function isLocalAddressRoot(root) {
  const value = normalizeRoot(root).toLowerCase();
  if (!value) return false;
  return (
    value.indexOf('://127.0.0.1') >= 0 ||
    value.indexOf('://localhost') >= 0 ||
    value.indexOf('://0.0.0.0') >= 0 ||
    value.indexOf('://192.168.') >= 0 ||
    value.indexOf('://10.') >= 0
  );
}

function parseHost(root) {
  const value = normalizeRoot(root);
  if (!value) return '';
  const match = value.match(/^https?:\/\/([^\/?#]+)/i);
  return match ? String(match[1] || '').toLowerCase() : '';
}

function isAllowedOverrideRoot(root) {
  const hostWithPort = parseHost(root);
  if (!hostWithPort) return false;
  const host = hostWithPort.split(':')[0];
  if (TRUSTED_EXACT_HOSTS.indexOf(host) >= 0) return true;
  if (host.endsWith('.fybshop.site')) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  return false;
}

function getStoredOverride() {
  try {
    return normalizeRoot(wx.getStorageSync(API_ROOT_OVERRIDE_KEY) || '');
  } catch (e) {
    return '';
  }
}

// 真机环境判断：wx.getSystemInfoSync().platform 通常为 ios/android
function isRealDevice() {
  return platform === 'ios' || platform === 'android';
}

function isDevtoolsRuntime() {
  return !isRealDevice();
}

function canUseApiRootOverride() {
  return isDevtoolsRuntime() && (!features || features.allowApiRootOverride !== false);
}

// 计算最终使用的 API Root：
// 1) 优先使用显式传入 explicitRoot（例如启动参数带 apiRoot）
// 2) 其次使用本地缓存 override（apiRootOverride）
// 3) 最后根据真机/开发者工具选择默认 root
// 真机若拿到本地/内网地址，会回退到 DEFAULT_DEVICE_API_ROOT（避免不可访问）
function resolveApiRoot(explicitRoot) {
  const explicit = normalizeRoot(explicitRoot);
  if (explicit) {
    if (canUseApiRootOverride() && isAllowedOverrideRoot(explicit)) {
      return explicit;
    }
  }
  const stored = getStoredOverride();
  if (stored && canUseApiRootOverride() && isAllowedOverrideRoot(stored)) {
    if (isRealDevice() && isLocalAddressRoot(stored)) {
      return DEFAULT_DEVICE_API_ROOT;
    }
    return stored;
  }
  return isRealDevice() ? DEFAULT_DEVICE_API_ROOT : DEFAULT_DEVTOOLS_API_ROOT;
}

// 功能开关（前端可通过 api.features.* 决定是否启用某些新逻辑/新 UI）
const features = {
  newRequestSdk: true,
  newStore: true,
  telemetry: true,
  newUiV2: false,
  vantEnabled: true,
  allowApiRootOverride: true
};

const api = {
  features,
  runtime: {
    // 运行环境信息（用于调试/埋点）
    platform,
    isRealDevice: isRealDevice(),
    isDevtools: isDevtoolsRuntime(),
    defaultDeviceApiRoot: DEFAULT_DEVICE_API_ROOT,
    defaultDevtoolsApiRoot: DEFAULT_DEVTOOLS_API_ROOT,
    overrideKey: API_ROOT_OVERRIDE_KEY
  }
};

// 应用 API Root，并基于该 root 生成所有接口 URL。
// 注意：该函数会“改写” api 对象上的 ApiRoot 和各接口字段。
function applyApiRoot(nextRoot) {
  const apiRoot = resolveApiRoot(nextRoot);
  const apiRootUrl = apiRoot + '/api/';

  // 记录当前使用的 API Root（不带 /api/ 后缀）
  api.ApiRoot = apiRoot;

  // 登录
  api.AuthLoginByWeixin = apiRootUrl + 'auth/loginByWeixin';
  api.AuthPhoneNumber = apiRootUrl + 'auth/phoneNumber';

  // 首页
  api.IndexUrl = apiRootUrl + 'index/appInfo';
  api.AdMessageList = apiRootUrl + 'ad/messages';
  api.AdUnreadCount = apiRootUrl + 'ad/unreadCount';
  api.AdReadAll = apiRootUrl + 'ad/readAll';

  // 分类
  api.CatalogList = apiRootUrl + 'catalog/index';
  api.CatalogCurrent = apiRootUrl + 'catalog/current';
  api.GetCurrentList = apiRootUrl + 'catalog/currentlist';

  // 购物车
  api.CartAdd = apiRootUrl + 'cart/add';
  api.CartList = apiRootUrl + 'cart/index';
  api.CartUpdate = apiRootUrl + 'cart/update';
  api.CartDelete = apiRootUrl + 'cart/delete';
  api.CartChecked = apiRootUrl + 'cart/checked';
  api.CartGoodsCount = apiRootUrl + 'cart/goodsCount';
  api.CartCheckout = apiRootUrl + 'cart/checkout';

  // 商品
  api.GoodsCount = apiRootUrl + 'goods/count';
  api.GoodsDetail = apiRootUrl + 'goods/detail';
  api.GoodsList = apiRootUrl + 'goods/list';
  api.GoodsShare = apiRootUrl + 'goods/goodsShare';
  api.SaveUserId = apiRootUrl + 'goods/saveUserId';

  // 收货地址
  api.AddressDetail = apiRootUrl + 'address/addressDetail';
  api.DeleteAddress = apiRootUrl + 'address/deleteAddress';
  api.SaveAddress = apiRootUrl + 'address/saveAddress';
  api.GetAddresses = apiRootUrl + 'address/getAddresses';
  api.RegionList = apiRootUrl + 'region/list';

  // 订单/支付
  api.PayPrepayId = apiRootUrl + 'pay/preWeixinPay';
  api.OrderSubmit = apiRootUrl + 'order/submit';
  api.OrderList = apiRootUrl + 'order/list';
  api.OrderDetail = apiRootUrl + 'order/detail';
  api.OrderDelete = apiRootUrl + 'order/delete';
  api.OrderCancel = apiRootUrl + 'order/cancel';
  api.OrderConfirm = apiRootUrl + 'order/confirm';
  api.OrderCount = apiRootUrl + 'order/count';
  api.OrderCountInfo = apiRootUrl + 'order/orderCount';
  api.OrderExpressInfo = apiRootUrl + 'order/express';
  api.OrderGoods = apiRootUrl + 'order/orderGoods';

  // 优惠券
  api.CouponCenter = apiRootUrl + 'coupon/center';
  api.CouponReceive = apiRootUrl + 'coupon/receive';
  api.CouponMy = apiRootUrl + 'coupon/my';
  api.CouponPreview = apiRootUrl + 'coupon/preview';

  // 足迹
  api.FootprintList = apiRootUrl + 'footprint/list';
  api.FootprintDelete = apiRootUrl + 'footprint/delete';

  // 搜索
  api.SearchIndex = apiRootUrl + 'search/index';
  api.SearchHelper = apiRootUrl + 'search/helper';
  api.SearchClearHistory = apiRootUrl + 'search/clearHistory';

  // 设置
  api.ShowSettings = apiRootUrl + 'settings/showSettings';
  api.SaveSettings = apiRootUrl + 'settings/save';
  api.SettingsDetail = apiRootUrl + 'settings/userDetail';

  // 上传与分享
  api.UploadAvatar = apiRootUrl + 'upload/uploadAvatar';
  api.GetBase64 = apiRootUrl + 'qrcode/getBase64';

  // 拉新邀请
  api.InviteMySummary = apiRootUrl + 'invite/mySummary';
  api.InviteMyRecords = apiRootUrl + 'invite/myRecords';

  return api.ApiRoot;
}

// 对外暴露：允许 app.js 或调试页在运行时切换 API Root
api.applyApiRoot = applyApiRoot;
api.resolveApiRoot = resolveApiRoot;
api.isAllowedOverrideRoot = isAllowedOverrideRoot;
api.canUseApiRootOverride = canUseApiRootOverride;

// 初始化：加载时立即根据运行环境 + override 计算并应用一次
applyApiRoot();

module.exports = api;
