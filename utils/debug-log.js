const LOG_KEY = 'mini_debug_logs';
const MAX_LOGS = 120;

function nowTs() {
  return Date.now();
}

function safeGetLogs() {
  try {
    const raw = wx.getStorageSync(LOG_KEY);
    return Array.isArray(raw) ? raw : [];
  } catch (e) {
    return [];
  }
}

function safeSetLogs(logs) {
  try {
    wx.setStorageSync(LOG_KEY, logs);
  } catch (e) {}
}

function append(event, payload) {
  const item = {
    ts: nowTs(),
    event: String(event || 'unknown'),
    payload: payload || {}
  };
  const logs = safeGetLogs();
  logs.unshift(item);
  safeSetLogs(logs.slice(0, MAX_LOGS));
  return item;
}

function list(limit) {
  const max = Number(limit || 50);
  return safeGetLogs().slice(0, max > 0 ? max : 50);
}

function clear() {
  safeSetLogs([]);
}

module.exports = {
  LOG_KEY,
  append,
  list,
  clear
};
