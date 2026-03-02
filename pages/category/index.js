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
        index_banner_img:0,
        hasError: false,
        errorMessage: '',
        uiV2: !!(api.features.newUiV2 && api.features.vantEnabled),
        vantEnabled: !!api.features.vantEnabled
    },
    onLoad: function(options) {
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
    getCurrentList: function(id) {
        let that = this;
        util.request(api.GetCurrentList, {
            size: that.data.size,
            page: that.data.allPage,
            id: id
        }, 'POST', { page: that }).then(function(res) {
            if (res.errno === 0) {
                let count = res.data.count;
                that.setData({
                    allCount: count,
                    allPage: res.data.currentPage,
                    list: that.data.list.concat(res.data.data),
                    showNoMore: 1,
                    loading: 0,
                });
                if (count == 0) {
                    that.setData({
                        hasInfo: 0,
                        showNoMore: 0
                    });
                }
            }
        }).catch(function() {
            that.setData({
                loading: 0,
                hasError: true,
                errorMessage: '分类商品加载失败'
            });
            util.showErrorToast('分类商品加载失败');
        });
    },
    onShow: function() {
        this.getChannelShowInfo();
        let id = this.data.nowId;
        let nowId = wx.getStorageSync('categoryId');
        if(id == 0 && nowId === 0){
            return false
        }
        else if (nowId == 0 && nowId === '') {
            this.setData({
                list: [],
                allPage: 1,
                allCount: 0,
                size: 8,
                loading: 1
            })
            this.getCurrentList(0);
            this.setData({
                nowId: 0,
                currentCategory: {}
            })
            wx.setStorageSync('categoryId', 0)
        } else if(id != nowId) {
            this.setData({
                list: [],
                allPage: 1,
                allCount: 0,
                size: 8,
                loading: 1
            })
            this.getCurrentList(nowId);
            this.getCurrentCategory(nowId);
            this.setData({
                nowId: nowId
            })
            wx.setStorageSync('categoryId', nowId)
        }
        
        this.getCatalog();
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
                loading: 1
            })
            if (id == 0) {
                this.getCurrentList(0);
                this.setData({
                    currentCategory: {}
                })
            } else {
                wx.setStorageSync('categoryId', id)
                this.getCurrentList(id);
                this.getCurrentCategory(id);
            }
            wx.setStorageSync('categoryId', id)
            this.setData({
                nowId: id
            })
        }
    },
    onBottom: function() {
        let that = this;
        if (that.data.allCount / that.data.size < that.data.allPage) {
            that.setData({
                showNoMore: 0
            });
            return false;
        }
        that.setData({
            allPage: that.data.allPage + 1
        });
        let nowId = that.data.nowId;
        if (nowId == 0 || nowId == undefined) {
            that.getCurrentList(0);
        } else {
            that.getCurrentList(nowId);
        }
    },
    retryLoad: function () {
        this.setData({
            list: [],
            allPage: 1,
            loading: 1,
            hasError: false
        });
        this.getCatalog();
        this.getCurrentList(this.data.nowId || 0);
    }
})
