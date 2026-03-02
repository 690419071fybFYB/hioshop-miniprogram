var util = require('../../../utils/util.js');
var api = require('../../../config/api.js');
var user = require('../../../services/user.js');
const session = require('../../../utils/session.js');

// TODO 订单显示数量在图标上

const app = getApp()

Page({
  data: {
    userInfo: {},
    hasUserInfo: false,
    status: {},
    root: api.ApiRoot,
    avatarDisplayUrl: '/images/icon/default_avatar_big.png',
    is_new: 0,
    root: api.ApiRoot
  },
  goProfile: function (e) {
    let res = util.loginNow();
    if (res == true) {
      wx.navigateTo({
        url: '/pages/ucenter/settings/index',
      });
    }
  },
  toOrderListTap: function (event) {
    let res = util.loginNow();
    if (res == true) {
      let showType = event.currentTarget.dataset.index;
      wx.setStorageSync('showType', showType);
      wx.navigateTo({
        url: '/pages/ucenter/order-list/index?showType=' + showType,
      });
    }
  },
  toAddressList: function (e) {
    let res = util.loginNow();
    if (res == true) {
      wx.navigateTo({
        url: '/pages/ucenter/address/index?type=0',
      });
    }
  },
  toAbout: function () {
    wx.navigateTo({
      url: '/pages/ucenter/about/index',
    });
  },
  toFootprint: function (e) {
    let res = util.loginNow();
    if (res == true) {
      wx.navigateTo({
        url: '/pages/ucenter/footprint/index',
      });
    }
  },
  // goAuth: function (e) {
  //   wx.navigateTo({
  //     url: '/pages/app-auth/index',
  //   });
  // },
  goAuth() {
    let code = '';
    let that = this;
    wx.login({
      success: (res) => {
        code = res.code;
        that.postLogin(code)
      },
    });
  },
  postLogin(code) {
    let that = this;
    util.request(api.AuthLoginByWeixin, {
      code: code
    }, 'POST', { skipAuthRefresh: true }).then(function (res) {
      if (res.errno === 0) {
        let userInfo = res.data.userInfo;
        that.setData({
          is_new: res.data.is_new,
          userInfo: userInfo,
          avatarDisplayUrl: util.normalizeImageUrl(userInfo.avatar, api.ApiRoot),
          hasUserInfo: true
        })
        session.saveSession({
          token: res.data.token,
          userInfo
        });
        app.globalData.token = res.data.token;
      }
    });
  },
  onLoad: function (options) {
    this.goAuth();
  },
  onShow: function () {
    this.getOrderInfo();
    this.getSettingsDetail();
    wx.removeStorageSync('categoryId');
  },
  getSettingsDetail() {
    let that = this;
    util.request(api.SettingsDetail).then(function (res) {
      if (res.errno === 0) {
        let userInfo = res.data;
        // wx.setStorageSync('userInfo', userInfo);
        that.setData({
          userInfo: userInfo,
          avatarDisplayUrl: util.normalizeImageUrl(userInfo.avatar, api.ApiRoot),
          hasUserInfo: true
        });
      }
    });
  },
  onPullDownRefresh: function () {
    wx.showNavigationBarLoading()
    this.getOrderInfo();
    wx.hideNavigationBarLoading() //完成停止加载
    wx.stopPullDownRefresh() //停止下拉刷新
  },
  getOrderInfo: function (e) {
    let that = this;
    util.request(api.OrderCountInfo).then(function (res) {
      if (res.errno === 0) {
        let status = res.data;
        that.setData({
          status: status
        });
      }
    });
  },
})
