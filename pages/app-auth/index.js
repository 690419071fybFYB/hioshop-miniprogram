const util = require('../../utils/util.js');
const api = require('../../config/api.js');
const user = require('../../services/user.js');
const session = require('../../utils/session.js');
//获取应用实例
const app = getApp()

Page({
  data: {
    redirect: '',
    from: '',
    loginLoading: false
  },
  onLoad: function (options) {
    this.setData({
      redirect: options.redirect ? decodeURIComponent(options.redirect) : '',
      from: options.from || ''
    });
  },
  onShow: function () {
    let userInfo = wx.getStorageSync('userInfo');
    if (userInfo != '') {
      this.redirectAfterLogin();
    };
  },
  redirectAfterLogin() {
    const redirect = this.data.redirect || '';
    if (redirect) {
      wx.redirectTo({
        url: redirect,
        fail: () => {
          wx.navigateBack({
            delta: 1
          });
        }
      });
      return;
    }
    wx.navigateBack({
      delta: 1
    });
  },
  // getUserInfo: function (e) {
  //     app.globalData.userInfo = e.detail.userInfo
  //     user.loginByWeixin().then(res => {
  //         app.globalData.userInfo = res.data.userInfo;
  //         app.globalData.token = res.data.token;
  //         let is_new = res.data.is_new;//服务器返回的数据；
  //         if (is_new == 0) {
  //             util.showErrorToast('您已经是老用户啦！');
  //             wx.navigateBack();
  //         }
  //         else if (is_new == 1) {
  //             wx.navigateBack();
  //         }

  //     }).catch((err) => { });
  // },

  getUserProfile: function () {
    if (this.data.loginLoading) {
      return;
    }
    this.setData({ loginLoading: true });
    this.loginWithCode();
  },
  loginWithCode() {
    wx.login({
      success: (res) => {
        const code = (res && res.code) || '';
        if (!code) {
          this.setData({ loginLoading: false });
          util.showErrorToast('登录失败，请稍后重试');
          return;
        }
        this.postLogin(code);
      },
      fail: () => {
        this.setData({ loginLoading: false });
        util.showErrorToast('登录失败，请稍后重试');
      }
    });
  },
  postLogin(code) {
    let that = this;
    util.request(api.AuthLoginByWeixin, {
      code: code
    }, 'POST', { skipAuthRefresh: true }).then(function (res) {
      if (res.errno === 0) {
        session.saveSession({
          token: res.data.token,
          userInfo: res.data.userInfo
        });
        app.globalData.userInfo = res.data.userInfo;
        app.globalData.token = res.data.token;
        let is_new = res.data.is_new; //服务器返回的数据；
        if (is_new == 0) {
          util.showSuccessToast('登录成功');
          that.redirectAfterLogin();
        } else if (is_new == 1) {
          util.showSuccessToast('登录成功');
          that.redirectAfterLogin();
        }
      } else {
        util.showErrorToast(res.errmsg || '登录失败');
      }
      that.setData({ loginLoading: false });
    }).catch(function () {
      that.setData({ loginLoading: false });
      util.showErrorToast('登录失败，请稍后重试');
    });
  },
  goBack: function () {
    wx.navigateBack();
  }
})
