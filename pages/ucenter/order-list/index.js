var util = require('../../../utils/util.js');
var api = require('../../../config/api.js');
const pay = require('../../../services/pay.js');

Page({
    data: {
        orderList: [],
        allOrderList: [],
        allPage: 1,
        allCount: 0,
        size: 8,
        showType: 9,
        hasOrder: 0,
        showTips: 0,
        status: {},
        loading: false,
        hasMore: true
    },
    getStoredShowType: function () {
        const stored = Number(wx.getStorageSync('showType'));
        return Number.isInteger(stored) ? stored : this.data.showType;
    },
    resetOrderList: function (showType) {
        this.setData({
            showType: showType,
            orderList: [],
            allOrderList: [],
            allPage: 1,
            allCount: 0,
            size: 8,
            hasOrder: 0,
            showTips: 0,
            loading: false,
            hasMore: true
        });
    },
    toOrderDetails: function(e) {
        let orderId = e.currentTarget.dataset.id;
        wx.setStorageSync('orderId', orderId)
        wx.navigateTo({
            url: '/pages/ucenter/order-details/index',
        })
    },
    payOrder: function(e) {
        let orderId = e.currentTarget.dataset.orderid;
        let that = this;
        pay.payOrder(parseInt(orderId)).then(res => {
            let showType = that.getStoredShowType();
            that.resetOrderList(showType);
            that.getOrderList();
            that.getOrderInfo();
        }).catch(res => {
            util.showErrorToast((res && res.errmsg) || '支付失败');
        });
    },
    getOrderInfo: function(e) {
        let that = this;
        util.request(api.OrderCountInfo).then(function(res) {
            if (res.errno === 0) {
                let status = res.data;
                that.setData({
                    status: status
                });
            }
        });
    },
    getOrderList() {
        if (this.data.loading || !this.data.hasMore) {
            return Promise.resolve(false);
        }
        let that = this;
        const requestPage = that.data.allPage;
        that.setData({
            loading: true
        });
        return util.request(api.OrderList, {
            showType: that.data.showType,
            size: that.data.size,
            page: requestPage,
        }).then(function(res) {
            if (res.errno === 0) {
                let count = Number(res.data.count || 0);
                const incoming = Array.isArray(res.data.data) ? res.data.data : [];
                const merged = that.data.allOrderList.concat(incoming);
                const currentPage = Number(res.data.currentPage || requestPage || 1);
                const totalPages = that.data.size > 0 ? Math.ceil(count / that.data.size) : 0;
                const hasMore = totalPages > currentPage;
                that.setData({
                    allCount: count,
                    allOrderList: merged,
                    allPage: currentPage,
                    orderList: merged,
                    hasOrder: count === 0 ? 1 : 0,
                    hasMore: hasMore,
                    showTips: hasMore ? 0 : (count > 0 ? 1 : 0)
                });
            }
        }).catch(function () {
            util.showErrorToast('订单列表加载失败');
        }).finally(function () {
            that.setData({
                loading: false
            });
        });
    },
    toIndexPage: function(e) {
        wx.switchTab({
            url: '/pages/index/index'
        });
    },
    onLoad: function() {},
    onShow: function() {
        let showType = this.getStoredShowType();
        let nowShowType = Number(this.data.showType);
        let doRefresh = Number(wx.getStorageSync('doRefresh') || 0) === 1;
        if (nowShowType !== showType || doRefresh || this.data.orderList.length === 0) {
            this.resetOrderList(showType);
            this.getOrderList();
            wx.removeStorageSync('doRefresh');
        }
        this.getOrderInfo();
    },
    switchTab: function(event) {
        let showType = Number(event.currentTarget.dataset.index);
        wx.setStorageSync('showType', showType);
        this.resetOrderList(showType);
        this.getOrderInfo();
        this.getOrderList();
    },
    // “取消订单”点击效果
    cancelOrder: function(e) {
        let that = this;
        let orderId = e.currentTarget.dataset.index;
        wx.showModal({
            title: '',
            content: '确定要取消此订单？',
            success: function(res) {
                if (res.confirm) {
                    util.request(api.OrderCancel, {
                        orderId: orderId
                    }, 'POST').then(function(res) {
                        if (res.errno === 0) {
                            wx.showToast({
                                title: '取消订单成功'
                            });
                            that.setData({
                                orderList: [],
                                allOrderList: [],
                                allPage: 1,
                                allCount: 0,
                                size: 8,
                                hasMore: true,
                                showTips: 0
                            });
                            that.getOrderList();
                            that.getOrderInfo();
                        } else {
                            util.showErrorToast(res.errmsg);
                        }
                    });
                }
            }
        });
    },
    onReachBottom: function() {
        let that = this;
        if (that.data.loading) {
            return false;
        }
        if (!that.data.hasMore) {
            that.setData({
                showTips: 1
            });
            return false;
        }
        that.setData({
            'allPage': that.data.allPage + 1
        });
        that.getOrderList();
    }
})
