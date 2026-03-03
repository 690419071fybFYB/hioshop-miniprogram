const util = require('../../../utils/util.js');
const api = require('../../../config/api.js');

Page({
  data: {
    status: 'unused',
    tabs: [
      { key: 'unused', label: '未使用' },
      { key: 'used', label: '已使用' },
      { key: 'expired', label: '已过期' }
    ],
    list: [],
    loading: false
  },
  onLoad(options) {
    if (options && options.status) {
      this.setData({ status: options.status });
    }
  },
  onShow() {
    if (!util.loginNow()) return;
    this.fetchList();
  },
  switchTab(e) {
    const status = e.currentTarget.dataset.status;
    this.setData({ status });
    this.fetchList();
  },
  fetchList() {
    const that = this;
    that.setData({ loading: true });
    util.request(api.CouponMy, {
      status: that.data.status
    }, 'GET', { page: that })
      .then((res) => {
        if (res.errno === 0) {
          const list = (res.data || []).map((item) => ({
            ...item,
            claim_time_text: item.claim_time ? util.formatTimeNum(item.claim_time, 'Y-M-D h:m') : '-',
            used_time_text: item.used_time ? util.formatTimeNum(item.used_time, 'Y-M-D h:m') : '-',
            expire_time_text: item.expire_time ? util.formatTimeNum(item.expire_time, 'Y-M-D h:m') : '-'
          }));
          that.setData({ list });
        } else {
          util.showErrorToast(res.errmsg || '加载失败');
        }
      })
      .catch((err) => {
        const requestError = err || {};
        if (requestError.code === 'UNAUTHORIZED') {
          util.showErrorToast('登录已过期，请重新登录');
          return;
        }
        util.showErrorToast(requestError.message || '加载失败');
      })
      .finally(() => {
        that.setData({ loading: false });
      });
  }
});
