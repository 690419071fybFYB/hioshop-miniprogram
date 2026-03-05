const LOG_KEY = 'telemetry_logs';
const MAX_LOGS = 100;
let cachedPlatform = '';

function now() {
  return Date.now();
}

function getPlatform() {
  if (cachedPlatform) return cachedPlatform;
  try {
    const sys = wx.getSystemInfoSync();
    cachedPlatform = (sys && sys.platform) || '';
  } catch (e) {
    cachedPlatform = '';
  }
  return cachedPlatform;
}

function isDeviceRuntime() {
  const platform = getPlatform();
  return platform === 'ios' || platform === 'android';
}

function getCurrentRoute() {
  try {
    const pages = getCurrentPages();
    const page = pages && pages.length ? pages[pages.length - 1] : null;
    return page ? page.route : 'unknown';
  } catch (e) {
    return 'unknown';
  }
}

function getNetworkTypeSafe() {
  return new Promise((resolve) => {
    if (!wx.getNetworkType) {
      resolve('unknown');
      return;
    }
    wx.getNetworkType({
      success: (res) => resolve(res.networkType || 'unknown'),
      fail: () => resolve('unknown')
    });
  });
}

function persist(log) {
  if (isDeviceRuntime()) return;
  try {
    const list = wx.getStorageSync(LOG_KEY) || [];
    list.unshift(log);
    wx.setStorageSync(LOG_KEY, list.slice(0, MAX_LOGS));
  } catch (e) {
    // ignore storage errors
  }
}

function track(event, payload) {
  const log = {
    ts: now(),
    event,
    route: getCurrentRoute(),
    payload: payload || {}
  };
  persist(log);
  if (!isDeviceRuntime()) {
    console.warn('[telemetry]', log);
  }
}

async function trackRequest(payload) {
  const networkType = await getNetworkTypeSafe();
  track('request', Object.assign({ networkType }, payload));
}

module.exports = {
  track,
  trackRequest,
  LOG_KEY
};
