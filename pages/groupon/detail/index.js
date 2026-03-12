var util = require('../../../utils/util.js');
var api = require('../../../config/api.js');

function toNumber(value, fallback) {
  var num = Number(value);
  return Number.isFinite(num) ? num : (fallback || 0);
}

Page({
  data: {
    activityId: 0,
    teamId: 0,
    activity: null,
    team: null,
    openTeams: [],
    loading: false,
    hasError: false,
    errorMessage: ''
  },
  onLoad: function (options) {
    this.setData({
      activityId: toNumber(options && options.activityId, 0),
      teamId: toNumber(options && options.teamId, 0)
    });
  },
  onShow: function () {
    this.fetchDetail();
  },
  onHide: function () {
    this.stopTicker();
  },
  onUnload: function () {
    this.stopTicker();
  },
  onShareAppMessage: function () {
    var activity = this.data.activity || {};
    var teamId = toNumber((this.data.team && this.data.team.id) || this.data.teamId, 0);
    var activityId = toNumber(activity.id || this.data.activityId, 0);
    var path = '/pages/groupon/detail/index?activityId=' + activityId;
    if (teamId > 0) {
      path += '&teamId=' + teamId;
    }
    return {
      title: activity.name || '一起拼团更优惠',
      path: path,
      imageUrl: activity.listPicUrl || ''
    };
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
  mapActivity: function (raw) {
    if (!raw) return null;
    var id = toNumber(raw.id || raw.activity_id, 0);
    if (id <= 0) return null;
    var endAt = toNumber(raw.end_at, 0);
    return {
      id: id,
      goodsId: toNumber(raw.goods_id, 0),
      productId: toNumber(raw.product_id, 0),
      name: raw.name || raw.activity_name || '拼团活动',
      tagText: raw.promo_tag || raw.tag || '拼团',
      listPicUrl: raw.list_pic_url || raw.goods_list_pic_url || '',
      groupSize: toNumber(raw.group_size, 2),
      groupPrice: toNumber(raw.group_price, 0).toFixed(2),
      retailPrice: toNumber(raw.retail_price || raw.original_price || raw.market_price, 0).toFixed(2),
      endAt: endAt,
      countdownText: this.formatCountdown(endAt)
    };
  },
  mapTeam: function (raw) {
    if (!raw) return null;
    var id = toNumber(raw.id || raw.team_id, 0);
    if (id <= 0) return null;
    var expireAt = toNumber(raw.expire_at || raw.end_at, 0);
    var members = Array.isArray(raw.members) ? raw.members : [];
    return {
      id: id,
      leaderUserId: toNumber(raw.leader_user_id, 0),
      status: toNumber(raw.status, 0),
      joinedSize: toNumber(raw.joined_size || members.length, 0),
      requiredSize: toNumber(raw.required_size || raw.group_size, 2),
      expireAt: expireAt,
      countdownText: this.formatCountdown(expireAt),
      members: members
    };
  },
  mapOpenTeam: function (raw) {
    var mapped = this.mapTeam(raw);
    if (!mapped) return null;
    mapped.leaderName = raw.leader_name || raw.nickname || '团长';
    return mapped;
  },
  refreshCountdown: function () {
    var activity = this.data.activity;
    var team = this.data.team;
    var openTeams = this.data.openTeams || [];
    var nextActivity = activity;
    var nextTeam = team;
    var changed = false;

    if (activity && activity.endAt) {
      var nextActivityText = this.formatCountdown(activity.endAt);
      if (nextActivityText !== activity.countdownText) {
        nextActivity = Object.assign({}, activity, { countdownText: nextActivityText });
        changed = true;
      }
    }

    if (team && team.expireAt) {
      var nextTeamText = this.formatCountdown(team.expireAt);
      if (nextTeamText !== team.countdownText) {
        nextTeam = Object.assign({}, team, { countdownText: nextTeamText });
        changed = true;
      }
    }

    var nextOpenTeams = openTeams.map((item) => {
      if (!item.expireAt) return item;
      var nextText = this.formatCountdown(item.expireAt);
      if (nextText === item.countdownText) return item;
      changed = true;
      return Object.assign({}, item, { countdownText: nextText });
    });

    if (changed) {
      this.setData({
        activity: nextActivity,
        team: nextTeam,
        openTeams: nextOpenTeams
      });
    }
  },
  fetchDetail: function () {
    var activityId = this.data.activityId;
    var teamId = this.data.teamId;
    if (activityId <= 0 && teamId <= 0) {
      this.setData({
        hasError: true,
        errorMessage: '缺少拼团参数'
      });
      return;
    }
    this.setData({
      loading: true,
      hasError: false,
      errorMessage: ''
    });

    var activityPromise = Promise.resolve({ errno: 0, data: {} });
    if (activityId > 0) {
      activityPromise = util.request(api.GrouponActivityDetail, { id: activityId }, 'GET', { page: this });
    }

    var teamPromise = Promise.resolve({ errno: 0, data: null });
    if (teamId > 0) {
      teamPromise = util.request(api.GrouponTeamDetail, { id: teamId }, 'GET', { page: this });
    }

    Promise.all([activityPromise, teamPromise]).then((result) => {
      var activityRes = result[0] || { errno: 0, data: {} };
      var teamRes = result[1] || { errno: 0, data: null };
      if (activityRes.errno !== 0) {
        this.setData({
          hasError: true,
          errorMessage: activityRes.errmsg || '活动详情加载失败'
        });
        return;
      }
      if (teamRes.errno && teamRes.errno !== 0) {
        this.setData({
          hasError: true,
          errorMessage: teamRes.errmsg || '团详情加载失败'
        });
        return;
      }
      var activityPayload = activityRes.data || {};
      var activity = this.mapActivity(activityPayload.activity || activityPayload.info || activityPayload);
      var openTeamsRaw = activityPayload.open_teams || activityPayload.openTeams || activityPayload.teams || [];
      var openTeams = openTeamsRaw.map((item) => this.mapOpenTeam(item)).filter(Boolean);
      var teamPayload = teamRes.data || null;
      var team = this.mapTeam(teamPayload && (teamPayload.team || teamPayload.info || teamPayload));

      if (!activity && team && toNumber(teamPayload && teamPayload.activity_id, 0) > 0) {
        this.setData({ activityId: toNumber(teamPayload.activity_id, 0) });
      }

      this.setData({
        activity: activity,
        team: team,
        openTeams: openTeams,
        hasError: false,
        errorMessage: ''
      });
      if ((activity && activity.endAt) || (team && team.expireAt) || openTeams.length > 0) {
        this.startTicker();
      } else {
        this.stopTicker();
      }
    }).catch((err) => {
      this.setData({
        hasError: true,
        errorMessage: (err && err.message) || '拼团详情加载失败'
      });
      this.stopTicker();
    }).finally(() => {
      this.setData({ loading: false });
    });
  },
  retryLoad: function () {
    this.fetchDetail();
  },
  buildOrderCheckUrl: function (teamId) {
    var activity = this.data.activity || {};
    var activityId = toNumber(activity.id || this.data.activityId, 0);
    var url = '/pages/order-check/index?orderType=2&grouponActivityId=' + activityId;
    if (toNumber(activity.productId, 0) > 0) {
      url += '&productId=' + toNumber(activity.productId, 0);
    }
    url += '&number=1';
    if (teamId > 0) {
      url += '&teamId=' + teamId;
    }
    return url;
  },
  openGroup: function () {
    if (!util.loginNow()) return;
    wx.navigateTo({
      url: this.buildOrderCheckUrl(0)
    });
  },
  joinCurrentTeam: function () {
    if (!util.loginNow()) return;
    var teamId = toNumber(this.data.team && this.data.team.id, 0);
    if (teamId <= 0) {
      util.showErrorToast('当前无可参与团');
      return;
    }
    wx.navigateTo({
      url: this.buildOrderCheckUrl(teamId)
    });
  },
  joinOpenTeam: function (event) {
    if (!util.loginNow()) return;
    var teamId = toNumber(event.currentTarget.dataset.teamId, 0);
    if (teamId <= 0) return;
    wx.navigateTo({
      url: this.buildOrderCheckUrl(teamId)
    });
  },
  goGoodsDetail: function () {
    var goodsId = toNumber(this.data.activity && this.data.activity.goodsId, 0);
    if (goodsId <= 0) return;
    wx.navigateTo({
      url: '/pages/goods/goods?id=' + goodsId
    });
  }
});
