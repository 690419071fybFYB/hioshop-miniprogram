var util = require('utils/util.js');
var api = require('config/api.js');
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
        }, 'POST').then(function (res) {
          if (res.errno === 0) {
            let userInfo = res.data.userInfo;
            wx.setStorageSync('token', res.data.token);
            wx.setStorageSync('userInfo', userInfo);
          }
        }).catch(function () {
          // Keep app boot stable even if login API is temporarily unavailable.
        });
      },
    });
    const windowInfo = util.getWindowInfo();
    wx.setStorageSync('systemInfo', windowInfo);
    this.globalData.ww = windowInfo.windowWidth;
    this.globalData.hh = windowInfo.windowHeight;
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
