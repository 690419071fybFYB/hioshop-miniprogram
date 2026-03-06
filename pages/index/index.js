const util = require('../../utils/util.js');
const api = require('../../config/api.js');
const user = require('../../services/user.js');
const store = require('../../store/index.js');

//获取应用实例
const app = getApp()

Page({
    data: {
        floorGoods: [],
        couponList: [],
        couponLoading: false,
        couponNeedLogin: false,
        couponSectionReady: false,
        openAttr: false,
        showChannel: 0,
        showBanner: 0,
        showBannerImg: 0,
        banner: [],
        index_banner_img: 0,
        userInfo: {},
        imgurl: '',
        sysHeight: 0,
        loading: 0,
        autoplay: true,
        showContact: 1,
        hasError: false,
        errorMessage: '',
        catalogPageCount: 1,
        catalogPages: [0],
        currentCatalogPage: 0,
        uiV2: !!(api.features.newUiV2 && api.features.vantEnabled),
        vantEnabled: !!api.features.vantEnabled
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
    mapGoodsPromotionDisplay(goods) {
        const item = Object.assign({}, goods || {});
        const hasPromotion = Number(item.has_promotion || 0) === 1;
        const basePrice = item.min_retail_price || item.retail_price || '0.00';
        const displayPrice = hasPromotion ? (item.promotion_price || item.promo_price || basePrice) : basePrice;
        const displayOriginalPrice = hasPromotion ? (item.promotion_original_price || item.original_price || basePrice) : basePrice;
        const displayPromotionTag = hasPromotion ? (item.promotion_tag || item.promo_tag || '') : '';
        const promotionEndAt = Number(item.promotion_end_at || 0);
        item.hasPromotion = hasPromotion;
        item.displayPrice = displayPrice;
        item.displayOriginalPrice = displayOriginalPrice;
        item.displayPromotionTag = displayPromotionTag;
        item.promotionEndAt = promotionEndAt;
        item.promotionCountdownText = hasPromotion ? this.formatPromotionCountdown(promotionEndAt) : '';
        return item;
    },
    mapCategoryPromotionDisplay(categoryList) {
        return (categoryList || []).map((category) => ({
            ...category,
            goodsList: (category.goodsList || []).map((goods) => this.mapGoodsPromotionDisplay(goods))
        }));
    },
    hasPromotionGoods(categoryList) {
        return (categoryList || []).some((category) => (category.goodsList || []).some((goods) => !!goods.hasPromotion));
    },
    refreshPromotionCountdown() {
        const floorGoods = this.data.floorGoods || [];
        let changed = false;
        const nextFloorGoods = floorGoods.map((category) => {
            const nextGoodsList = (category.goodsList || []).map((goods) => {
                if (!goods.hasPromotion) {
                    return goods;
                }
                const nextCountdown = this.formatPromotionCountdown(goods.promotionEndAt);
                if (nextCountdown === goods.promotionCountdownText) {
                    return goods;
                }
                changed = true;
                return Object.assign({}, goods, {
                    promotionCountdownText: nextCountdown
                });
            });
            return Object.assign({}, category, {
                goodsList: nextGoodsList
            });
        });
        if (changed) {
            this.setData({
                floorGoods: nextFloorGoods
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
    mapCouponItem(item, needLoginToReceive) {
        const hasReceived = Number(item && item.has_received) === 1;
        return {
            ...item,
            ruleText: this.formatCouponRule(item),
            amountText: item.type === 'full_reduction' ? `${item.reduce_amount}元` : `${item.discount_rate}折`,
            limitText: Number(item.threshold_amount || 0) > 0 ? `满${item.threshold_amount}可用` : '无门槛',
            needLoginToReceive: !!needLoginToReceive,
            actionText: hasReceived ? '已领取' : (needLoginToReceive ? '登录后领取' : '立即领取'),
            actionDisabled: hasReceived
        };
    },
    formatCouponRule(coupon) {
        if (!coupon) return '';
        if (coupon.type === 'full_reduction') {
            return `满${coupon.threshold_amount}减${coupon.reduce_amount}`;
        }
        return `满${coupon.threshold_amount}打${coupon.discount_rate}折`;
    },
    getCouponList: function () {
        const that = this;
        const token = wx.getStorageSync('token') || '';
        const needLoginToReceive = !token;
        that.setData({ couponLoading: true, couponSectionReady: false });
        util.request(api.CouponCenter, {}, 'GET', { page: that, silent401: true, timeout: 5000, retry: 0 }).then(function (res) {
            if (res.errno === 0) {
                const list = (res.data || []).slice(0, 4).map((item) => that.mapCouponItem(item, needLoginToReceive));
                that.setData({
                    couponList: list,
                    couponNeedLogin: needLoginToReceive,
                    couponSectionReady: true
                });
                return;
            }
            that.setData({
                couponList: [],
                couponNeedLogin: false,
                couponSectionReady: true
            });
        }).catch(function (err) {
            that.setData({
                couponList: [],
                couponNeedLogin: false,
                couponSectionReady: true
            });
        }).finally(function () {
            that.setData({
                couponLoading: false
            });
        });
    },
    goLoginForCoupon: function () {
        wx.switchTab({
            url: '/pages/ucenter/index/index'
        });
    },
    toCouponCenter: function () {
        wx.navigateTo({
            url: '/pages/coupon-center/index'
        });
    },
    receiveCouponFromHome: function (e) {
        const couponId = Number(e.currentTarget.dataset.id || 0);
        if (couponId <= 0) {
            util.showErrorToast('优惠券参数错误');
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
        util.request(api.CouponReceive, { couponId }, 'POST', { page: that, silent401: true }).then(function (res) {
            if (res.errno === 0) {
                util.showSuccessToast('领取成功');
                that.getCouponList();
                return;
            }
            util.showErrorToast(res.errmsg || '领取失败');
        }).catch(function (err) {
            if (err && err.code === 'UNAUTHORIZED') {
                util.showErrorToast('请先登录后领取优惠券');
                wx.switchTab({
                    url: '/pages/ucenter/index/index'
                });
                return;
            }
            util.showErrorToast((err && err.message) || '领取失败');
        });
    },
    onLoad: function (options) {
        this.getChannelShowInfo();
    },
    onPageScroll: function (e) {
        let scrollTop = e.scrollTop;
        let that = this;
        if (scrollTop >= 2000) {
            that.setData({
                showContact: 0
            })
        } else {
            that.setData({
                showContact: 1
            })
        }
    },
    onHide: function () {
        this.setData({
            autoplay: false
        });
        this.stopPromotionTicker();
    },
    goSearch: function () {
        wx.navigateTo({
            url: '/pages/search/search',
        })
    },
    goCategory: function (e) {
        let id = e.currentTarget.dataset.cateid;
        wx.setStorageSync('categoryId', id);
        wx.switchTab({
            url: '/pages/category/index',
        })
    },
    handleTap: function (event) {
        //阻止冒泡 
    },
    onShareAppMessage: function () {
        let info = wx.getStorageSync('userInfo');
        return {
            title: '海风小店',
            desc: '开源微信小程序商城',
            path: '/pages/index/index?id=' + info.id
        }
    },
    toDetailsTap: function () {
        wx.navigateTo({
            url: '/pages/goods-details/index',
        });
    },
    getIndexData: function () {
        let that = this;
        util.request(api.IndexUrl, {}, 'GET', { page: that, timeout: 5000, retry: 0 }).then(function (res) {
            if (res.errno === 0) {
                const channelList = Array.isArray(res.data.channel) ? res.data.channel : [];
                const categoryList = that.mapCategoryPromotionDisplay(res.data.categoryList || []);
                const pageCount = Math.max(1, Math.ceil(channelList.length / 6));
                const catalogPages = Array.from({ length: pageCount }, (_, i) => i);
                that.setData({
                    floorGoods: categoryList,
                    banner: res.data.banner,
                    channel: channelList,
                    notice: res.data.notice,
                    catalogPageCount: pageCount,
                    catalogPages: catalogPages,
                    currentCatalogPage: 0,
                    loading: 1,
                    hasError: false,
                    errorMessage: ''
                });
                if (that.hasPromotionGoods(categoryList)) {
                    that.startPromotionTicker();
                } else {
                    that.stopPromotionTicker();
                }
                let cartGoodsCount = '';
                if (res.data.cartCount == 0) {
                    wx.removeTabBarBadge({
                        index: 2,
                    })
                } else {
                    cartGoodsCount = res.data.cartCount + '';
                    wx.setTabBarBadge({
                        index: 2,
                        text: cartGoodsCount
                    })
                }
                store.patch({
                    cartCount: Number(res.data.cartCount || 0)
                });
            }
        }).catch(function () {
            // Avoid permanent loading spinner when request fails.
            that.setData({
                loading: 1,
                hasError: true,
                errorMessage: '首页数据加载失败，请检查接口或网络'
            });
            util.showErrorToast(that.data.errorMessage);
        });
    },
    onCatalogSwiperChange: function (e) {
        const current = Number(e && e.detail ? e.detail.current : 0);
        this.setData({
            currentCatalogPage: Number.isNaN(current) ? 0 : current
        });
    },

    onShow: function () {
        this.getIndexData();
        this.getCouponList();
        var that = this;
        let userInfo = wx.getStorageSync('userInfo');
        if (userInfo != '') {
            that.setData({
                userInfo: userInfo,
            });
        };
        let info = util.getWindowInfo();
        let sysHeight = info.windowHeight - 100;
        this.setData({
            sysHeight: sysHeight,
            autoplay: true
        });
        wx.removeStorageSync('categoryId');
    },
    onUnload: function () {
        this.stopPromotionTicker();
    },
    getChannelShowInfo: function (e) {
        let that = this;
        util.request(api.ShowSettings, {}, 'GET', { page: that, timeout: 5000, retry: 0 }).then(function (res) {
            if (res.errno === 0) {
                let show_channel = res.data.channel;
                let show_banner = res.data.banner;
                let show_notice = res.data.notice;
                let index_banner_img = res.data.index_banner_img;
                that.setData({
                    show_channel: show_channel,
                    show_banner: show_banner,
                    show_notice: show_notice,
                    index_banner_img: index_banner_img
                });
            }
        }).catch(function () {
            util.showErrorToast('频道配置加载失败');
        });
    },
    onPullDownRefresh: function () {
        wx.showNavigationBarLoading()
        this.getIndexData();
        this.getCouponList();
        this.getChannelShowInfo();
        wx.hideNavigationBarLoading() //完成停止加载
        wx.stopPullDownRefresh() //停止下拉刷新
    },
    retryLoad: function () {
        this.setData({
            loading: 0
        });
        this.getIndexData();
        this.getChannelShowInfo();
    }
})
