const store = require('../store/index.js');
const api = require('../config/api.js');

function shouldUseStore() {
  return !api.features || api.features.newStore !== false;
}

function saveSession(payload) {
  const token = (payload && payload.token) || '';
  const userInfo = (payload && payload.userInfo) || null;
  wx.setStorageSync('token', token);
  wx.setStorageSync('userInfo', userInfo || {});
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
  clearSession
};
