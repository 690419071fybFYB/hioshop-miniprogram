var util = require('../../../utils/util.js');
var api = require('../../../config/api.js');

function toNumber(value, fallback) {
  var num = Number(value);
  return Number.isFinite(num) ? num : (fallback || 0);
}

Page({
  data: {
    goodsId: 0,
    list: [],
    loading: false,
    hasError: false,
    errorMessage: ''
  },
  onLoad: function (options) {
    var goodsId = toNumber(options && options.goodsId, 0);
    this.setData({
      goodsId: goodsId
    });
  },
  onShow: function () {
    this.fetchList();
  },
  onHide: function () {
    this.stopTicker();
  },
  onUnload: function () {
    this.stopTicker();
  },
  stopTicker: function () {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  },
  startTicker: function () {
    this.stopTicker();
    this.ticker = setInterval(() => {
      this.refreshCountdown();
    }, 1000);
  },
  formatCountdown: function (endAt) {
    var endTs = toNumber(endAt, 0);
    if (!endTs) return '';
    var remain = endTs - Math.floor(Date.now() / 1000);
    if (remain <= 0) return '已结束';
    var day = Math.floor(remain / 86400);
    var hour = Math.floor((remain % 86400) / 3600);
    var minute = Math.floor((remain % 3600) / 60);
    var second = Math.floor(remain % 60);
    if (day > 0) {
      return '剩余' + day + '天' + hour + '时';
    }
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return '剩余' + pad(hour) + ':' + pad(minute) + ':' + pad(second);
  },
  mapItem: function (item) {
    var id = toNumber(item.id || item.activity_id, 0);
    var goodsId = toNumber(item.goods_id, 0);
    var groupSize = toNumber(item.group_size, 2);
    var groupPrice = toNumber(item.group_price, 0).toFixed(2);
    var retailPrice = toNumber(item.retail_price || item.original_price || item.market_price, 0).toFixed(2);
    var teamCount = toNumber(item.open_team_count || item.team_count || 0, 0);
    var endAt = toNumber(item.end_at, 0);
    return {
      id: id,
      goodsId: goodsId,
      name: item.name || item.activity_name || '拼团活动',
      tagText: item.promo_tag || item.tag || '拼团',
      listPicUrl: item.list_pic_url || item.goods_list_pic_url || '',
      groupSize: groupSize,
      groupPrice: groupPrice,
      retailPrice: retailPrice,
      teamCount: teamCount,
      endAt: endAt,
      countdownText: this.formatCountdown(endAt)
    };
  },
  refreshCountdown: function () {
    var list = this.data.list || [];
    if (!list.length) return;
    var changed = false;
    var nextList = list.map((item) => {
      var nextText = this.formatCountdown(item.endAt);
      if (nextText === item.countdownText) return item;
      changed = true;
      return Object.assign({}, item, { countdownText: nextText });
    });
    if (changed) {
      this.setData({ list: nextList });
    }
  },
  fetchList: function () {
    var params = {
      page: 1,
      size: 20
    };
    if (this.data.goodsId > 0) {
      params.goodsId = this.data.goodsId;
    }
    this.setData({
      loading: true,
      hasError: false,
      errorMessage: ''
    });
    util.request(api.GrouponActivityList, params, 'GET', { page: this }).then((res) => {
      if (res.errno !== 0) {
        this.setData({
          hasError: true,
          errorMessage: res.errmsg || '拼团活动加载失败'
        });
        return;
      }
      var payload = res.data || {};
      var dataList = Array.isArray(payload.data) ? payload.data : (Array.isArray(payload) ? payload : []);
      var mapped = dataList.map((item) => this.mapItem(item)).filter((item) => item.id > 0);
      this.setData({
        list: mapped,
        hasError: false,
        errorMessage: ''
      });
      if (mapped.length > 0) {
        this.startTicker();
      } else {
        this.stopTicker();
      }
    }).catch((err) => {
      this.setData({
        hasError: true,
        errorMessage: (err && err.message) || '拼团活动加载失败'
      });
      this.stopTicker();
    }).finally(() => {
      this.setData({ loading: false });
    });
  },
  retryLoad: function () {
    this.fetchList();
  },
  openDetail: function (event) {
    var item = event.currentTarget.dataset.item || {};
    if (!item.id) return;
    wx.navigateTo({
      url: '/pages/groupon/detail/index?activityId=' + item.id
    });
  },
  openGoods: function (event) {
    var goodsId = toNumber(event.currentTarget.dataset.goodsId, 0);
    if (goodsId <= 0) return;
    wx.navigateTo({
      url: '/pages/goods/goods?id=' + goodsId
    });
  }
});
