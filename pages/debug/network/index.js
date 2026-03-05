const api = require('../../../config/api.js');
const util = require('../../../utils/util.js');
const debugLog = require('../../../utils/debug-log.js');

function formatTs(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    const pad = (n) => (n < 10 ? '0' + n : '' + n);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch (e) {
    return String(ts);
  }
}

Page({
  data: {
    runtime: {},
    networkType: 'unknown',
    checks: [],
    logs: []
  },
  onLoad() {
    this.refreshRuntime();
    this.refreshLogs();
    this.refreshNetworkType();
  },
  onShow() {
    this.refreshLogs();
    this.refreshNetworkType();
  },
  refreshRuntime() {
    this.setData({
      runtime: {
        platform: api.runtime.platform,
        isRealDevice: api.runtime.isRealDevice,
        isDevtools: api.runtime.isDevtools,
        apiRoot: api.ApiRoot
      }
    });
  },
  refreshNetworkType() {
    if (!wx.getNetworkType) return;
    wx.getNetworkType({
      success: (res) => {
        this.setData({
          networkType: res.networkType || 'unknown'
        });
      }
    });
  },
  refreshLogs() {
    const logs = debugLog.list(60).map((item) => ({
      ...item,
      timeText: formatTs(item.ts)
    }));
    this.setData({ logs });
  },
  clearLogs() {
    debugLog.clear();
    this.refreshLogs();
    wx.showToast({
      title: '已清空',
      icon: 'none'
    });
  },
  useDevApi() {
    try {
      wx.setStorageSync('apiRootOverride', 'http://127.0.0.1:8360');
    } catch (e) {}
    api.applyApiRoot('http://127.0.0.1:8360');
    this.refreshRuntime();
    wx.showToast({
      title: '已切到本地API',
      icon: 'none'
    });
  },
  useProdApi() {
    try {
      wx.setStorageSync('apiRootOverride', 'https://api.fybshop.site');
    } catch (e) {}
    api.applyApiRoot('https://api.fybshop.site');
    this.refreshRuntime();
    wx.showToast({
      title: '已切到线上API',
      icon: 'none'
    });
  },
  clearApiOverride() {
    try {
      wx.removeStorageSync('apiRootOverride');
    } catch (e) {}
    api.applyApiRoot('');
    this.refreshRuntime();
    wx.showToast({
      title: '已清除覆盖值',
      icon: 'none'
    });
  },
  async runChecks() {
    const endpoints = [
      { name: '首页数据', url: api.IndexUrl },
      { name: '频道配置', url: api.ShowSettings },
      { name: '分类列表', url: api.CatalogList }
    ];
    const checks = [];
    for (let i = 0; i < endpoints.length; i++) {
      const item = endpoints[i];
      const start = Date.now();
      try {
        const res = await util.request(item.url, {}, 'GET', {
          timeout: 5000,
          retry: 0,
          silent401: true,
          skipProfileGuard: true
        });
        checks.push({
          name: item.name,
          ok: res && res.errno === 0,
          errno: res && typeof res.errno !== 'undefined' ? res.errno : '',
          errmsg: (res && res.errmsg) || '',
          duration: Date.now() - start
        });
      } catch (err) {
        checks.push({
          name: item.name,
          ok: false,
          errno: err && err.code ? err.code : 'FAIL',
          errmsg: (err && err.message) || 'request failed',
          duration: Date.now() - start
        });
      }
    }
    this.setData({ checks });
    this.refreshLogs();
  },
  copySummary() {
    const summary = {
      runtime: this.data.runtime,
      networkType: this.data.networkType,
      checks: this.data.checks,
      latestLogs: this.data.logs.slice(0, 10)
    };
    wx.setClipboardData({
      data: JSON.stringify(summary, null, 2)
    });
  }
});
