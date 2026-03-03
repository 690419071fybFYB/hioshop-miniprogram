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
  fetchList() {
    const that = this;
    that.setData({ loading: true });
    util.request(api.CouponPreview, {
      addType: that.data.addType,
      orderFrom: that.data.orderFrom,
      selectedUserCouponIds: that.data.selectedIds.join(',')
    }, 'POST', { page: that })
      .then((res) => {
        if (res.errno === 0) {
          that.setData({
            list: res.data.couponCandidates || [],
            selectedIds: (res.data.selectedCoupons || []).map((item) => Number(item.user_coupon_id))
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
  onToggleCoupon(e) {
    const userCouponId = Number(e.currentTarget.dataset.id || 0);
    if (userCouponId <= 0) return;
    const row = this.data.list.find((item) => Number(item.user_coupon_id) === userCouponId);
    if (!row || row.disabled_reason) return;
    const selectedSet = new Set(this.data.selectedIds || []);
    if (selectedSet.has(userCouponId)) {
      selectedSet.delete(userCouponId);
      this.setData({ selectedIds: Array.from(selectedSet) });
      return;
    }

    // 同类型最多1张
    const selectedRows = this.data.list.filter((item) => selectedSet.has(Number(item.user_coupon_id)));
    const sameTypeRow = selectedRows.find((item) => String(item.coupon_type) === String(row.coupon_type));
    if (sameTypeRow) {
      util.showErrorToast('同类型优惠券最多选择1张');
      return;
    }
    selectedSet.add(userCouponId);
    this.setData({ selectedIds: Array.from(selectedSet) });
  },
  confirmSelect() {
    wx.setStorageSync('selectedUserCouponIds', this.data.selectedIds || []);
    wx.navigateBack();
  },
  clearSelection() {
    this.setData({ selectedIds: [] });
  }
});
