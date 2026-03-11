const util = require('../../../utils/util.js');
const api = require('../../../config/api.js');

const TAB_CLAIMABLE = 'claimable';
const TAB_UNUSED = 'unused';
const TAB_USED = 'used';
const TAB_EXPIRED = 'expired';
const SKIN_PREMIUM = 'premium';
const SKIN_PROMO = 'promo';

const VALID_TABS = [TAB_CLAIMABLE, TAB_UNUSED, TAB_USED, TAB_EXPIRED];
const VALID_SKINS = [SKIN_PREMIUM, SKIN_PROMO];

const TAB_TO_STATUS = {
  [TAB_UNUSED]: 'unused',
  [TAB_USED]: 'used',
  [TAB_EXPIRED]: 'expired'
};

function normalizeTab(rawTab) {
  const tab = String(rawTab || '').trim();
  return VALID_TABS.includes(tab) ? tab : '';
}

function mapStatusToTab(status) {
  const value = String(status || '').trim();
  if (value === TAB_UNUSED || value === TAB_USED || value === TAB_EXPIRED) {
    return value;
  }
  return TAB_UNUSED;
}

function normalizeSkin(rawSkin) {
  const skin = String(rawSkin || '').trim();
  return VALID_SKINS.includes(skin) ? skin : SKIN_PREMIUM;
}

function formatNumberText(value, fallback) {
  const text = String(value === null || typeof value === 'undefined' ? '' : value).trim();
  return text || fallback;
}

function buildAmountFields(coupon) {
  if (coupon && coupon.type === 'full_reduction') {
    return {
      amountText: formatNumberText(coupon.reduce_amount, '0'),
      amountUnit: '元',
      thresholdText: `满${formatNumberText(coupon.threshold_amount, '0')}可用`,
      typeTagText: '满减券'
    };
  }

  return {
    amountText: formatNumberText(coupon && coupon.discount_rate, '0'),
    amountUnit: '折',
    thresholdText: `最高减${formatNumberText(coupon && coupon.discount_max_reduce, '0')}`,
    typeTagText: '折扣券'
  };
}

Page({
  data: {
    tab: TAB_UNUSED,
    skin: SKIN_PREMIUM,
    skinThemeClass: '',
    tabs: [
      { key: TAB_CLAIMABLE, label: '可领取' },
      { key: TAB_UNUSED, label: '未使用' },
      { key: TAB_USED, label: '已使用' },
      { key: TAB_EXPIRED, label: '已过期' }
    ],
    list: [],
    loading: false,
    emptyText: '暂无优惠券'
  },
  setCurrentSkin(skin) {
    const safeSkin = normalizeSkin(skin);
    this.setData({
      skin: safeSkin,
      skinThemeClass: safeSkin === SKIN_PROMO ? 'coupon-theme--promo' : ''
    });
  },
  setCurrentTab(tab) {
    const safeTab = normalizeTab(tab) || TAB_UNUSED;
    this.setData({
      tab: safeTab,
      emptyText: safeTab === TAB_CLAIMABLE ? '暂无可领取优惠券' : '暂无优惠券'
    });
  },
  formatCouponRule(coupon) {
    if (!coupon) return '';
    if (coupon.type === 'full_reduction') {
      return `满${coupon.threshold_amount}减${coupon.reduce_amount}`;
    }
    return `满${coupon.threshold_amount}打${coupon.discount_rate}折，封顶${coupon.discount_max_reduce}`;
  },
  formatTime(ts) {
    return ts ? util.formatTimeNum(ts, 'Y-M-D h:m') : '-';
  },
  getMyCouponStatusMeta() {
    if (this.data.tab === TAB_USED) {
      return {
        statusBadgeText: '已使用',
        statusBadgeClass: 'status-badge--used',
        secondaryTimeLabel: '使用时间',
        secondaryTimeField: 'used_time',
        cardStateClass: 'coupon-card--muted'
      };
    }

    if (this.data.tab === TAB_EXPIRED) {
      return {
        statusBadgeText: '已过期',
        statusBadgeClass: 'status-badge--expired',
        secondaryTimeLabel: '过期时间',
        secondaryTimeField: 'expire_time',
        cardStateClass: 'coupon-card--muted'
      };
    }

    return {
      statusBadgeText: '未使用',
      statusBadgeClass: 'status-badge--unused',
      secondaryTimeLabel: '有效期至',
      secondaryTimeField: 'expire_time',
      cardStateClass: ''
    };
  },
  mapClaimableCoupon(item) {
    const isReceived = Number(item && item.has_received) === 1;
    const amountFields = buildAmountFields(item);

    return {
      ...item,
      ...amountFields,
      _key: `claimable-${Number(item.id || 0)}`,
      rule_text: this.formatCouponRule(item),
      timeRangeText: `${this.formatTime(item.use_start_at)} - ${this.formatTime(item.use_end_at)}`,
      actionText: isReceived ? '已领取' : '立即领取',
      actionDisabled: isReceived,
      cardStateClass: isReceived ? 'coupon-card--disabled' : '',
      buttonStateClass: isReceived ? 'claim-btn--disabled' : 'claim-btn--active'
    };
  },
  mapMyCoupon(item) {
    const statusMeta = this.getMyCouponStatusMeta();
    const amountFields = buildAmountFields(item);
    const secondaryTs = statusMeta.secondaryTimeField === 'used_time' ? item.used_time : item.expire_time;

    return {
      ...item,
      ...amountFields,
      _key: `my-${Number(item.user_coupon_id || 0)}`,
      rule_text: this.formatCouponRule(item),
      claim_time_text: this.formatTime(item.claim_time),
      secondaryTimeLabel: statusMeta.secondaryTimeLabel,
      secondaryTimeText: this.formatTime(secondaryTs),
      statusBadgeText: statusMeta.statusBadgeText,
      statusBadgeClass: statusMeta.statusBadgeClass,
      cardStateClass: statusMeta.cardStateClass
    };
  },
  onLoad(options) {
    const skinFromQuery = normalizeSkin((options && options.skin) || (options && options.theme));
    this.setCurrentSkin(skinFromQuery);
    const tabFromQuery = normalizeTab(options && options.tab);
    if (tabFromQuery) {
      this.setCurrentTab(tabFromQuery);
      return;
    }
    this.setCurrentTab(mapStatusToTab(options && options.status));
  },
  onShow() {
    if (!util.loginNow()) return;
    this.fetchList();
  },
  switchTab(e) {
    const nextTab = normalizeTab(e.currentTarget.dataset.tab);
    if (!nextTab || nextTab === this.data.tab) return;
    this.setCurrentTab(nextTab);
    this.setData({ list: [] });
    this.fetchList();
  },
  fetchClaimableList() {
    const that = this;
    return util.request(api.CouponCenter, {}, 'GET', { page: that })
      .then((res) => {
        if (res.errno === 0) {
          that.setData({
            list: (res.data || []).map((item) => that.mapClaimableCoupon(item))
          });
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
      });
  },
  fetchMyCouponList() {
    const that = this;
    const status = TAB_TO_STATUS[that.data.tab] || 'unused';
    return util.request(api.CouponMy, {
      status: status
    }, 'GET', { page: that })
      .then((res) => {
        if (res.errno === 0) {
          that.setData({
            list: (res.data || []).map((item) => that.mapMyCoupon(item))
          });
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
      });
  },
  fetchList() {
    const that = this;
    that.setData({ loading: true });
    const fetchTask = that.data.tab === TAB_CLAIMABLE
      ? that.fetchClaimableList()
      : that.fetchMyCouponList();

    return fetchTask.finally(() => {
      that.setData({ loading: false });
    });
  },
  receiveCoupon(e) {
    if (this.data.tab !== TAB_CLAIMABLE) return;
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
