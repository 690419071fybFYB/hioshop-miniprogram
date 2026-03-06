var util = require('../../utils/util.js');
var api = require('../../config/api.js');
const pay = require('../../services/pay.js');
const app = getApp()

Page({
    data: {
        checkedGoodsList: [],
        checkedAddress: {},
        goodsOriginalPrice: 0.00, // 商品原价小计
        promotionPrice: 0.00, // 促销减免
        goodsTotalPrice: 0.00, //商品总价
        freightPrice: 0.00, //快递费
        couponPrice: 0.00, //优惠券抵扣
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
        promotionCountdownTip: ''
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
        const nextSelectedIds = (data.selectedCoupons || []).map((item) => Number(item.user_coupon_id));
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
            couponPrice: data.couponPrice || 0,
            couponCandidates: data.couponCandidates || [],
            selectedCoupons: data.selectedCoupons || [],
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
        wx.setStorageSync('selectedUserCouponIds', nextSelectedIds);
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
        this.stopPromotionTicker();
    },
    onHide: function () {
        this.stopPromotionTicker();
    },
    onShow: function () {
        // 页面显示
        // TODO结算时，显示默认地址，而不是从storage中获取的地址值
        try {
            var addressId = wx.getStorageSync('addressId');
            if (addressId == 0 || addressId == '') {
                addressId = 0;
            }
            let selectedUserCouponIds = wx.getStorageSync('selectedUserCouponIds') || [];
            if (!Array.isArray(selectedUserCouponIds)) {
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
        try {
            var addressId = wx.getStorageSync('addressId');
            if (addressId == 0 || addressId == '') {
                addressId = 0;
            }
            this.setData({
                'addressId': addressId
            });
        } catch (e) {
            // Do something when catch error
        }
        this.getCheckoutInfo();
        wx.hideNavigationBarLoading() //完成停止加载
        wx.stopPullDownRefresh() //停止下拉刷新
    },
    getCheckoutInfo: function () {
        let that = this;
        let addressId = that.data.addressId;
        let orderFrom = that.data.orderFrom;
        let addType = that.data.addType;
        let selectedUserCouponIds = that.data.selectedUserCouponIds || [];
        util.request(api.CartCheckout, {
            addressId: addressId,
            addType: addType,
            orderFrom: orderFrom,
            type: 0,
            selectedUserCouponIds: selectedUserCouponIds.join(',')
        }, 'GET', { page: that }).then(function (res) {
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
        const selectedIds = this.data.selectedUserCouponIds || [];
        wx.navigateTo({
            url: `/pages/order-coupon/index?addType=${this.data.addType || 0}&orderFrom=${this.data.orderFrom || 0}&selectedIds=${selectedIds.join(',')}`
        });
    },
    // TODO 有个bug，用户没选择地址，支付无法继续进行，在切换过token的情况下
    submitOrder: function (e) {
        if (this.data.addressId <= 0) {
            util.showErrorToast('请选择收货地址');
            return false;
        }
        let addressId = this.data.addressId;
        let postscript = this.data.postscript;
        let freightPrice = this.data.freightPrice;
        let actualPrice = this.data.actualPrice;
        wx.showLoading({
            title: '',
            mask:true
        })
        util.request(api.OrderSubmit, {
            addressId: addressId,
            postscript: postscript,
            freightPrice: freightPrice,
            actualPrice: actualPrice,
            selectedUserCouponIds: (this.data.selectedUserCouponIds || []),
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
                util.showErrorToast(res.errmsg);
            }
            wx.hideLoading()
        });
    },
    offlineOrder: function (e) {
        if (this.data.addressId <= 0) {
            util.showErrorToast('请选择收货地址');
            return false;
        }
        let addressId = this.data.addressId;
        let postscript = this.data.postscript;
        let freightPrice = this.data.freightPrice;
        let actualPrice = this.data.actualPrice;
        util.request(api.OrderSubmit, {
            addressId: addressId,
            postscript: postscript,
            freightPrice: freightPrice,
            actualPrice: actualPrice,
            selectedUserCouponIds: (this.data.selectedUserCouponIds || []),
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
                util.showErrorToast(res.errmsg);
                wx.redirectTo({
                    url: '/pages/payOffline/index?status=0',
                })
            }
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
