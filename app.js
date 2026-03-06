var util = require('utils/util.js');
var api = require('config/api.js');
const store = require('./store/index.js');
const session = require('./utils/session.js');
const debugLog = require('./utils/debug-log.js');

function extractInviteCode(options) {
  const launchOptions = options || {};
  const query = launchOptions.query || {};
  const extData = (launchOptions.referrerInfo && launchOptions.referrerInfo.extraData) || {};
  const fromQuery = session.normalizeInviteCode(query.invite_code || query.inviteCode || '');
  const fromExt = session.normalizeInviteCode(extData.invite_code || extData.inviteCode || '');
  return fromQuery || fromExt || '';
}

// 是否启用新的全局状态管理（store）
function useStore() {
  return !api.features || api.features.newStore !== false;
}
App({
  data: {
    // 设备信息（机型/系统/运行环境等）
    deviceInfo: {}
  },
  onLaunch: function () {
    // 小程序冷启动（首次启动）时执行一次：做环境初始化、登录、全局状态写入等
    const launchOptions = arguments[0] || {};
    const query = launchOptions.query || {};
    // 某些入口（例如从其他小程序/插件）可能通过 referrerInfo.extraData 传参
    const extData = (launchOptions.referrerInfo && launchOptions.referrerInfo.extraData) || {};

    // 支持通过启动参数临时覆盖后端 API 根地址（方便联调/切环境）
    const queryApiRoot = String(query.apiRoot || query.api_root || extData.apiRoot || '').trim();
    // 传 clearApiRoot=1 时清除覆盖
    const clearOverride = String(query.clearApiRoot || query.clear_api_root || '').trim() === '1';
    if (clearOverride) {
      try {
        wx.removeStorageSync('apiRootOverride');
      } catch (e) {}
      api.applyApiRoot('');
    } else if (queryApiRoot) {
      try {
        wx.setStorageSync('apiRootOverride', queryApiRoot);
      } catch (e) {}
      api.applyApiRoot(queryApiRoot);
    } else {
      // 未传覆盖参数时，使用默认配置（api.js 内部默认值 + 本地 override 逻辑）
      api.applyApiRoot('');
    }

    // 设备信息（写到 app.data 与日志，便于排查问题）
    this.data.deviceInfo = util.getDeviceInfo();
    console.log('[boot]', {
      platform: api.runtime.platform,
      isRealDevice: api.runtime.isRealDevice,
      apiRoot: api.ApiRoot
    });
    debugLog.append('boot', {
      platform: api.runtime.platform,
      isRealDevice: api.runtime.isRealDevice,
      isDevtools: api.runtime.isDevtools,
      apiRoot: api.ApiRoot
    });

    // 登录：先 wx.login 拿到 code，再把 code 发给后端换 token/userInfo
    wx.login({
      success: (res) => {
        const pendingInviteCode = session.getPendingInviteCode();
        util.request(api.AuthLoginByWeixin, {
          code: res.code,
          invite_code: pendingInviteCode
        }, 'POST', { skipAuthRefresh: true, timeout: 5000 }).then((res) => {
          if (res.errno === 0) {
            // 保存 session（token + 用户信息）
            session.saveSession({
              token: res.data.token,
              userInfo: res.data.userInfo
            });
            // 保留一份到 globalData，方便旧代码直接 getApp().globalData 读取
            this.globalData.userInfo = res.data.userInfo;
            this.globalData.token = res.data.token;
            session.clearPendingInviteCode();
          }
        }).catch(function () {
          // Keep app boot stable even if login API is temporarily unavailable.
        });
      },
    });

    // 窗口信息（屏幕宽高等）：写入 storage & store & globalData
    const windowInfo = util.getWindowInfo();
    wx.setStorageSync('systemInfo', windowInfo);
    if (useStore()) {
      store.patch({
        systemConfig: {
          windowWidth: windowInfo.windowWidth,
          windowHeight: windowInfo.windowHeight,
          deviceInfo: this.data.deviceInfo
        }
      });
    }
    this.globalData.ww = windowInfo.windowWidth;
    this.globalData.hh = windowInfo.windowHeight;

    // 网络状态：初始化一次，并订阅变化（写入 store）
    if (typeof wx.getNetworkType === 'function') {
      wx.getNetworkType({
        success: (res) => {
          if (useStore()) {
            store.patch({
              networkStatus: {
                isConnected: true,
                networkType: res.networkType || 'unknown'
              }
            });
          }
        }
      });
    }
    if (typeof wx.onNetworkStatusChange === 'function') {
      wx.onNetworkStatusChange((res) => {
        if (useStore()) {
          store.patch({
            networkStatus: {
              isConnected: !!res.isConnected,
              networkType: res.networkType || 'unknown'
            }
          });
        }
      });
    }

    // 兼容旧逻辑：从本地缓存恢复 token/userInfo 到 store（迁移期间保留）
    const cachedToken = wx.getStorageSync('token') || '';
    const cachedUser = wx.getStorageSync('userInfo') || null;
    if (useStore()) {
      store.patch({
        session: {
          token: cachedToken,
          isLogin: !!cachedToken
        },
        user: cachedUser
      });
    }
  },
  onShow: function (options) {
    const inviteCode = extractInviteCode(options || {});
    if (inviteCode) {
      session.setPendingInviteCode(inviteCode);
    }
  },
  onError: function (err) {
    // JS 运行时错误（同步异常）统一记录
    const message = String(err || '');
    debugLog.append('app_error', {
      message
    });
    try {
      wx.showToast({
        title: '运行错误，请看网络诊断',
        icon: 'none'
      });
    } catch (e) {}
  },
  onUnhandledRejection: function (res) {
    // 未捕获的 Promise 错误统一记录
    const reason = (res && (res.reason || res.promise)) || '';
    debugLog.append('app_unhandled_rejection', {
      reason: String(reason)
    });
  },
  onPageNotFound: function (res) {
    // 页面不存在/路由找不到时记录，便于定位错误跳转
    debugLog.append('page_not_found', {
      path: (res && res.path) || '',
      query: (res && res.query) || {}
    });
  },
  globalData: {
    // 默认用户信息（未登录/未拉取到真实用户信息时用于占位展示）
    userInfo: {
      nickname: '点我登录',
      username: '点击登录',
      avatar: 'https://lucky-icon.meiweiyuxian.com/hio/default_avatar_big.png'
    },
    // 登录 token（后端颁发，用于鉴权）
    token: '',
  }
})
