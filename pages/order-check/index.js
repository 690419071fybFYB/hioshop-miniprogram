var util = require('../../utils/util.js');
var api = require('../../config/api.js');
const pay = require('../../services/pay.js');
const app = getApp()
const ADDRESS_PICKED_ONCE_KEY = 'checkoutAddressPickedOnce';

Page({
    data: {
        checkedGoodsList: [],
        checkedAddress: {},
        goodsOriginalPrice: 0.00, // 商品原价小计
        promotionPrice: 0.00, // 促销减免
        goodsTotalPrice: 0.00, //商品总价
        freightPrice: 0.00, //快递费
        couponPrice: 0.00, //优惠券抵扣
        vipDiscountPrice: 0.00, //会员优惠
        orderTotalPrice: 0.00, //订单总价
        actualPrice: 0.00, //实际需要支付的总价
        couponCandidates: [],
        selectedCoupons: [],
        selectedUserCouponIds: [],
        addressId: 0,
        goodsCount: 0,
        postscript: '',
        outStock: 0,
        payMethodItems: [{
                name: 'offline',
                value: '线下支付'
            },
            {
                name: 'online',
                value: '在线支付',
                checked: 'true'
            },
        ],
        payMethod:1,
        hasError: false,
        errorMessage: '',
        promotionCountdownTip: '',
        orderType: 0,
        isGroupon: false,
        grouponActivityId: 0,
        teamId: 0,
        grouponProductId: 0,
        grouponNumber: 1,
        grouponTip: '拼团订单不支持优惠券'
    },
    formatPromotionCountdown(endAt) {
        const endTs = Number(endAt || 0);
        if (!endTs) {
            return '';
        }
        const remain = endTs - Math.floor(Date.now() / 1000);
        if (remain <= 0) {
            return '活动已结束';
        }
        const day = Math.floor(remain / 86400);
        const hour = Math.floor((remain % 86400) / 3600);
        const minute = Math.floor((remain % 3600) / 60);
        const second = Math.floor(remain % 60);
        if (day > 0) {
            return `剩余${day}天${hour}时`;
        }
        const pad = (n) => String(n).padStart(2, '0');
        return `剩余${pad(hour)}:${pad(minute)}:${pad(second)}`;
    },
    mapPromotionDisplay(goodsList) {
        return (goodsList || []).map((item) => {
            const hasPromotion = Number(item.has_promotion || 0) === 1;
            const displayPrice = hasPromotion
                ? (item.display_price || item.promotion_price || item.promo_price || item.retail_price)
                : item.retail_price;
            const displayOriginalPrice = hasPromotion
                ? (item.promotion_original_price || item.original_price || item.retail_price)
                : item.retail_price;
            const displayPromotionTag = hasPromotion ? (item.promotion_tag || item.promo_tag || '') : '';
            const promotionEndAt = Number(item.promotion_end_at || 0);
            return Object.assign({}, item, {
                hasPromotion,
                displayPrice,
                displayOriginalPrice,
                displayPromotionTag,
                promotionEndAt,
                promotionCountdownText: hasPromotion ? this.formatPromotionCountdown(promotionEndAt) : ''
            });
        });
    },
    computePromotionCountdownTip(goodsList) {
        const activeEndAts = (goodsList || [])
            .filter(item => !!item.hasPromotion && Number(item.promotionEndAt || 0) > 0)
            .map(item => Number(item.promotionEndAt || 0));
        if (!activeEndAts.length) {
            return '';
        }
        const nearestEndAt = Math.min.apply(null, activeEndAts);
        const text = this.formatPromotionCountdown(nearestEndAt);
        return text ? `促销活动${text}` : '';
    },
    refreshPromotionCountdown() {
        const list = this.data.checkedGoodsList || [];
        if (!list.length) {
            return;
        }
        let changed = false;
        const nextList = list.map((item) => {
            if (!item.hasPromotion) {
                return item;
            }
            const nextCountdown = this.formatPromotionCountdown(item.promotionEndAt);
            if (nextCountdown === item.promotionCountdownText) {
                return item;
            }
            changed = true;
            return Object.assign({}, item, {
                promotionCountdownText: nextCountdown
            });
        });
        const nextTip = this.computePromotionCountdownTip(nextList);
        if (changed || nextTip !== this.data.promotionCountdownTip) {
            this.setData({
                checkedGoodsList: nextList,
                promotionCountdownTip: nextTip
            });
        }
    },
    stopPromotionTicker() {
        if (this.promotionTicker) {
            clearInterval(this.promotionTicker);
            this.promotionTicker = null;
        }
    },
    startPromotionTicker() {
        this.stopPromotionTicker();
        this.promotionTicker = setInterval(() => {
            this.refreshPromotionCountdown();
        }, 1000);
    },
    applyCheckoutResponse(data) {
        const checkedGoodsList = this.mapPromotionDisplay(data.checkedGoodsList || []);
        const promotionCountdownTip = this.computePromotionCountdownTip(checkedGoodsList);
        const vipDiscountPrice = Number(data.vipDiscountPrice || 0);
        const nextSelectedIds = this.data.isGroupon
            ? []
            : (data.selectedCoupons || []).map((item) => Number(item.user_coupon_id));
        let addressId = 0;
        if (data.checkedAddress != 0) {
            addressId = data.checkedAddress.id;
        }
        this.setData({
            checkedGoodsList: checkedGoodsList,
            checkedAddress: data.checkedAddress,
            actualPrice: data.actualPrice,
            addressId: addressId,
            freightPrice: data.freightPrice,
            couponPrice: this.data.isGroupon ? 0 : (data.couponPrice || 0),
            vipDiscountPrice: Number.isFinite(vipDiscountPrice) ? vipDiscountPrice : 0,
            couponCandidates: this.data.isGroupon ? [] : (data.couponCandidates || []),
            selectedCoupons: this.data.isGroupon ? [] : (data.selectedCoupons || []),
            selectedUserCouponIds: nextSelectedIds,
            goodsOriginalPrice: data.goodsOriginalPrice || data.goodsTotalPrice || 0,
            promotionPrice: data.promotionPrice || 0,
            goodsTotalPrice: data.goodsTotalPrice,
            orderTotalPrice: data.orderTotalPrice,
            goodsCount: data.goodsCount,
            outStock: data.outStock,
            promotionCountdownTip,
            hasError: false,
            errorMessage: ''
        });
        wx.setStorageSync('addressId', addressId);
        if (!this.data.isGroupon) {
            wx.setStorageSync('selectedUserCouponIds', nextSelectedIds);
        } else {
            wx.removeStorageSync('selectedUserCouponIds');
        }
        if (promotionCountdownTip) {
            this.startPromotionTicker();
        } else {
            this.stopPromotionTicker();
        }
    },
    payChange(e){
        let val = e.detail.value;
        if(val == 'offline'){
            this.setData({
                payMethod:0
            })
        }
        else{
            this.setData({
                payMethod:1
            })
        }
    },
    toGoodsList: function (e) {
        wx.navigateTo({
            url: '/pages/ucenter/goods-list/index?id=0',
        });
    },
    toSelectAddress: function () {
        wx.navigateTo({
            url: '/pages/ucenter/address/index?type=1',
        });
    },
    toAddAddress: function () {
        wx.navigateTo({
            url: '/pages/ucenter/address-add/index',
        })
    },
    bindinputMemo(event) {
        let postscript = event.detail.value;
        this.setData({
            postscript: postscript
        });
    },
    onLoad: function (options) {
        let addType = options.addtype;
        let orderFrom = options.orderFrom;
        const orderType = Number(options.orderType || 0);
        const grouponActivityId = Number(options.grouponActivityId || 0);
        const teamId = Number(options.teamId || 0);
        const grouponProductId = Number(options.productId || 0);
        const grouponNumber = Number(options.number || 1);
        this.setData({
            orderType: orderType,
            isGroupon: orderType === 2,
            grouponActivityId: grouponActivityId,
            teamId: teamId,
            grouponProductId: grouponProductId,
            grouponNumber: grouponNumber > 0 ? grouponNumber : 1
        });
        if (addType != undefined) {
            this.setData({
                addType: addType
            })
        }
        if (orderFrom != undefined) {
            this.setData({
                orderFrom: orderFrom
            })
        }
    },
    onUnload: function () {
        wx.removeStorageSync('addressId');
        wx.removeStorageSync(ADDRESS_PICKED_ONCE_KEY);
        this.stopPromotionTicker();
    },
    onHide: function () {
        this.stopPromotionTicker();
    },
    onShow: function () {
        try {
            let addressId = 0;
            const pickedOnce = Number(wx.getStorageSync(ADDRESS_PICKED_ONCE_KEY) || 0) === 1;
            if (pickedOnce) {
                const selectedAddressId = Number(wx.getStorageSync('addressId') || 0);
                if (selectedAddressId > 0) {
                    addressId = selectedAddressId;
                }
                wx.removeStorageSync(ADDRESS_PICKED_ONCE_KEY);
            }
            let selectedUserCouponIds = wx.getStorageSync('selectedUserCouponIds') || [];
            if (!Array.isArray(selectedUserCouponIds)) {
                selectedUserCouponIds = [];
            }
            if (this.data.isGroupon) {
                selectedUserCouponIds = [];
            }
            this.setData({
                'addressId': addressId,
                selectedUserCouponIds: selectedUserCouponIds
            });
        } catch (e) {}
        this.getCheckoutInfo();
    },
    onPullDownRefresh: function () {
        wx.showNavigationBarLoading()
        this.getCheckoutInfo();
        wx.hideNavigationBarLoading() //完成停止加载
        wx.stopPullDownRefresh() //停止下拉刷新
    },
    requestCheckout: function (addressIdOverride) {
        const addressId = typeof addressIdOverride === 'number'
            ? addressIdOverride
            : this.data.addressId;
        if (this.data.isGroupon) {
            return util.request(api.GrouponCheckout, {
                addressId: addressId,
                grouponActivityId: this.data.grouponActivityId,
                teamId: this.data.teamId,
                productId: this.data.grouponProductId,
                number: this.data.grouponNumber,
                type: 2
            }, 'GET', { page: this });
        }
        const orderFrom = this.data.orderFrom;
        const addType = this.data.addType;
        const selectedUserCouponIds = this.data.selectedUserCouponIds || [];
        return util.request(api.CartCheckout, {
            addressId: addressId,
            addType: addType,
            orderFrom: orderFrom,
            type: 0,
            selectedUserCouponIds: selectedUserCouponIds.join(',')
        }, 'GET', { page: this });
    },
    ensureAddressBeforeSubmit: function () {
        if (Number(this.data.addressId || 0) > 0) {
            return Promise.resolve(true);
        }
        return this.requestCheckout(0).then((res) => {
            if (res.errno !== 0) {
                util.showErrorToast(res.errmsg || '结算信息加载失败');
                return false;
            }
            this.applyCheckoutResponse(res.data || {});
            if (Number(this.data.addressId || 0) > 0) {
                return true;
            }
            util.showErrorToast('请选择收货地址');
            return false;
        }).catch(() => {
            util.showErrorToast('地址信息加载失败，请稍后重试');
            return false;
        });
    },
    getCheckoutInfo: function () {
        let that = this;
        that.requestCheckout().then(function (res) {
            if (res.errno === 0) {
                that.applyCheckoutResponse(res.data);
                if (res.data.outStock == 1) {
                    util.showErrorToast('有部分商品缺货或已下架');
                } else if (res.data.numberChange == 1) {
                    util.showErrorToast('部分商品库存有变动');
                } else if ((res.data.invalidSelectedIds || []).length > 0) {
                    util.showErrorToast('部分优惠券不可用，已自动移除');
                }
            }
        }).catch(function () {
            that.setData({
                hasError: true,
                errorMessage: '结算信息加载失败'
            });
            that.stopPromotionTicker();
            util.showErrorToast('结算信息加载失败');
        });
    },
    goSelectCoupon: function () {
        if (this.data.isGroupon) {
            util.showErrorToast(this.data.grouponTip);
            return;
        }
        const selectedIds = this.data.selectedUserCouponIds || [];
        wx.navigateTo({
            url: `/pages/order-coupon/index?addType=${this.data.addType || 0}&orderFrom=${this.data.orderFrom || 0}&selectedIds=${selectedIds.join(',')}`
        });
    },
    getRequestErrmsg: function (err, fallback) {
        if (err && err.errmsg) {
            return err.errmsg;
        }
        if (err && err.message) {
            return err.message;
        }
        return fallback || '请求失败，请稍后重试';
    },
    submitOrder: function (e) {
        return this.ensureAddressBeforeSubmit().then((ready) => {
            if (!ready) {
                return false;
            }
            let addressId = this.data.addressId;
            let postscript = this.data.postscript;
            let freightPrice = this.data.freightPrice;
            let actualPrice = this.data.actualPrice;
            const isGroupon = this.data.isGroupon;
            const submitApi = isGroupon ? api.GrouponSubmit : api.OrderSubmit;
            wx.showLoading({
                title: '',
                mask:true
            })
            return util.request(submitApi, {
                addressId: addressId,
                postscript: postscript,
                freightPrice: freightPrice,
                actualPrice: actualPrice,
                selectedUserCouponIds: isGroupon ? [] : (this.data.selectedUserCouponIds || []),
                grouponActivityId: this.data.grouponActivityId,
                teamId: this.data.teamId,
                productId: this.data.grouponProductId,
                number: this.data.grouponNumber,
                orderType: this.data.orderType,
                offlinePay: 0
            }, 'POST', { page: this }).then(res => {
                if (res.errno === 0) {
                    wx.removeStorageSync('orderId');
                    wx.setStorageSync('addressId', 0);
                    wx.removeStorageSync('selectedUserCouponIds');
                    const orderId = res.data.orderInfo.id;
                    pay.payOrder(parseInt(orderId)).then(res => {
                        wx.redirectTo({
                            url: '/pages/payResult/payResult?status=1&orderId=' + orderId
                        });
                    }).catch(res => {
                        wx.redirectTo({
                            url: '/pages/payResult/payResult?status=0&orderId=' + orderId
                        });
                    });
                } else {
                    util.showErrorToast(res.errmsg || '下单失败');
                }
            }).catch(err => {
                util.showErrorToast(this.getRequestErrmsg(err, '下单失败，请稍后重试'));
            }).finally(() => {
                wx.hideLoading();
            });
        });
    },
    offlineOrder: function (e) {
        return this.ensureAddressBeforeSubmit().then((ready) => {
            if (!ready) {
                return false;
            }
            let addressId = this.data.addressId;
            let postscript = this.data.postscript;
            let freightPrice = this.data.freightPrice;
            let actualPrice = this.data.actualPrice;
            const isGroupon = this.data.isGroupon;
            const submitApi = isGroupon ? api.GrouponSubmit : api.OrderSubmit;
            wx.showLoading({
                title: '',
                mask: true
            });
            return util.request(submitApi, {
                addressId: addressId,
                postscript: postscript,
                freightPrice: freightPrice,
                actualPrice: actualPrice,
                selectedUserCouponIds: isGroupon ? [] : (this.data.selectedUserCouponIds || []),
                grouponActivityId: this.data.grouponActivityId,
                teamId: this.data.teamId,
                productId: this.data.grouponProductId,
                number: this.data.grouponNumber,
                orderType: this.data.orderType,
                offlinePay: 1
            }, 'POST', { page: this }).then(res => {
                if (res.errno === 0) {
                    wx.removeStorageSync('orderId');
                    wx.setStorageSync('addressId', 0);
                    wx.removeStorageSync('selectedUserCouponIds');
                    wx.redirectTo({
                        url: '/pages/payOffline/index?status=1',
                    })
                } else {
                    util.showErrorToast(res.errmsg || '下单失败');
                    wx.redirectTo({
                        url: '/pages/payOffline/index?status=0',
                    })
                }
            }).catch(err => {
                util.showErrorToast(this.getRequestErrmsg(err, '下单失败，请稍后重试'));
                wx.redirectTo({
                    url: '/pages/payOffline/index?status=0',
                });
            }).finally(() => {
                wx.hideLoading();
            });
        });
    },
    retryLoad: function () {
        this.setData({
            hasError: false,
            errorMessage: ''
        });
        this.getCheckoutInfo();
    }
})
