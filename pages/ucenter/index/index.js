var util = require('../../../utils/util.js');
var api = require('../../../config/api.js');
const session = require('../../../utils/session.js');

const app = getApp()

Page({
  data: {
    userInfo: {},
    hasUserInfo: false,
    status: {},
    root: api.ApiRoot,
    avatarDisplayUrl: '/images/icon/default_avatar_big.png',
    is_new: 0,
    root: api.ApiRoot,
    showLoginProfileSheet: false,
    adUnreadCount: 0,
    uiV2: !!(api.features.newUiV2 && api.features.vantEnabled),
    vantEnabled: !!api.features.vantEnabled
  },
  setUserInfoView(userInfo) {
    const token = wx.getStorageSync('token') || '';
    const nextUserInfo = userInfo || {};
    this.setData({
      userInfo: nextUserInfo,
      avatarDisplayUrl: util.normalizeImageUrl(nextUserInfo.avatar, api.ApiRoot),
      hasUserInfo: !!token
    });
  },
  ensureProfileReady() {
    const pass = util.loginNow();
    if (!pass) {
      const token = wx.getStorageSync('token') || '';
      if (token) {
        this.setData({
          showLoginProfileSheet: true
        });
      }
      return false;
    }
    return true;
  },
  goProfile: function (e) {
    if (!this.ensureProfileReady()) return;
    wx.navigateTo({
      url: '/pages/ucenter/settings/index',
    });
  },
  toOrderListTap: function (event) {
    if (!this.ensureProfileReady()) return;
    let showType = event.currentTarget.dataset.index;
    wx.setStorageSync('showType', showType);
    wx.navigateTo({
      url: '/pages/ucenter/order-list/index?showType=' + showType,
    });
  },
  toAddressList: function (e) {
    if (!this.ensureProfileReady()) return;
    wx.navigateTo({
      url: '/pages/ucenter/address/index?type=0',
    });
  },
  toAbout: function () {
    wx.navigateTo({
      url: '/pages/ucenter/about/index',
    });
  },
  toDebugNetwork: function () {
    wx.navigateTo({
      url: '/pages/debug/network/index'
    });
  },
  toFootprint: function (e) {
    if (!this.ensureProfileReady()) return;
    wx.navigateTo({
      url: '/pages/ucenter/footprint/index',
    });
  },
  toCoupon: function () {
    if (!this.ensureProfileReady()) return;
    wx.navigateTo({
      url: '/pages/ucenter/coupon/index?skin=promo'
    });
  },
  toGroupon: function () {
    if (!this.ensureProfileReady()) return;
    wx.navigateTo({
      url: '/pages/ucenter/groupon/index'
    });
  },
  toInvite: function () {
    if (!this.ensureProfileReady()) return;
    wx.navigateTo({
      url: '/pages/ucenter/invite/index'
    });
  },
  toAdMessage: function () {
    if (!this.ensureProfileReady()) return;
    wx.navigateTo({
      url: '/pages/ucenter/ad-message/index'
    });
  },
  handleLoginTap() {
    const token = wx.getStorageSync('token') || '';
    if (!token) {
      this.goAuth((ok) => {
        if (ok) {
          this.getSettingsDetail({
            forceOpenProfileSheet: true
          });
        }
      }, {
        forceOpenProfileSheet: true
      });
      return;
    }
    this.setData({
      showLoginProfileSheet: true
    });
  },
  goAuth(done, options) {
    let that = this;
    const authOptions = options || {};
    wx.login({
      success: (res) => {
        if (!res.code) {
          util.showErrorToast('登录失败，请稍后重试');
          if (typeof done === 'function') done(false);
          return;
        }
        that.postLogin(res.code, done, authOptions);
      },
      fail: () => {
        util.showErrorToast('登录失败，请稍后重试');
        if (typeof done === 'function') done(false);
      }
    });
  },
  postLogin(code, done, options) {
    let that = this;
    const authOptions = options || {};
    const forceOpenProfileSheet = !!authOptions.forceOpenProfileSheet;
    const inviteCode = session.getPendingInviteCode();
    util.request(api.AuthLoginByWeixin, {
      code: code,
      invite_code: inviteCode
    }, 'POST', { skipAuthRefresh: true }).then(function (res) {
      if (res.errno === 0) {
        let userInfo = res.data.userInfo;
        that.setData({
          is_new: res.data.is_new,
          showLoginProfileSheet: forceOpenProfileSheet
        })
        that.setUserInfoView(userInfo);
        session.saveSession({
          token: res.data.token,
          userInfo
        });
        app.globalData.userInfo = userInfo;
        app.globalData.token = res.data.token;
        session.clearPendingInviteCode();
        if (typeof done === 'function') done(true);
      } else {
        util.showErrorToast(res.errmsg || '登录失败，请稍后重试');
        if (typeof done === 'function') done(false);
      }
    }).catch(function () {
      util.showErrorToast('登录失败，请稍后重试');
      if (typeof done === 'function') done(false);
    });
  },
  ensureLoginAndLoadProfile() {
    const token = wx.getStorageSync('token') || '';
    if (!token) {
      this.setData({
        hasUserInfo: false,
        showLoginProfileSheet: false,
        userInfo: {},
        avatarDisplayUrl: '/images/icon/default_avatar_big.png'
      });
      return;
    }
    this.getSettingsDetail();
  },
  onLoad: function (options) {
    // 统一在 onShow 处理登录态和资料态，避免首屏重复请求。
  },
  onShow: function () {
    this.ensureLoginAndLoadProfile();
    this.getOrderInfo();
    this.getAdUnreadCount();
    wx.removeStorageSync('categoryId');
  },
  getSettingsDetail(options) {
    const pageOptions = options || {};
    const forceOpenProfileSheet = !!pageOptions.forceOpenProfileSheet;
    let that = this;
    util.request(api.SettingsDetail).then(function (res) {
      if (res.errno === 0) {
        let userInfo = res.data;
        const completed = session.syncProfileCompleted(userInfo);
        that.setUserInfoView(userInfo);
        that.setData({
          showLoginProfileSheet: forceOpenProfileSheet || !completed
        });
        app.globalData.userInfo = userInfo;
      } else if (res.errno === 100) {
        session.setProfileCompleted(false);
        that.setData({
          hasUserInfo: false,
          showLoginProfileSheet: false,
          adUnreadCount: 0
        });
      }
    }).catch(function (err) {
      // 避免未处理 Promise 导致 MiniProgramError
      if (err && err.code === 'UNAUTHORIZED') {
        session.setProfileCompleted(false);
        that.setData({
          hasUserInfo: false,
          showLoginProfileSheet: false,
          adUnreadCount: 0
        });
        return;
      }
      util.showErrorToast((err && err.message) || '用户信息加载失败');
    });
  },
  onProfileSheetSuccess(e) {
    const profile = e.detail && e.detail.profile ? e.detail.profile : {};
    const completed = session.syncProfileCompleted(profile);
    this.setUserInfoView(profile);
    this.setData({
      showLoginProfileSheet: !completed
    });
    this.getOrderInfo();
    this.getAdUnreadCount();
  },
  onProfileSheetCancel() {
    this.setData({
      showLoginProfileSheet: false
    });
  },
  onPullDownRefresh: function () {
    wx.showNavigationBarLoading()
    this.getOrderInfo();
    wx.hideNavigationBarLoading() //完成停止加载
    wx.stopPullDownRefresh() //停止下拉刷新
  },
  getOrderInfo: function (e) {
    const token = wx.getStorageSync('token') || '';
    if (!token || !session.getProfileCompleted()) {
      this.setData({
        status: {}
      });
      return;
    }
    let that = this;
    util.request(api.OrderCountInfo).then(function (res) {
      if (res.errno === 0) {
        let status = res.data;
        that.setData({
          status: status
        });
      }
    }).catch(function () {
      that.setData({
        status: {}
      });
    });
  },
  getAdUnreadCount() {
    const token = wx.getStorageSync('token') || '';
    if (!token || !session.getProfileCompleted()) {
      this.setData({
        adUnreadCount: 0
      });
      return;
    }
    let that = this;
    util.request(api.AdUnreadCount, {}, 'GET', { page: that, silent401: true }).then(function (res) {
      if (res.errno === 0) {
        that.setData({
          adUnreadCount: Number(res.data && res.data.count || 0)
        });
        return;
      }
      that.setData({
        adUnreadCount: 0
      });
    }).catch(function () {
      that.setData({
        adUnreadCount: 0
      });
    });
  },
})
