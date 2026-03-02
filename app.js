var util = require('utils/util.js');
var api = require('config/api.js');
const store = require('./store/index.js');
const session = require('./utils/session.js');
function useStore() {
  return !api.features || api.features.newStore !== false;
}
App({
  data: {
    deviceInfo: {}
  },
  onLaunch: function () {
    this.data.deviceInfo = util.getDeviceInfo();
    console.log(this.data.deviceInfo);
    // 展示本地存储能力
    var logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)
    // 登录
    wx.login({
      success: (res) => {
        util.request(api.AuthLoginByWeixin, {
          code: res.code
        }, 'POST', { skipAuthRefresh: true }).then((res) => {
          if (res.errno === 0) {
            session.saveSession({
              token: res.data.token,
              userInfo: res.data.userInfo
            });
            this.globalData.userInfo = res.data.userInfo;
            this.globalData.token = res.data.token;
          }
        }).catch(function () {
          // Keep app boot stable even if login API is temporarily unavailable.
        });
      },
    });
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

    // Keep old globalData path for compatibility during migration.
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
  globalData: {
    userInfo: {
      nickname: '点我登录',
      username: '点击登录',
      avatar: 'https://lucky-icon.meiweiyuxian.com/hio/default_avatar_big.png'
    },
    token: '',
  }
})
