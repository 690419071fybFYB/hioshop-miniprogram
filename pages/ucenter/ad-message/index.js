const util = require('../../../utils/util.js');
const api = require('../../../config/api.js');

Page({
  data: {
    list: [],
    page: 1,
    size: 10,
    total: 0,
    loading: false,
    finished: false,
    empty: false
  },
  formatTime(ts) {
    const seconds = Number(ts || 0);
    if (seconds <= 0) {
      return '';
    }
    const date = new Date(seconds * 1000);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${mm}`;
  },
  mapRow(item) {
    const now = Math.floor(Date.now() / 1000);
    const endTime = Number(item.end_time || 0);
    const isExpired = endTime > 0 && endTime < now;
    return {
      ...item,
      statusText: isExpired ? '已过期' : '进行中',
      statusClass: isExpired ? 'expired' : 'active',
      startTimeText: this.formatTime(item.start_time),
      endTimeText: this.formatTime(item.end_time)
    };
  },
  loadList(reset = false) {
    if (this.data.loading) {
      return;
    }
    const nextPage = reset ? 1 : this.data.page;
    if (!reset && this.data.finished) {
      return;
    }
    this.setData({
      loading: true
    });
    const that = this;
    util.request(api.AdMessageList, {
      page: nextPage,
      size: this.data.size
    }, 'GET', { page: that, silent401: true }).then(function (res) {
      if (res.errno !== 0) {
        util.showErrorToast(res.errmsg || '消息加载失败');
        that.setData({
          loading: false
        });
        return;
      }
      const data = res.data || {};
      const rows = (data.list || []).map((item) => that.mapRow(item));
      const merged = reset ? rows : (that.data.list || []).concat(rows);
      const total = Number(data.total || 0);
      const loaded = merged.length;
      that.setData({
        list: merged,
        total: total,
        page: nextPage + 1,
        finished: loaded >= total || rows.length < that.data.size,
        empty: merged.length === 0,
        loading: false
      });
    }).catch(function (err) {
      that.setData({
        loading: false
      });
      if (err && err.code === 'UNAUTHORIZED') {
        util.showErrorToast('登录状态失效，请重新登录');
        wx.navigateBack();
        return;
      }
      util.showErrorToast((err && err.message) || '消息加载失败');
    });
  },
  markReadAllThenLoad() {
    const that = this;
    util.request(api.AdReadAll, {}, 'POST', { page: that, silent401: true }).finally(function () {
      that.loadList(true);
    });
  },
  navigateByAd(ad) {
    if (!ad) {
      return;
    }
    const linkType = Number(ad.link_type || 0);
    if (linkType === 0) {
      const goodsId = Number(ad.goods_id || 0);
      if (goodsId <= 0) {
        util.showErrorToast('广告跳转配置错误');
        return;
      }
      wx.navigateTo({
        url: `/pages/goods/goods?id=${goodsId}`
      });
      return;
    }
    const link = String(ad.link || '').trim();
    if (!/^\/pages\/[a-zA-Z0-9_/-]+(?:\?[^#\s]*)?$/.test(link)) {
      util.showErrorToast('广告链接无效');
      return;
    }
    const tabPages = [
      '/pages/index/index',
      '/pages/category/index',
      '/pages/cart/cart',
      '/pages/ucenter/index/index'
    ];
    const purePath = link.split('?')[0];
    if (tabPages.includes(purePath)) {
      wx.switchTab({ url: purePath });
      return;
    }
    wx.navigateTo({ url: link });
  },
  onTapMessage(e) {
    const idx = Number(e.currentTarget.dataset.index || -1);
    if (idx < 0 || idx >= this.data.list.length) {
      return;
    }
    const row = this.data.list[idx];
    this.navigateByAd(row);
  },
  onLoad() {
    this.markReadAllThenLoad();
  },
  onPullDownRefresh() {
    this.markReadAllThenLoad();
    wx.stopPullDownRefresh();
  },
  onReachBottom() {
    this.loadList(false);
  }
});
