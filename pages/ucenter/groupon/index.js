var util = require('../../../utils/util.js');
var api = require('../../../config/api.js');

function toNumber(value, fallback) {
  var num = Number(value);
  return Number.isFinite(num) ? num : (fallback || 0);
}

var TAB_TO_STATUS = {
  ongoing: 'ongoing',
  success: 'success',
  failed: 'failed'
};

Page({
  data: {
    tab: 'ongoing',
    tabs: [
      { key: 'ongoing', text: '进行中' },
      { key: 'success', text: '已成功' },
      { key: 'failed', text: '已失败' }
    ],
    list: [],
    loading: false,
    hasError: false,
    errorMessage: ''
  },
  onLoad: function (options) {
    if (options && TAB_TO_STATUS[options.tab]) {
      this.setData({ tab: options.tab });
    }
  },
  onShow: function () {
    if (!util.loginNow()) return;
    this.fetchList();
  },
  mapItem: function (raw) {
    var id = toNumber(raw.id || raw.team_id, 0);
    return {
      id: id,
      activityId: toNumber(raw.activity_id || raw.groupon_activity_id, 0),
      orderId: toNumber(raw.order_id, 0),
      statusText: raw.status_text || raw.statusText || '--',
      activityName: raw.activity_name || raw.name || '拼团活动',
      joinedSize: toNumber(raw.joined_size || raw.member_count, 0),
      requiredSize: toNumber(raw.required_size || raw.group_size, 2),
      expireText: raw.expire_text || raw.expireTimeText || ''
    };
  },
  switchTab: function (event) {
    var tab = event.currentTarget.dataset.tab;
    if (!TAB_TO_STATUS[tab] || tab === this.data.tab) return;
    this.setData({ tab: tab });
    this.fetchList();
  },
  fetchList: function () {
    var tab = this.data.tab;
    this.setData({
      loading: true,
      hasError: false,
      errorMessage: ''
    });
    util.request(api.GrouponMyTeams, {
      status: TAB_TO_STATUS[tab],
      page: 1,
      size: 20
    }, 'GET', { page: this }).then((res) => {
      if (res.errno !== 0) {
        this.setData({
          hasError: true,
          errorMessage: res.errmsg || '拼团记录加载失败'
        });
        return;
      }
      var payload = res.data || {};
      var dataList = Array.isArray(payload.data) ? payload.data : (Array.isArray(payload) ? payload : []);
      this.setData({
        list: dataList.map((item) => this.mapItem(item)).filter((item) => item.id > 0),
        hasError: false,
        errorMessage: ''
      });
    }).catch((err) => {
      this.setData({
        hasError: true,
        errorMessage: (err && err.message) || '拼团记录加载失败'
      });
    }).finally(() => {
      this.setData({ loading: false });
    });
  },
  retryLoad: function () {
    this.fetchList();
  },
  openDetail: function (event) {
    var item = event.currentTarget.dataset.item || {};
    if (!item.activityId) return;
    var url = '/pages/groupon/detail/index?activityId=' + item.activityId;
    if (item.id) {
      url += '&teamId=' + item.id;
    }
    wx.navigateTo({ url: url });
  }
});
