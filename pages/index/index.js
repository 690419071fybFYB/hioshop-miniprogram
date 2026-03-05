const util = require('../../utils/util.js');
const api = require('../../config/api.js');
const user = require('../../services/user.js');
const store = require('../../store/index.js');

//获取应用实例
const app = getApp()

Page({
    data: {
        floorGoods: [],
        promotionGoods: [],
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
        uiV2: !!(api.features.newUiV2 && api.features.vantEnabled),
        vantEnabled: !!api.features.vantEnabled,
        promotionV1: !!api.features.promotionV1
    },
    formatCountdown(seconds) {
        const total = Math.max(0, Number(seconds || 0));
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        const pad = (n) => String(n).padStart(2, '0');
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
    },
    normalizeGoodsPromo(item) {
        const goods = Object.assign({}, item || {});
        const minRetail = Number(goods.min_retail_price || goods.retail_price || 0);
        const hasPromo = Number(goods.has_promo || 0) === 1 || Number(goods.has_coupon_promo || 0) === 1;
        goods.has_promo = hasPromo ? 1 : 0;
        goods.promo_price = hasPromo ? (goods.promo_price || minRetail) : minRetail;
        goods.original_price = hasPromo ? (goods.original_price || minRetail) : minRetail;
        goods.promo_tag = goods.promo_tag || '';
        goods.promo_source = goods.promo_source || 'none';
        goods.promo_type = goods.promo_type || '';
        goods.promo_end_at = Number(goods.promo_end_at || 0);
        goods.promo_countdown_seconds = Math.max(0, Number(goods.promo_countdown_seconds || 0));
        goods.promo_stock_percent = Number(goods.promo_stock_percent || 0);
        goods.promo_countdown_text = goods.promo_countdown_seconds > 0 ? this.formatCountdown(goods.promo_countdown_seconds) : '';
        return goods;
    },
    buildPromotionGoods(categoryList) {
        const result = [];
        (categoryList || []).forEach((category) => {
            (category.goodsList || []).forEach((goods) => {
                if (Number(goods.has_promo || 0) !== 1) return;
                if (goods.promo_source !== 'promotion') return;
                result.push(goods);
            });
        });
        result.sort((a, b) => {
            const ca = Number(a.promo_countdown_seconds || 0);
            const cb = Number(b.promo_countdown_seconds || 0);
            if (ca === cb) return Number(a.id || 0) - Number(b.id || 0);
            return ca - cb;
        });
        return result.slice(0, 10);
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
        if (!token) {
            that.setData({
                couponList: [],
                couponLoading: false,
                couponNeedLogin: true,
                couponSectionReady: true
            });
            return;
        }
        that.setData({ couponLoading: true, couponSectionReady: false });
        util.request(api.CouponCenter, {}, 'GET', { page: that, silent401: true }).then(function (res) {
            if (res.errno === 0) {
                const list = (res.data || []).slice(0, 4).map((item) => ({
                    ...item,
                    ruleText: that.formatCouponRule(item),
                    amountText: item.type === 'full_reduction' ? `${item.reduce_amount}元` : `${item.discount_rate}折`,
                    limitText: Number(item.threshold_amount || 0) > 0 ? `满${item.threshold_amount}可用` : '无门槛'
                }));
                that.setData({
                    couponList: list,
                    couponNeedLogin: false,
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
            const unauthorized = err && err.code === 'UNAUTHORIZED';
            that.setData({
                couponList: [],
                couponNeedLogin: unauthorized,
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
                util.showErrorToast('请先登录');
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
        })
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
        util.request(api.IndexUrl, {}, 'GET', { page: that }).then(function (res) {
            if (res.errno === 0) {
                const categoryList = (res.data.categoryList || []).map((category) => {
                    const goodsList = (category.goodsList || []).map((goods) => that.normalizeGoodsPromo(goods));
                    return Object.assign({}, category, {
                        goodsList
                    });
                });
                const promotionGoods = that.buildPromotionGoods(categoryList);
                that.setData({
                    floorGoods: categoryList,
                    promotionGoods: promotionGoods,
                    banner: res.data.banner,
                    channel: res.data.channel,
                    notice: res.data.notice,
                    loading: 1,
                    hasError: false,
                    errorMessage: ''
                });
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
    getChannelShowInfo: function (e) {
        let that = this;
        util.request(api.ShowSettings, {}, 'GET', { page: that }).then(function (res) {
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
