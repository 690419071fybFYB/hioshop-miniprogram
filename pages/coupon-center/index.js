const util = require('../../utils/util.js');
const api = require('../../config/api.js');

Page({
  data: {
    list: [],
    loading: false,
    needLoginToReceive: false
  },
  onShow() {
    const token = wx.getStorageSync('token') || '';
    this.setData({
      needLoginToReceive: !token
    });
    this.fetchList();
  },
  fetchList() {
    const that = this;
    that.setData({ loading: true });
    util.request(api.CouponCenter, {}, 'GET', { page: that })
      .then((res) => {
        if (res.errno === 0) {
          const list = (res.data || []).map((item) => ({
            ...item,
            use_start_at_text: item.use_start_at ? util.formatTimeNum(item.use_start_at, 'Y-M-D h:m') : '-',
            use_end_at_text: item.use_end_at ? util.formatTimeNum(item.use_end_at, 'Y-M-D h:m') : '-',
            actionText: Number(item.has_received) === 1 ? '已领取' : (that.data.needLoginToReceive ? '登录后领取' : '立即领取'),
            actionDisabled: Number(item.has_received) === 1
          }));
          that.setData({
            list
          });
        } else {
          util.showErrorToast(res.errmsg || '加载失败');
        }
      })
      .catch(() => {
        util.showErrorToast('加载失败');
      })
      .finally(() => {
        that.setData({ loading: false });
      });
  },
  toMyCoupons() {
    if (!util.loginNow()) return;
    wx.navigateTo({
      url: '/pages/ucenter/coupon/index?status=unused'
    });
  },
  receiveCoupon(e) {
    const couponId = Number(e.currentTarget.dataset.id || 0);
    if (couponId <= 0) {
      util.showErrorToast('参数错误');
      return;
    }
    const token = wx.getStorageSync('token') || '';
    if (!token) {
      util.showErrorToast('请先登录后领取优惠券');
      wx.switchTab({
        url: '/pages/ucenter/index/index'
      });
      return;
    }
    const that = this;
    util.request(api.CouponReceive, { couponId }, 'POST', { page: that })
      .then((res) => {
        if (res.errno === 0) {
          util.showSuccessToast('领取成功');
          that.fetchList();
        } else {
          util.showErrorToast(res.errmsg || '领取失败');
        }
      })
      .catch((err) => {
        if (err && err.code === 'UNAUTHORIZED') {
          util.showErrorToast('请先登录后领取优惠券');
          wx.switchTab({
            url: '/pages/ucenter/index/index'
          });
          return;
        }
        util.showErrorToast('领取失败');
      });
  }
});
