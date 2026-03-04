const util = require('../../utils/util.js');
const api = require('../../config/api.js');

Page({
  data: {
    addType: 0,
    orderFrom: 0,
    list: [],
    selectedIds: [],
    loading: false
  },
  onLoad(options) {
    const selectedIds = String(options.selectedIds || '')
      .split(',')
      .map((item) => Number(String(item).trim()))
      .filter((item) => item > 0);
    this.setData({
      addType: Number(options.addType || 0),
      orderFrom: Number(options.orderFrom || 0),
      selectedIds
    });
  },
  onShow() {
    if (!util.loginNow()) return;
    this.fetchList();
  },
  syncSelection(nextSelectedIds, showTip = false) {
    const that = this;
    that.setData({ loading: true });
    util.request(api.CouponPreview, {
      addType: that.data.addType,
      orderFrom: that.data.orderFrom,
      selectedUserCouponIds: (nextSelectedIds || []).join(',')
    }, 'POST', { page: that })
      .then((res) => {
        if (res.errno === 0) {
          const serverSelectedIds = (res.data.selectedCoupons || []).map((item) => Number(item.user_coupon_id));
          const invalidIds = res.data.invalidSelectedIds || [];
          if (showTip && invalidIds.length > 0) {
            util.showErrorToast('部分优惠券不可用，已自动移除');
          }
          that.setData({
            list: res.data.couponCandidates || [],
            selectedIds: serverSelectedIds
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
  fetchList() {
    this.syncSelection(this.data.selectedIds || [], false);
  },
  onToggleCoupon(e) {
    const userCouponId = Number(e.currentTarget.dataset.id || 0);
    if (userCouponId <= 0) return;
    const row = this.data.list.find((item) => Number(item.user_coupon_id) === userCouponId);
    if (!row || row.disabled_reason) return;
    const selectedSet = new Set(this.data.selectedIds || []);
    if (selectedSet.has(userCouponId)) {
      selectedSet.delete(userCouponId);
      this.syncSelection(Array.from(selectedSet), false);
      return;
    }

    selectedSet.add(userCouponId);
    this.syncSelection(Array.from(selectedSet), true);
  },
  confirmSelect() {
    wx.setStorageSync('selectedUserCouponIds', this.data.selectedIds || []);
    wx.navigateBack();
  },
  clearSelection() {
    this.setData({ selectedIds: [] });
  }
});
