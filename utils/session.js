const store = require('../store/index.js');
const api = require('../config/api.js');
const PROFILE_COMPLETED_KEY = 'profileCompleted';
const PLACEHOLDER_NICKNAME = '微信用户';

function normalizeNickname(nickname) {
  return String(nickname || '').trim();
}

function isValidMobile(mobile) {
  return /^1[3-9]\d{9}$/.test(String(mobile || '').trim());
}

function isProfileComplete(userDetail) {
  const profile = userDetail || {};
  const nickname = normalizeNickname(profile.nickname || profile.nickName);
  const mobile = String(profile.mobile || '').trim();
  return !!nickname && nickname !== PLACEHOLDER_NICKNAME && isValidMobile(mobile);
}

function setProfileCompleted(value) {
  wx.setStorageSync(PROFILE_COMPLETED_KEY, !!value);
}

function getProfileCompleted() {
  return !!wx.getStorageSync(PROFILE_COMPLETED_KEY);
}

function syncProfileCompleted(userDetail) {
  const completed = isProfileComplete(userDetail);
  setProfileCompleted(completed);
  return completed;
}

function shouldUseStore() {
  return !api.features || api.features.newStore !== false;
}

function saveSession(payload) {
  const token = (payload && payload.token) || '';
  const userInfo = (payload && payload.userInfo) || null;
  wx.setStorageSync('token', token);
  wx.setStorageSync('userInfo', userInfo || {});
  syncProfileCompleted(userInfo);
  if (shouldUseStore()) {
    store.patch({
      session: {
        token,
        isLogin: !!token
      },
      user: userInfo
    });
  }
}

function clearSession() {
  wx.removeStorageSync('token');
  wx.removeStorageSync('userInfo');
  wx.removeStorageSync(PROFILE_COMPLETED_KEY);
  if (shouldUseStore()) {
    store.patch({
      session: {
        token: '',
        isLogin: false
      },
      user: null
    });
  }
}

module.exports = {
  saveSession,
  clearSession,
  isProfileComplete,
  syncProfileCompleted,
  setProfileCompleted,
  getProfileCompleted
};
