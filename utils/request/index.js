const api = require('../../config/api.js');
const telemetry = require('../telemetry.js');
const session = require('../session.js');

const DEFAULT_TIMEOUT = 10000;
const DEFAULT_RETRY = 2;
let isRefreshingToken = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function useTelemetry() {
  return !api.features || api.features.telemetry !== false;
}

function normalizeError(err, ctx) {
  const msg = (err && err.errMsg) || (err && err.message) || 'request:fail unknown';
  const timeout = /timeout|timed out/i.test(msg);
  const networkFail = /request:fail|connection|ssl|closed|abort|reset|refused/i.test(msg);
  return {
    code: timeout ? 'TIMEOUT' : (networkFail ? 'NETWORK_FAIL' : 'UNKNOWN'),
    message: msg,
    retriable: timeout || networkFail,
    source: (ctx && ctx.source) || 'wx.request',
    traceId: (ctx && ctx.traceId) || ''
  };
}

function shouldRetry(method, normalizedError, attempt, maxRetry) {
  return String(method || 'GET').toUpperCase() === 'GET' &&
    normalizedError.retriable &&
    attempt < maxRetry;
}

function getTopRoute() {
  try {
    const pages = getCurrentPages();
    return pages && pages.length ? pages[pages.length - 1].route : '';
  } catch (e) {
    return '';
  }
}

function withWxRequest(params) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: params.url,
      data: params.data,
      method: params.method,
      timeout: params.timeout,
      header: params.header,
      success: resolve,
      fail: reject
    });
  });
}

async function refreshTokenByWeixin() {
  if (isRefreshingToken) return false;
  isRefreshingToken = true;
  try {
    const loginResult = await new Promise((resolve, reject) => {
      wx.login({
        success: resolve,
        fail: reject
      });
    });
    if (!loginResult || !loginResult.code) return false;
    const res = await withWxRequest({
      url: api.AuthLoginByWeixin,
      data: { code: loginResult.code },
      method: 'POST',
      timeout: DEFAULT_TIMEOUT,
      header: {
        'Content-Type': 'application/json'
      }
    });
    if (res.statusCode !== 200 || !res.data || res.data.errno !== 0 || !res.data.data) {
      return false;
    }
    const token = res.data.data.token || '';
    const userInfo = res.data.data.userInfo || null;
    session.saveSession({
      token,
      userInfo
    });
    return !!token;
  } catch (e) {
    return false;
  } finally {
    isRefreshingToken = false;
  }
}

function clearSession() {
  session.clearSession();
}

async function request(url, data, method, options) {
  const opts = options || {};
  const reqMethod = String(method || 'GET').toUpperCase();
  const maxRetry = typeof opts.retry === 'number' ? opts.retry : DEFAULT_RETRY;
  const timeout = typeof opts.timeout === 'number' ? opts.timeout : DEFAULT_TIMEOUT;
  const pageRoute = opts.page && opts.page.route ? opts.page.route : getTopRoute();
  const startedAt = Date.now();
  let attempt = 0;

  while (true) {
    try {
      const token = wx.getStorageSync('token') || '';
      const res = await withWxRequest({
        url,
        data: data || {},
        method: reqMethod,
        timeout,
        header: Object.assign({
          'Content-Type': 'application/json',
          'X-Hioshop-Token': token
        }, opts.headers || {})
      });

      if (opts.page && opts.page.route && opts.page.route !== pageRoute) {
        const canceled = {
          code: 'PAGE_UNLOADED',
          message: 'page route changed, ignore stale response',
          retriable: false,
          source: 'page-guard',
          traceId: ''
        };
        if (useTelemetry()) {
          await telemetry.trackRequest({
            url,
            method: reqMethod,
            success: false,
            code: canceled.code,
            duration: Date.now() - startedAt,
            attempt
          });
        }
        return Promise.reject(canceled);
      }

      if (res.statusCode !== 200) {
        const err = normalizeError({ errMsg: 'http status ' + res.statusCode }, { source: 'http' });
        if (useTelemetry()) {
          await telemetry.trackRequest({
            url,
            method: reqMethod,
            success: false,
            code: err.code,
            duration: Date.now() - startedAt,
            attempt
          });
        }
        return Promise.reject(err);
      }

      const body = res.data || {};
      if (body.errno === 401 && !opts.skipAuthRefresh && url !== api.AuthLoginByWeixin) {
        const ok = await refreshTokenByWeixin();
        if (ok) {
          attempt += 1;
          continue;
        }
        clearSession();
        if (useTelemetry()) {
          await telemetry.trackRequest({
            url,
            method: reqMethod,
            success: false,
            code: 'UNAUTHORIZED',
            duration: Date.now() - startedAt,
            attempt
          });
        }
        return Promise.reject({
          code: 'UNAUTHORIZED',
          message: body.errmsg || 'login expired',
          retriable: false,
          source: 'auth',
          traceId: ''
        });
      }
      if (body.errno === 412 && !opts.skipProfileGuard) {
        if (useTelemetry()) {
          await telemetry.trackRequest({
            url,
            method: reqMethod,
            success: false,
            code: 'PROFILE_INCOMPLETE',
            duration: Date.now() - startedAt,
            attempt
          });
        }
        return Promise.reject({
          code: 'PROFILE_INCOMPLETE',
          message: body.errmsg || 'profile incomplete',
          retriable: false,
          source: 'profile',
          traceId: ''
        });
      }

      if (useTelemetry()) {
        await telemetry.trackRequest({
          url,
          method: reqMethod,
          success: true,
          code: 'OK',
          duration: Date.now() - startedAt,
          attempt
        });
      }
      return body;
    } catch (err) {
      const normalized = normalizeError(err, { source: 'wx.request' });
      if (shouldRetry(reqMethod, normalized, attempt, maxRetry)) {
        await sleep(200 * Math.pow(2, attempt));
        attempt += 1;
        continue;
      }
      if (useTelemetry()) {
        await telemetry.trackRequest({
          url,
          method: reqMethod,
          success: false,
          code: normalized.code,
          duration: Date.now() - startedAt,
          attempt
        });
      }
      return Promise.reject(normalized);
    }
  }
}

module.exports = {
  request,
  clearSession,
  refreshTokenByWeixin
};
