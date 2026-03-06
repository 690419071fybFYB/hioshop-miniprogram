// 购物车页面逻辑：
// - 拉取购物车列表/汇总
// - 勾选/全选（非编辑态走后端，编辑态走本地）
// - 商品数量加减、删除（含左滑删除）
// - 同步 tabBar 角标购物车数量
var util = require('../../utils/util.js');
var api = require('../../config/api.js');
const store = require('../../store/index.js');
const app = getApp()

Page({
    data: {
        // 购物车商品列表
        cartGoods: [],
        // 购物车汇总信息（后端返回 + 本地计算的已选汇总）
        cartTotal: {
            "goodsCount": 0,
            "goodsAmount": 0.00,
            "checkedGoodsCount": 0,
            "checkedGoodsAmount": 0.00,
            "userId_test": ''
        },
        // 是否处于编辑状态（编辑态下勾选/全选不请求后端，仅本地切换）
        isEditCart: false,
        // 是否“全选”的 UI 状态
        checkedAllStatus: true,
        editCartList: [],
        // 手势：是否左滑显示删除
        isTouchMove: false,
        // 手势：触摸起点坐标
        startX: 0, //开始坐标
        startY: 0,
        // 是否有购物车商品（0/1，用于空态）
        hasCartGoods: 0,
        // 是否出现加载错误（用于错误提示 + 重试）
        hasError: false,
        errorMessage: '',
        // UI/组件库开关（由 config/api.js 的 features 控制）
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
    mapCartPromotionDisplay(cartList) {
        return (cartList || []).map((item) => {
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
    hasPromotionGoods(cartList) {
        return (cartList || []).some((item) => !!item.hasPromotion);
    },
    refreshPromotionCountdown() {
        const cartGoods = this.data.cartGoods || [];
        let changed = false;
        const nextCartGoods = cartGoods.map((item) => {
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
                cartGoods: nextCartGoods
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
    applyCartResponse(cartList, cartTotal) {
        const mappedList = this.mapCartPromotionDisplay(cartList || []);
        this.setData({
            cartGoods: mappedList,
            cartTotal: cartTotal || this.data.cartTotal
        });
        if (this.hasPromotionGoods(mappedList)) {
            this.startPromotionTicker();
        } else {
            this.stopPromotionTicker();
        }
    },
    onLoad: function() {
    },
    onReady: function() {
        // 页面渲染完成
    },
    onShow: function() {
        // 页面显示
        // 每次进入页面都刷新购物车与角标数量
        this.getCartList();
        this.getCartNum();
        wx.removeStorageSync('categoryId');
    },
    goGoodsDetail(e){
        // 跳转到商品详情页
        let goodsId = e.currentTarget.dataset.goodsid;
        wx.navigateTo({
          url: '/pages/goods/goods?id='+goodsId,
        })
    },
    nothing:function(){
        // 空函数：常用于 catchtap 阻止冒泡
    },
    onPullDownRefresh: function() {
        // 下拉刷新：重新拉取购物车列表与角标数量
        wx.showNavigationBarLoading()
        this.getCartList();
        this.getCartNum();
        wx.hideNavigationBarLoading() //完成停止加载
        wx.stopPullDownRefresh() //停止下拉刷新
    },
    onHide: function() {
        // 页面隐藏
        this.stopPromotionTicker();
    },
    onUnload: function() {
        // 页面关闭
        this.stopPromotionTicker();
    },
    toIndexPage: function() {
        // 去首页（tab 页切换）
        wx.switchTab({
            url: '/pages/index/index',
        });
    },
    getCartList: function() {
        // 获取购物车列表（后端）并更新页面数据
        let that = this;
        util.request(api.CartList, {}, 'GET', { page: that }).then(function(res) {
            if (res.errno === 0) {
                let hasCartGoods = res.data.cartList;
                if (hasCartGoods.length != 0) {
                    hasCartGoods = 1;
                } else {
                    hasCartGoods = 0;
                }
                that.applyCartResponse(res.data.cartList, res.data.cartTotal);
                that.setData({
                    hasCartGoods: hasCartGoods,
                    hasError: false,
                    errorMessage: ''
                });
                if (res.data.cartTotal.numberChange == 1) {
                    // 后端提示库存/数量发生变化
                    util.showErrorToast('部分商品库存有变动');
                }
            }
            that.setData({
                checkedAllStatus: that.isCheckedAll()
            });
        }).catch(function () {
            // 请求失败：进入错误态
            that.setData({
                hasError: true,
                errorMessage: '购物车加载失败'
            });
            that.stopPromotionTicker();
            util.showErrorToast('购物车加载失败');
        });
    },
    isCheckedAll: function() {
        // 判断购物车商品是否已全选
        return this.data.cartGoods.every(function(element, index, array) {
            if (element.checked == true) {
                return true;
            } else {
                return false;
            }
        });
    },
    getCheckedGoodsCount: function() {
        // 本地计算“已选”商品数量与金额（编辑态使用）
        let checkedGoodsCount = 0;
        let checkedGoodsAmount = 0;

        this.data.cartGoods.forEach(function(v) {
            if (v.checked == true) {
                checkedGoodsCount += v.number;
                checkedGoodsAmount += v.number * Number(v.displayPrice || v.display_price || v.promotion_price || v.retail_price || 0)
            }
        });
        this.setData({
            'cartTotal.checkedGoodsCount': checkedGoodsCount,
            'cartTotal.checkedGoodsAmount': checkedGoodsAmount.toFixed(2),
        });
    },
    checkedAll: function() {
        // 全选/取消全选
        let that = this;
        if (!this.data.isEditCart) {
            // 非编辑态：调用后端更新选中状态
            var productIds = this.data.cartGoods.map(function(v) {
                return v.product_id;
            });
            util.request(api.CartChecked, {
                productIds: productIds.join(','),
                isChecked: that.isCheckedAll() ? 0 : 1
            }, 'POST', { page: that }).then(function(res) {
                if (res.errno === 0) {
                    that.applyCartResponse(res.data.cartList, res.data.cartTotal);
                }

                that.setData({
                    checkedAllStatus: that.isCheckedAll()
                });
            });
        } else {
            // 编辑态：仅本地切换 checked，并重新计算已选汇总
            let checkedAllStatus = that.isCheckedAll();
            let tmpCartData = this.data.cartGoods.map(function(v) {
                v.checked = !checkedAllStatus;
                return v;
            });
            // 注意：这里按原逻辑应调用 this.getCheckedGoodsCount()
            // 当前代码写成 getCheckedGoodsCount() 可能导致未定义错误（若编辑态分支被触发）
            this.getCheckedGoodsCount();
            that.setData({
                cartGoods: tmpCartData,
                checkedAllStatus: that.isCheckedAll(),
            });
        }

    },
    updateCart: function(itemIndex, productId, number, id) {
        // 更新购物车商品数量（后端）
        let that = this;
        wx.showLoading({
            title: '',
            mask:true
          })
        util.request(api.CartUpdate, {
            productId: productId,
            number: number,
            id: id
        }, 'POST', { page: that }).then(function(res) {
            if (res.errno === 0) {
                // 后端返回新的购物车列表与汇总
                that.applyCartResponse(res.data.cartList, res.data.cartTotal);
                let cartItem = that.data.cartGoods[itemIndex];
                cartItem.number = number;
                // 同步 tabBar 角标数量
                that.getCartNum();
            } else {
                util.showErrorToast('库存不足了')
            }
            that.setData({
                checkedAllStatus: that.isCheckedAll()
            });
            wx.hideLoading({
            })
        });

    },
    cutNumber: function(event) {
        // 数量 -1；若减到 0（<=1）则直接删除该条
        let itemIndex = event.target.dataset.itemIndex;
        let cartItem = this.data.cartGoods[itemIndex];
        if (Number(cartItem.number) <= 1) {
            this.deleteCartItem(itemIndex);
            return;
        }
        let number = Number(cartItem.number) - 1;
        this.setData({
            cartGoods: this.data.cartGoods,
        });
        this.updateCart(itemIndex, cartItem.product_id, number, cartItem.id);
    },
    addNumber: function(event) {
        // 数量 +1
        let itemIndex = event.target.dataset.itemIndex;
        let cartItem = this.data.cartGoods[itemIndex];
        let number = Number(cartItem.number) + 1;
        this.setData({
            cartGoods: this.data.cartGoods,
        });
        this.updateCart(itemIndex, cartItem.product_id, number, cartItem.id);
    },
    getCartNum: function() {
        // 获取购物车商品总数（用于 tabBar 角标 + 全局 store）
        util.request(api.CartGoodsCount, {}, 'GET', { page: this }).then(function(res) {
            if (res.errno === 0) {
                let cartGoodsCount = '';
                if (res.data.cartTotal.goodsCount == 0) {
                    wx.removeTabBarBadge({
                        index: 2,
                    })
                } else {
                    cartGoodsCount = res.data.cartTotal.goodsCount + '';
                    wx.setTabBarBadge({
                        index: 2,
                        text: cartGoodsCount
                    })
                }
                // 写入全局 store，供其他页面显示购物车数量
                store.patch({
                    cartCount: Number(res.data.cartTotal.goodsCount || 0)
                });
            }
        }).catch(function () {
            util.showErrorToast('购物车数量加载失败');
        });
    },
    checkoutOrder: function() {
        // 去结算：需要至少选择一件商品
        const canCheckout = util.ensureLoginForCheckout({
            redirect: '/pages/cart/cart',
            from: 'checkout'
        });
        if (!canCheckout) {
            return false;
        }
        let that = this;
        var checkedGoods = this.data.cartGoods.filter(function(element, index, array) {
            if (element.checked == true) {
                return true;
            } else {
                return false;
            }
        });
        if (checkedGoods.length <= 0) {
            util.showErrorToast('你好像没选中商品');
            return false;
        }
        wx.navigateTo({
            url: '/pages/order-check/index?addtype=0'
        })
    },
    selectTap: function(e) {
        // 可能为历史遗留代码：依赖 goodsList/setGoodsList 等字段/方法（本文件 data 中未定义）
        const index = e.currentTarget.dataset.index;
        const list = this.data.goodsList.list;
        if (index !== '' && index != null) {
            list[parseInt(index, 10)].active = !list[parseInt(index, 10)].active;
            this.setGoodsList(this.getSaveHide(), this.totalPrice(), this.allSelect(), this.noSelect(), list);
        }
    },

    checkedItem: function(e) {
        // 勾选/取消勾选单个商品
        let itemIndex = e.currentTarget.dataset.itemIndex;
        let that = this;

        if (!this.data.isEditCart) {
            // 非编辑态：调用后端更新勾选状态
            util.request(api.CartChecked, {
                productIds: that.data.cartGoods[itemIndex].product_id,
                isChecked: that.data.cartGoods[itemIndex].checked ? 0 : 1
            }, 'POST', { page: that }).then(function(res) {
                if (res.errno === 0) {
                    that.applyCartResponse(res.data.cartList, res.data.cartTotal);
                }

                that.setData({
                    checkedAllStatus: that.isCheckedAll()
                });
            });
        } else {
            // 编辑态：本地切换 checked，并重新计算已选汇总
            let tmpCartData = this.data.cartGoods.map(function(element, index, array) {
                if (index == itemIndex) {
                    element.checked = !element.checked;
                }

                return element;
            });
            this.getCheckedGoodsCount();
            that.setData({
                cartGoods: tmpCartData,
                checkedAllStatus: that.isCheckedAll(),
                // 'cartTotal.checkedGoodsCount': that.getCheckedGoodsCount()
            });
        }
    },
    handleTap: function(event) { //阻止冒泡 

    },
    touchstart: function(e) {
        // 手势：开始触摸时，重置所有条目的左滑删除状态
        this.data.cartGoods.forEach(function(v, i) {
            if (v.isTouchMove) //只操作为true的
                v.isTouchMove = false;
        })
        this.setData({
            startX: e.changedTouches[0].clientX,
            startY: e.changedTouches[0].clientY,
            cartGoods: this.data.cartGoods
        })
    },
    //滑动事件处理
    touchmove: function(e) {
        // 手势：左滑显示删除按钮（角度>30°视为上下滑动，直接忽略）
        var that = this,
            index = e.currentTarget.dataset.index, //当前索引
            startX = that.data.startX, //开始X坐标
            startY = that.data.startY, //开始Y坐标
            touchMoveX = e.changedTouches[0].clientX, //滑动变化坐标
            touchMoveY = e.changedTouches[0].clientY, //滑动变化坐标
            //获取滑动角度
            angle = that.angle({
                X: startX,
                Y: startY
            }, {
                X: touchMoveX,
                Y: touchMoveY
            });
        that.data.cartGoods.forEach(function(v, i) {
            v.isTouchMove = false
            //滑动超过30度角 return
            if (Math.abs(angle) > 30) return;
            if (i == index) {
                if (touchMoveX > startX) //右滑
                    v.isTouchMove = false
                else //左滑
                    v.isTouchMove = true
            }
        })
        //更新数据
        that.setData({
            cartGoods: that.data.cartGoods
        })
    },
    /**
     * 计算滑动角度
     * @param {Object} start 起点坐标
     * @param {Object} end 终点坐标
     */
    angle: function(start, end) {
        var _X = end.X - start.X,
            _Y = end.Y - start.Y
        //返回角度 /Math.atan()返回数字的反正切值
        return 360 * Math.atan(_Y / _X) / (2 * Math.PI);
    },
    //删除事件
    deleteGoods: function(e) {
        // 点击删除按钮
        let itemIndex = e.currentTarget.dataset.itemIndex;
        this.deleteCartItem(itemIndex);
    },
    deleteCartItem: function(itemIndex) {
        // 删除购物车某一项（后端）
        let productIds = this.data.cartGoods[itemIndex].product_id;
        let that = this;
        wx.showLoading({
            title: '',
            mask: true
        });
        util.request(api.CartDelete, {
            productIds: productIds
        }, 'POST', { page: that }).then(function(res) {
            if (res.errno === 0) {
                let cartList = res.data.cartList;
                that.setData({
                    cartGoods: cartList,
                    cartTotal: res.data.cartTotal
                });
                // 删除后刷新列表与角标
                that.getCartList();
                that.getCartNum();
            }
            that.setData({
                checkedAllStatus: that.isCheckedAll()
            });
            wx.hideLoading();
        }).catch(function() {
            wx.hideLoading();
            util.showErrorToast('删除失败，请稍后重试');
        });
    },
    retryLoad: function() {
        // 错误态重试：清空错误并重新拉取数据
        this.setData({
            hasError: false,
            errorMessage: ''
        });
        this.getCartList();
        this.getCartNum();
    }
})
