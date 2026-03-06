const util = require('../../../utils/util.js');
const api = require('../../../config/api.js');

Page({
  data: {
    summary: {
      my_invite_code: '',
      enabled: 0,
      reward_coupon_id: 0,
      daily_limit: 10,
      total_invite_count: 0,
      total_reward_count: 0,
      today_invite_count: 0,
      today_reward_count: 0
    },
    records: [],
    page: 1,
    size: 10,
    hasMore: false,
    loading: false
  },
  onShow() {
    this.reloadAll();
  },
  onPullDownRefresh() {
    this.reloadAll().finally(() => {
      wx.stopPullDownRefresh();
    });
  },
  async reloadAll() {
    this.setData({
      page: 1,
      records: [],
      hasMore: false
    });
    await Promise.all([this.loadSummary(), this.loadRecords(true)]);
  },
  formatDateTime(ts) {
    const stamp = Number(ts || 0) * 1000;
    if (!stamp) return '-';
    const date = new Date(stamp);
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  },
  statusText(status) {
    const map = {
      issued: '已发放',
      pending: '待发放',
      skipped_limit: '超上限未发放',
      failed_coupon: '发放失败',
      disabled: '活动未开启',
      no_coupon: '未配置奖励券',
      invalid_inviter: '无效邀请',
      self_invite: '无效邀请'
    };
    return map[status] || status || '未知';
  },
  async loadSummary() {
    try {
      const res = await util.request(api.InviteMySummary);
      if (res.errno === 0) {
        this.setData({
          summary: Object.assign({}, this.data.summary, res.data || {})
        });
      } else {
        util.showErrorToast(res.errmsg || '邀请信息加载失败');
      }
    } catch (err) {
      util.showErrorToast((err && err.message) || '邀请信息加载失败');
    }
  },
  async loadRecords(reset = false) {
    if (this.data.loading) return;
    this.setData({loading: true});
    const nextPage = reset ? 1 : this.data.page;
    try {
      const res = await util.request(api.InviteMyRecords, {
        page: nextPage,
        size: this.data.size
      });
      if (res.errno === 0) {
        const payload = res.data || {};
        const list = (payload.data || []).map((item) => ({
          id: Number(item.id || 0),
          bind_at: Number(item.bind_at || 0),
          bind_time_text: this.formatDateTime(item.bind_at),
          reward_status: item.reward_status || '',
          reward_status_text: this.statusText(item.reward_status),
          invitee_nickname: item.invitee_nickname || '新用户',
          invitee_mobile_masked: item.invitee_mobile_masked || '',
          fail_reason: item.fail_reason || ''
        }));
        const merged = reset ? list : this.data.records.concat(list);
        const totalPages = Number(payload.totalPages || 0);
        const currentPage = Number(payload.currentPage || nextPage);
        this.setData({
          records: merged,
          page: currentPage + 1,
          hasMore: currentPage < totalPages
        });
      } else {
        util.showErrorToast(res.errmsg || '邀请记录加载失败');
      }
    } catch (err) {
      util.showErrorToast((err && err.message) || '邀请记录加载失败');
    } finally {
      this.setData({loading: false});
    }
  },
  loadMore() {
    if (!this.data.hasMore) return;
    this.loadRecords(false);
  },
  onShareAppMessage() {
    const inviteCode = this.data.summary.my_invite_code || '';
    if (!inviteCode) {
      util.showErrorToast('邀请码生成中，请稍后重试');
      return {
        title: '海风小店',
        path: '/pages/index/index'
      };
    }
    return {
      title: '邀请你来海风小店，注册就有福利',
      path: `/pages/index/index?invite_code=${inviteCode}`
    };
  }
});
