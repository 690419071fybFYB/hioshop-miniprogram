const util = require('../../utils/util.js');
const api = require('../../config/api.js');

Page({
  data: {
    list: [],
    loading: false
  },
  onShow() {
    if (!util.loginNow()) return;
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
            use_end_at_text: item.use_end_at ? util.formatTimeNum(item.use_end_at, 'Y-M-D h:m') : '-'
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
      .catch(() => {
        util.showErrorToast('领取失败');
      });
  }
});
