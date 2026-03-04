var util = require('../../utils/util.js');
var api = require('../../config/api.js');
const pay = require('../../services/pay.js');
const app = getApp()

Page({
    data: {
        checkedGoodsList: [],
        checkedAddress: {},
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
        errorMessage: ''
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
                let addressId = 0;
                if (res.data.checkedAddress != 0) {
                    addressId = res.data.checkedAddress.id;
                }
                const nextSelectedIds = (res.data.selectedCoupons || []).map((item) => Number(item.user_coupon_id));
                that.setData({
                    checkedGoodsList: res.data.checkedGoodsList,
                    checkedAddress: res.data.checkedAddress,
                    actualPrice: res.data.actualPrice,
                    addressId: addressId,
                    freightPrice: res.data.freightPrice,
                    couponPrice: res.data.couponPrice || 0,
                    couponCandidates: res.data.couponCandidates || [],
                    selectedCoupons: res.data.selectedCoupons || [],
                    selectedUserCouponIds: nextSelectedIds,
                    goodsTotalPrice: res.data.goodsTotalPrice,
                    orderTotalPrice: res.data.orderTotalPrice,
                    goodsCount: res.data.goodsCount,
                    outStock: res.data.outStock,
                    hasError: false,
                    errorMessage: ''
                });
                let goods = res.data.checkedGoodsList;
                wx.setStorageSync('addressId', addressId);
                wx.setStorageSync('selectedUserCouponIds', nextSelectedIds);
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
