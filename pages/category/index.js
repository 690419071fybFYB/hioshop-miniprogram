var util = require('../../utils/util.js');
var api = require('../../config/api.js');

Page({
    data: {
        navList: [],
        categoryList: [],
        currentCategory: {},
        goodsCount: 0,
        nowIndex: 0,
        nowId: 0,
        list: [],
        allPage: 1,
        allCount: 0,
        size: 8,
        hasInfo: 0,
        showNoMore: 0,
        loading:0,
        isLoadingMore: false,
        cateHeight: 0,
        index_banner_img:0,
        hasError: false,
        errorMessage: '',
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
    applyHotSaleTagForList(goodsList) {
        return (goodsList || []).map((goods, index) => {
            const item = Object.assign({}, goods || {});
            const rank = index + 1;
            const sellVolume = Number(item.sell_volume || 0);
            const goodsNumber = Number(item.goods_number || 0);
            const isHotSale = rank <= 3 && sellVolume > 0 && goodsNumber > 0;
            item.isHotSale = isHotSale;
            item.hotTagText = isHotSale ? '热销' : '';
            return item;
        });
    },
    hasPromotionGoods(list) {
        return (list || []).some((item) => !!item.hasPromotion);
    },
    refreshPromotionCountdown() {
        const list = this.data.list || [];
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
        if (changed) {
            this.setData({
                list: nextList
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
    onLoad: function(options) {
    },
    onReady: function() {
        this.updateCateHeight();
    },
    updateCateHeight: function() {
        const query = wx.createSelectorQuery().in(this);
        query.select('.cate').boundingClientRect((rect) => {
            if (rect && rect.height) {
                this.setData({
                    cateHeight: rect.height
                });
            }
        });
        query.exec();
    },
    getChannelShowInfo: function (e) {
        let that = this;
        util.request(api.ShowSettings, {}, 'GET', { page: that }).then(function (res) {
            if (res.errno === 0) {
                let index_banner_img = res.data.index_banner_img;
                that.setData({
                    index_banner_img: index_banner_img
                });
            }
        });
    },
    onPullDownRefresh: function() {
        wx.showNavigationBarLoading()
        this.getCatalog();
        wx.hideNavigationBarLoading() //完成停止加载
        wx.stopPullDownRefresh() //停止下拉刷新
    },
    getCatalog: function() {
        //CatalogList
        let that = this;
        util.request(api.CatalogList, {}, 'GET', { page: that }).then(function(res) {
            if (res.errno === 0 && res.data) {
                that.setData({
                    navList: res.data.categoryList || [],
                    hasError: false,
                    errorMessage: ''
                });
            } else {
                that.setData({
                    navList: [],
                });
            }
        }).catch(function() {
            that.setData({
                hasError: true,
                errorMessage: '分类列表加载失败'
            });
            util.showErrorToast('分类列表加载失败');
        });
        util.request(api.GoodsCount, {}, 'GET', { page: that }).then(function(res) {
            if (res.errno === 0 && res.data) {
                that.setData({
                    goodsCount: res.data.goodsCount || 0
                });
            } else {
                that.setData({
                    goodsCount: 0
                });
            }
        }).catch(function() {
            util.showErrorToast('商品统计加载失败');
        });
    },
    getCurrentCategory: function(id) {
        let that = this;
        util.request(api.CatalogCurrent, {
            id: id
        }, 'GET', { page: that }).then(function(res) {
            that.setData({
                currentCategory: res.data
            });
        }).catch(function() {
            util.showErrorToast('当前分类加载失败');
        });
    },
    getCurrentList: function(id, page) {
        let that = this;
        const targetPage = page || that.data.allPage;
        util.request(api.GetCurrentList, {
            size: that.data.size,
            page: targetPage,
            id: id
        }, 'POST', { page: that }).then(function(res) {
            if (res.errno === 0) {
                const incoming = Array.isArray(res.data.data) ? res.data.data.map((item) => {
                    const next = Object.assign({}, item);
                    next.list_pic_url = util.optimizeProductListImage(item && item.list_pic_url);
                    return that.mapGoodsPromotionDisplay(next);
                }) : [];
                const mergedList = that.data.list.concat(incoming);
                const rankedList = that.applyHotSaleTagForList(mergedList);
                const count = Number(res.data.count || 0);
                const currentPage = Number(res.data.currentPage || targetPage || 1);
                const hasMore = incoming.length > 0 && mergedList.length < count;
                that.setData({
                    allCount: count,
                    allPage: currentPage,
                    list: rankedList,
                    showNoMore: hasMore ? 1 : 0,
                    loading: 0,
                    isLoadingMore: false,
                    hasError: false,
                    errorMessage: ''
                });
                if (that.hasPromotionGoods(rankedList)) {
                    that.startPromotionTicker();
                } else {
                    that.stopPromotionTicker();
                }
                if (count == 0) {
                    that.setData({
                        hasInfo: 0,
                        showNoMore: 0
                    });
                }
                if (hasMore) {
                    that.tryAutoLoadNextPage();
                }
            }
        }).catch(function() {
            that.setData({
                loading: 0,
                isLoadingMore: false,
                hasError: true,
                errorMessage: '分类商品加载失败'
            });
            that.stopPromotionTicker();
            util.showErrorToast('分类商品加载失败');
        });
    },
    onShow: function() {
        this.getChannelShowInfo();
        this.getCatalog();
        const storedCategoryId = wx.getStorageSync('categoryId');
        const parsedStoredId = Number(storedCategoryId);
        const hasStoredId = storedCategoryId !== '' && storedCategoryId !== undefined && storedCategoryId !== null && !Number.isNaN(parsedStoredId);
        const targetId = hasStoredId ? parsedStoredId : (Number(this.data.nowId) || 0);
        const currentId = Number(this.data.nowId) || 0;
        if (this.data.list.length > 0 && currentId === targetId) {
            if (this.hasPromotionGoods(this.data.list)) {
                this.startPromotionTicker();
            }
            return;
        }
        this.setData({
            list: [],
            allPage: 1,
            allCount: 0,
            size: 8,
            loading: 1,
            isLoadingMore: false,
            nowId: targetId,
            hasError: false,
            errorMessage: ''
        });
        this.getCurrentList(targetId, 1);
        if (targetId === 0) {
            this.setData({
                currentCategory: {}
            });
        } else {
            this.getCurrentCategory(targetId);
        }
        wx.setStorageSync('categoryId', targetId);
    },
    switchCate: function(e) {
        let id = e.currentTarget.dataset.id;
        let nowId = this.data.nowId;
        if (id == nowId) {
            return false;
        } else {
            this.setData({
                list: [],
                allPage: 1,
                allCount: 0,
                size: 8,
                loading: 1,
                isLoadingMore: false
            });
            this.stopPromotionTicker();
            if (id == 0) {
                this.getCurrentList(0);
                this.setData({
                    currentCategory: {}
                });
            } else {
                wx.setStorageSync('categoryId', id);
                this.getCurrentList(id);
                this.getCurrentCategory(id);
            }
            wx.setStorageSync('categoryId', id);
            this.setData({
                nowId: id
            });
        }
    },
    onHide: function() {
        this.stopPromotionTicker();
    },
    onUnload: function() {
        this.stopPromotionTicker();
    },
    onBottom: function() {
        let that = this;
        if (that.data.loading === 1 || that.data.isLoadingMore) {
            return false;
        }
        if (that.data.showNoMore !== 1) {
            return false;
        }
        if (that.data.allCount > 0 && that.data.list.length >= that.data.allCount) {
            that.setData({
                showNoMore: 0
            });
            return false;
        }
        that.setData({
            isLoadingMore: true
        });
        const nextPage = Number(that.data.allPage || 1) + 1;
        let nowId = that.data.nowId;
        if (nowId == 0 || nowId == undefined) {
            that.getCurrentList(0, nextPage);
        } else {
            that.getCurrentList(nowId, nextPage);
        }
    },
    tryAutoLoadNextPage: function() {
        if (this.data.loading === 1 || this.data.isLoadingMore || this.data.showNoMore !== 1) {
            return;
        }
        const query = wx.createSelectorQuery().in(this);
        query.select('.cate').boundingClientRect();
        query.select('.list-wrap').boundingClientRect();
        query.exec((rects) => {
            const cateRect = rects && rects[0];
            const listRect = rects && rects[1];
            if (!cateRect || !listRect) {
                return;
            }
            if (Number(listRect.height || 0) <= Number(cateRect.height || 0) + 20) {
                this.onBottom();
            }
        });
    },
    onCateScroll: function(e) {
        if (this.data.loading === 1 || this.data.isLoadingMore || this.data.showNoMore !== 1) {
            return;
        }
        const detail = e.detail || {};
        const remain = Number(detail.scrollHeight || 0) - Number(detail.scrollTop || 0) - Number(this.data.cateHeight || 0);
        if (remain <= 80) {
            this.onBottom();
        }
    },
    retryLoad: function () {
        this.setData({
            list: [],
            allPage: 1,
            loading: 1,
            isLoadingMore: false,
            hasError: false
        });
        this.getCatalog();
        this.getCurrentList(this.data.nowId || 0);
    }
})
