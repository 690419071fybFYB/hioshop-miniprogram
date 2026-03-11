const util = require('../../../utils/util.js');
const api = require('../../../config/api.js');
const session = require('../../../utils/session.js');

const DEFAULT_AVATAR = '/images/icon/default_avatar_big.png';

function normalizeMobile(value) {
  return String(value || '').replace(/\s+/g, '').trim();
}

function isValidMobile(value) {
  return /^1[3-9]\d{9}$/.test(normalizeMobile(value));
}

function maskMobile(value) {
  const mobile = normalizeMobile(value);
  if (!isValidMobile(mobile)) {
    return '未授权';
  }
  return `${mobile.slice(0, 3)}****${mobile.slice(-4)}`;
}

function normalizeProfile(raw) {
  const source = raw || {};
  return {
    nickname: String(source.nickname || source.nickName || '').trim(),
    mobile: normalizeMobile(source.mobile),
    avatar: source.avatar || DEFAULT_AVATAR
  };
}

Page({
  data: {
    nickName: '',
    mobile: '',
    mobileDisplay: '未授权',
    avatarUrl: DEFAULT_AVATAR,
    avatarDisplayUrl: DEFAULT_AVATAR,
    isLoggedIn: false,
    showLoginProfileSheet: false,
    profileForSheet: {
      nickname: '',
      mobile: '',
      avatar: DEFAULT_AVATAR
    }
  },
  onLoad() {
    this.hydrateFromStorage();
    this.getSettingsDetail();
  },
  onShow() {
    this.hydrateFromStorage();
    this.getSettingsDetail();
  },
  hydrateFromStorage() {
    const cachedUserInfo = wx.getStorageSync('userInfo') || {};
    const token = wx.getStorageSync('token') || '';
    const profile = normalizeProfile(cachedUserInfo);
    this.applyProfileToView(profile);
    this.setData({
      isLoggedIn: !!token
    });
  },
  applyProfileToView(profile) {
    const normalized = normalizeProfile(profile);
    this.setData({
      nickName: normalized.nickname,
      mobile: normalized.mobile,
      mobileDisplay: maskMobile(normalized.mobile),
      avatarUrl: normalized.avatar,
      avatarDisplayUrl: util.normalizeImageUrl(normalized.avatar, api.ApiRoot),
      profileForSheet: {
        nickname: normalized.nickname,
        mobile: normalized.mobile,
        avatar: normalized.avatar
      }
    });
  },
  syncToStorage(profile) {
    const normalized = normalizeProfile(profile);
    const cachedUserInfo = wx.getStorageSync('userInfo') || {};
    wx.setStorageSync('userInfo', Object.assign({}, cachedUserInfo, {
      nickname: normalized.nickname,
      mobile: normalized.mobile,
      avatar: normalized.avatar
    }));
  },
  getSettingsDetail() {
    const that = this;
    util.request(api.SettingsDetail).then(function(res) {
      if (res.errno !== 0 || !res.data) {
        return;
      }
      const profile = normalizeProfile(res.data);
      that.applyProfileToView(profile);
      that.syncToStorage(profile);
      session.syncProfileCompleted(profile);
    }).catch(function(err) {
      // 本地优先展示，接口失败时保持本地回显
      if (err && err.code === 'UNAUTHORIZED') {
        session.setProfileCompleted(false);
      }
    });
  },
  openProfileSheet() {
    if (!this.data.profileForSheet || (!this.data.profileForSheet.nickname && !this.data.profileForSheet.mobile)) {
      this.hydrateFromStorage();
    }
    this.setData({
      showLoginProfileSheet: true
    });
  },
  onProfileSheetCancel() {
    this.setData({
      showLoginProfileSheet: false
    });
  },
  onProfileSheetSuccess(e) {
    const profile = normalizeProfile((e.detail && e.detail.profile) || {});
    this.setData({
      showLoginProfileSheet: false
    });
    this.applyProfileToView(profile);
    this.syncToStorage(profile);
    session.syncProfileCompleted(profile);

    // 异步刷新后端一致性，不阻塞当前 UI
    this.getSettingsDetail();
  },
  goBack() {
    wx.navigateBack();
  },
  handleLogout() {
    if (!this.data.isLoggedIn) {
      util.showErrorToast('当前未登录');
      return;
    }
    const that = this;
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      confirmText: '退出',
      confirmColor: '#ff3456',
      success(res) {
        if (!res.confirm) {
          return;
        }
        session.clearSession();
        session.clearPendingInviteCode();
        const app = getApp();
        if (app && app.globalData) {
          app.globalData.token = '';
          app.globalData.userInfo = {
            nickname: '点我登录',
            username: '点击登录',
            avatar: 'https://lucky-icon.meiweiyuxian.com/hio/default_avatar_big.png'
          };
        }
        that.setData({
          isLoggedIn: false,
          nickName: '',
          mobile: '',
          mobileDisplay: '未授权',
          avatarUrl: DEFAULT_AVATAR,
          avatarDisplayUrl: DEFAULT_AVATAR,
          showLoginProfileSheet: false,
          profileForSheet: {
            nickname: '',
            mobile: '',
            avatar: DEFAULT_AVATAR
          }
        });
        util.showSuccessToast('已退出登录');
        wx.switchTab({
          url: '/pages/ucenter/index/index'
        });
      }
    });
  }
});
