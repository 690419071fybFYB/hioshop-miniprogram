var app = getApp();
var WxParse = require('../../lib/wxParse/wxParse.js');
var util = require('../../utils/util.js');
var timer = require('../../utils/wxTimer.js');
var api = require('../../config/api.js');
const user = require('../../services/user.js');
const store = require('../../store/index.js');
Page({
    data: {
        id: 0,
        goods: {},
        gallery: [],
        galleryImages:[],
        specificationList: [],
        productList: [],
        cartGoodsCount: 0,
        checkedSpecPrice: 0,
        checkedSpecPromoPrice: 0,
        checkedSpecOriginalPrice: 0,
        checkedSpecHasCouponPromo: false,
        checkedSpecShowOriginalPrice: false,
        checkedSpecHasVipPrice: false,
        checkedSpecVipPrice: '',
        checkedSpecVipPriceActive: false,
        number: 1,
        checkedSpecText: '',
        tmpSpecText: '请选择规格和数量',
        openAttr: false,
        soldout: false,
        disabled: '',
        alone_text: '单独购买',
        userId: 0,
        priceChecked: false,
        goodsNumber: 0,
        loading: 0,
        current: 0,
        showShareDialog:0,
        userInfo:{},
        autoplay:true,
        pendingCartAction: '',
        hasError: false,
        errorMessage: '',
        uiV2: !!(api.features.newUiV2 && api.features.vantEnabled),
        vantEnabled: !!api.features.vantEnabled,
        grouponActivities: []
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
    resolveVipPriceDisplay(vipPrice) {
        if (vipPrice === '' || vipPrice === null || typeof vipPrice === 'undefined') {
            return {
                hasVipPrice: false,
                vipPriceDisplay: ''
            };
        }
        const vipPriceNumber = Number(vipPrice);
        if (!Number.isFinite(vipPriceNumber)) {
            return {
                hasVipPrice: false,
                vipPriceDisplay: ''
            };
        }
        return {
            hasVipPrice: true,
            vipPriceDisplay: vipPriceNumber.toFixed(2)
        };
    },
    mapPromotionDisplay(source) {
        const item = Object.assign({}, source || {});
        const hasPromotion = Number(item.has_promotion || 0) === 1;
        const retailPrice = item.retail_price || item.min_retail_price || 0;
        const displayPrice = hasPromotion ? (item.promotion_price || item.promo_price || retailPrice) : retailPrice;
        const displayOriginalPrice = hasPromotion ? (item.promotion_original_price || item.original_price || retailPrice) : retailPrice;
        const displayPromotionTag = hasPromotion ? (item.promotion_tag || item.promo_tag || '') : '';
        const promotionEndAt = Number(item.promotion_end_at || 0);
        const vipMeta = this.resolveVipPriceDisplay(item.vip_price);
        const isVipPriceActive = Number(item.is_vip_price_active || 0) === 1;
        const originalPriceNumber = Number(displayOriginalPrice || 0);
        const currentPriceNumber = Number(displayPrice || 0);
        const showOriginalPrice = hasPromotion &&
            Number.isFinite(originalPriceNumber) &&
            Number.isFinite(currentPriceNumber) &&
            originalPriceNumber > 0 &&
            originalPriceNumber > currentPriceNumber;
        return Object.assign({}, item, {
            hasPromotion,
            displayPrice,
            displayOriginalPrice,
            showOriginalPrice,
            displayPromotionTag,
            promotionEndAt,
            promotionCountdownText: hasPromotion ? this.formatPromotionCountdown(promotionEndAt) : '',
            hasVipPrice: vipMeta.hasVipPrice,
            vipPriceDisplay: vipMeta.vipPriceDisplay,
            isVipPriceActive
        });
    },
    getPriceDisplay(source) {
        const item = this.mapPromotionDisplay(source);
        return {
            hasCouponPromo: !!item.hasPromotion,
            promoPrice: item.displayPrice,
            originalPrice: item.displayOriginalPrice,
            showOriginalPrice: !!item.showOriginalPrice,
            hasVipPrice: !!item.hasVipPrice,
            vipPrice: item.vipPriceDisplay,
            vipPriceActive: !!item.isVipPriceActive
        };
    },
    hasPromotionInGoods(goods, productList) {
        if (goods && goods.hasPromotion) {
            return true;
        }
        return (productList || []).some((item) => !!item.hasPromotion);
    },
    refreshPromotionCountdown() {
        const goods = this.data.goods || {};
        const productList = this.data.productList || [];
        let goodsChanged = false;
        let listChanged = false;
        let nextGoods = goods;
        if (goods.hasPromotion) {
            const nextGoodsCountdown = this.formatPromotionCountdown(goods.promotionEndAt);
            if (nextGoodsCountdown !== goods.promotionCountdownText) {
                goodsChanged = true;
                nextGoods = Object.assign({}, goods, {
                    promotionCountdownText: nextGoodsCountdown
                });
            }
        }
        const nextProductList = productList.map((item) => {
            if (!item.hasPromotion) {
                return item;
            }
            const nextCountdown = this.formatPromotionCountdown(item.promotionEndAt);
            if (nextCountdown === item.promotionCountdownText) {
                return item;
            }
            listChanged = true;
            return Object.assign({}, item, {
                promotionCountdownText: nextCountdown
            });
        });
        if (goodsChanged || listChanged) {
            this.setData({
                goods: nextGoods,
                productList: nextProductList
            });
        }
    },
    formatGrouponCountdown(endAt) {
        const endTs = Number(endAt || 0);
        if (!endTs) {
            return '';
        }
        const remain = endTs - Math.floor(Date.now() / 1000);
        if (remain <= 0) {
            return '已结束';
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
    mapGrouponTeam(raw) {
        const id = Number(raw.id || raw.team_id || 0);
        if (id <= 0) {
            return null;
        }
        const expireAt = Number(raw.expire_at || raw.end_at || 0);
        const joinedSize = Number(raw.joined_size || raw.member_count || 0);
        const requiredSize = Number(raw.required_size || raw.group_size || 2);
        return {
            id,
            leaderName: raw.leader_name || raw.nickname || '团长',
            joinedSize,
            requiredSize,
            expireAt,
            countdownText: this.formatGrouponCountdown(expireAt)
        };
    },
    mapGrouponActivity(raw) {
        const id = Number(raw.id || raw.activity_id || 0);
        if (id <= 0) {
            return null;
        }
        const endAt = Number(raw.end_at || 0);
        const teamRows = Array.isArray(raw.open_teams) ? raw.open_teams : (Array.isArray(raw.teams) ? raw.teams : []);
        return {
            id,
            name: raw.name || raw.activity_name || '拼团活动',
            groupPrice: Number(raw.group_price || 0).toFixed(2),
            groupSize: Number(raw.group_size || 2),
            endAt,
            countdownText: this.formatGrouponCountdown(endAt),
            openTeams: teamRows.map((team) => this.mapGrouponTeam(team)).filter(Boolean)
        };
    },
    refreshGrouponCountdown() {
        const list = this.data.grouponActivities || [];
        if (!list.length) {
            return;
        }
        let changed = false;
        const nextList = list.map((item) => {
            const nextCountdownText = this.formatGrouponCountdown(item.endAt);
            const nextTeams = (item.openTeams || []).map((team) => {
                const nextTeamCountdown = this.formatGrouponCountdown(team.expireAt);
                if (nextTeamCountdown === team.countdownText) {
                    return team;
                }
                changed = true;
                return Object.assign({}, team, {
                    countdownText: nextTeamCountdown
                });
            });
            if (nextCountdownText === item.countdownText && nextTeams === item.openTeams) {
                return item;
            }
            if (nextCountdownText !== item.countdownText) {
                changed = true;
            }
            return Object.assign({}, item, {
                countdownText: nextCountdownText,
                openTeams: nextTeams
            });
        });
        if (changed) {
            this.setData({
                grouponActivities: nextList
            });
        }
    },
    getGrouponActivities() {
        util.request(api.GrouponActivityList, {
            goodsId: this.data.id,
            page: 1,
            size: 5
        }, 'GET', { page: this }).then((res) => {
            if (res.errno !== 0) {
                this.setData({
                    grouponActivities: []
                });
                return;
            }
            const payload = res.data || {};
            const rows = Array.isArray(payload.data) ? payload.data : (Array.isArray(payload) ? payload : []);
            const mapped = rows.map((item) => this.mapGrouponActivity(item)).filter(Boolean);
            this.setData({
                grouponActivities: mapped
            });
            if (mapped.length > 0) {
                this.startPromotionTicker();
            }
        }).catch(() => {
            this.setData({
                grouponActivities: []
            });
        });
    },
    resolveGrouponCheckoutProduct() {
        const productList = this.data.productList || [];
        if (productList.length === 1) {
            const product = productList[0];
            if (Number(product.goods_number || 0) < Number(this.data.number || 1)) {
                wx.showToast({
                    image: '/images/icon/icon_error.png',
                    title: '库存不足',
                });
                return null;
            }
            return product;
        }
        if (!this.isCheckedAllSpec()) {
            wx.showToast({
                image: '/images/icon/icon_error.png',
                title: '请选择规格',
            });
            this.setData({
                openAttr: true
            });
            return null;
        }
        const checkedProductArray = this.getCheckedProductItem(this.getCheckedSpecKey());
        if (!checkedProductArray || checkedProductArray.length <= 0) {
            wx.showToast({
                image: '/images/icon/icon_error.png',
                title: '库存不足',
            });
            return null;
        }
        const checkedProduct = checkedProductArray[0];
        if (Number(checkedProduct.goods_number || 0) < Number(this.data.number || 1)) {
            wx.showToast({
                image: '/images/icon/icon_error.png',
                title: '库存不足',
            });
            return null;
        }
        return checkedProduct;
    },
    goGrouponList() {
        wx.navigateTo({
            url: '/pages/groupon/list/index?goodsId=' + this.data.id
        });
    },
    goOpenGroupon(event) {
        if (!util.loginNow()) {
            return;
        }
        const activityId = Number(event.currentTarget.dataset.activityId || 0);
        if (activityId <= 0) {
            return;
        }
        const checkedProduct = this.resolveGrouponCheckoutProduct();
        if (!checkedProduct) {
            return;
        }
        wx.navigateTo({
            url: '/pages/order-check/index?orderType=2&grouponActivityId=' + activityId + '&productId=' + checkedProduct.id + '&number=' + this.data.number
        });
    },
    goJoinGroupon(event) {
        if (!util.loginNow()) {
            return;
        }
        const activityId = Number(event.currentTarget.dataset.activityId || 0);
        const teamId = Number(event.currentTarget.dataset.teamId || 0);
        if (activityId <= 0 || teamId <= 0) {
            return;
        }
        const checkedProduct = this.resolveGrouponCheckoutProduct();
        if (!checkedProduct) {
            return;
        }
        wx.navigateTo({
            url: '/pages/order-check/index?orderType=2&grouponActivityId=' + activityId + '&teamId=' + teamId + '&productId=' + checkedProduct.id + '&number=' + this.data.number
        });
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
            this.refreshGrouponCountdown();
        }, 1000);
    },
    hideDialog: function (e) {
        let that = this;
        that.setData({
            showShareDialog: false,
        });
    },
    shareTo:function(){
        let userInfo = wx.getStorageSync('userInfo');
        if (userInfo == '') {
            util.loginNow();
            return false;
        } else {
            this.setData({
                showShareDialog: !this.data.showShareDialog,
            });
        }
    },
    createShareImage: function () {
        let id = this.data.id;
        wx.navigateTo({
            url: '/pages/share/index?goodsid=' + id
        })
    },
    previewImage: function (e) {
        let current = e.currentTarget.dataset.src;
        let that = this;
        wx.previewImage({
            current: current, // 当前显示图片的http链接  
            urls: that.data.galleryImages // 需要预览的图片http链接列表  
        })
    },
    bindchange: function(e) {
        let current = e.detail.current;
        this.setData({
            current: current
        })
    },
    inputNumber(event) {
        let number = event.detail.value;
        this.setData({
            number: number
        });
    },
    goIndex: function() {
        wx.switchTab({
            url: '/pages/index/index',
        })
    },
    onShareAppMessage: function(res) {
        let id = this.data.id;
        let name = this.data.goods.name;
        let image = this.data.goods.list_pic_url;
        let userId = this.data.userId;
        return {
            title: name,
            path: '/pages/goods/goods?id=' + id + '&&userId=' + userId,
            imageUrl: image
        }
    },
    onUnload: function() {
        this.stopPromotionTicker();
    },
    handleTap: function(event) { //阻止冒泡 
    },
    getGoodsInfo: function() {
        let that = this;
        util.request(api.GoodsDetail, {
            id: that.data.id
        }, 'GET', { page: that }).then(function(res) {
            if (res.errno === 0) {
                let _specificationList = res.data.specificationList;
                // 如果仅仅存在一种货品，那么商品页面初始化时默认checked
                if (_specificationList.valueList.length == 1) {
                    _specificationList.valueList[0].checked = true
                    that.setData({
                        checkedSpecText: '已选择：' + _specificationList.valueList[0].value,
                        tmpSpecText: '已选择：' + _specificationList.valueList[0].value,
                    });
                } else {
                    that.setData({
                        checkedSpecText: '请选择规格和数量'
                    });
                }
                let galleryImages = [];
                for (const item of res.data.gallery) {
                    galleryImages.push(item.img_url);
                }
                const goodsInfo = that.mapPromotionDisplay(res.data.info);
                const productList = (res.data.productList || []).map((item) => that.mapPromotionDisplay(item));
                const defaultPriceDisplay = that.getPriceDisplay(goodsInfo);
                that.setData({
                    goods: goodsInfo,
                    goodsNumber: goodsInfo.goods_number,
                    gallery: res.data.gallery,
                    specificationList: res.data.specificationList,
                    productList: productList,
                    checkedSpecPrice: defaultPriceDisplay.promoPrice,
                    checkedSpecPromoPrice: defaultPriceDisplay.promoPrice,
                    checkedSpecOriginalPrice: defaultPriceDisplay.originalPrice,
                    checkedSpecHasCouponPromo: defaultPriceDisplay.hasCouponPromo,
                    checkedSpecShowOriginalPrice: defaultPriceDisplay.showOriginalPrice,
                    checkedSpecHasVipPrice: defaultPriceDisplay.hasVipPrice,
                    checkedSpecVipPrice: defaultPriceDisplay.vipPrice,
                    checkedSpecVipPriceActive: defaultPriceDisplay.vipPriceActive,
                    galleryImages: galleryImages,
                    loading:1,
                    hasError: false,
                    errorMessage: ''
                });
                if (that.hasPromotionInGoods(goodsInfo, productList)) {
                    that.startPromotionTicker();
                } else {
                    that.stopPromotionTicker();
                }
                that.getGrouponActivities();
                setTimeout(() => {
                    WxParse.wxParse('goodsDetail', 'html', res.data.info.goods_desc, that);
                }, 1000);
                wx.setStorageSync('goodsImage', res.data.info.https_pic_url);
                that.consumePendingCartAction();
            }
            else{
                util.showErrorToast(res.errmsg)
            }
        }).catch(function() {
            that.setData({
                loading: 1,
                hasError: true,
                errorMessage: '商品详情加载失败'
            });
            that.stopPromotionTicker();
            that.setData({
                grouponActivities: []
            });
            util.showErrorToast('商品详情加载失败');
        });
    },
    clickSkuValue: function(event) {
        // goods_specification中的id 要和product中的goods_specification_ids要一样
        let that = this;
        let specNameId = event.currentTarget.dataset.nameId;
        let specValueId = event.currentTarget.dataset.valueId;
        let index = event.currentTarget.dataset.index;
        //判断是否可以点击
        let _specificationList = this.data.specificationList;
        if (_specificationList.specification_id == specNameId) {
            for (let j = 0; j < _specificationList.valueList.length; j++) {
                if (_specificationList.valueList[j].id == specValueId) {
                    //如果已经选中，则反选
                    if (_specificationList.valueList[j].checked) {
                        _specificationList.valueList[j].checked = false;
                    } else {
                        _specificationList.valueList[j].checked = true;
                    }
                } else {
                    _specificationList.valueList[j].checked = false;
                }
            }
        }
        this.setData({
            'specificationList': _specificationList
        });
        //重新计算spec改变后的信息
        this.changeSpecInfo();

        //重新计算哪些值不可以点击
    },
    //获取选中的规格信息
    getCheckedSpecValue: function() {
        let checkedValues = [];
        let _specificationList = this.data.specificationList;
        let _checkedObj = {
            nameId: _specificationList.specification_id,
            valueId: 0,
            valueText: ''
        };
        for (let j = 0; j < _specificationList.valueList.length; j++) {
            if (_specificationList.valueList[j].checked) {
                _checkedObj.valueId = _specificationList.valueList[j].id;
                _checkedObj.valueText = _specificationList.valueList[j].value;
            }
        }
        checkedValues.push(_checkedObj);
        return checkedValues;
    },
    //根据已选的值，计算其它值的状态
    setSpecValueStatus: function() {

    },
    //判断规格是否选择完整
    isCheckedAllSpec: function() {
        return !this.getCheckedSpecValue().some(function(v) {
            if (v.valueId == 0) {
                return true;
            }
        });
    },
    getCheckedSpecKey: function() {
        let checkedValue = this.getCheckedSpecValue().map(function(v) {
            return v.valueId;
        });
        return checkedValue.join('_');
    },
    changeSpecInfo: function() {
        let checkedNameValue = this.getCheckedSpecValue();
        this.setData({
            disabled: '',
            number: 1
        });
        //设置选择的信息
        let checkedValue = checkedNameValue.filter(function(v) {
            if (v.valueId != 0) {
                return true;
            } else {
                return false;
            }
        }).map(function(v) {
            return v.valueText;
        });
        if (checkedValue.length > 0) {
            this.setData({
                tmpSpecText: '已选择：' + checkedValue.join('　'),
                priceChecked: true

            });
        } else {
            this.setData({
                tmpSpecText: '请选择规格和数量',
                priceChecked: false
            });
        }

        if (this.isCheckedAllSpec()) {
            this.setData({
                checkedSpecText: this.data.tmpSpecText
            });

            // 点击规格的按钮后
            // 验证库存
            let checkedProductArray = this.getCheckedProductItem(this.getCheckedSpecKey());
            if (!checkedProductArray || checkedProductArray.length <= 0) {
                this.setData({
                    soldout: true
                });
                // console.error('规格所对应货品不存在');
                wx.showToast({
                    image: '/images/icon/icon_error.png',
                    title: '规格所对应货品不存在',
                });
                return;
            }
            let checkedProduct = checkedProductArray[0];
            const selectedPriceDisplay = this.getPriceDisplay(checkedProduct);
            if (checkedProduct.goods_number < this.data.number) {
                //找不到对应的product信息，提示没有库存
                this.setData({
                    checkedSpecPrice: selectedPriceDisplay.promoPrice,
                    checkedSpecPromoPrice: selectedPriceDisplay.promoPrice,
                    checkedSpecOriginalPrice: selectedPriceDisplay.originalPrice,
                    checkedSpecHasCouponPromo: selectedPriceDisplay.hasCouponPromo,
                    checkedSpecShowOriginalPrice: selectedPriceDisplay.showOriginalPrice,
                    checkedSpecHasVipPrice: selectedPriceDisplay.hasVipPrice,
                    checkedSpecVipPrice: selectedPriceDisplay.vipPrice,
                    checkedSpecVipPriceActive: selectedPriceDisplay.vipPriceActive,
                    goodsNumber: checkedProduct.goods_number,
                    soldout: true
                });
                wx.showToast({
                    image: '/images/icon/icon_error.png',
                    title: '库存不足',
                });
                return false;
            }
            if (checkedProduct.goods_number > 0) {
                this.setData({
                    checkedSpecPrice: selectedPriceDisplay.promoPrice,
                    checkedSpecPromoPrice: selectedPriceDisplay.promoPrice,
                    checkedSpecOriginalPrice: selectedPriceDisplay.originalPrice,
                    checkedSpecHasCouponPromo: selectedPriceDisplay.hasCouponPromo,
                    checkedSpecShowOriginalPrice: selectedPriceDisplay.showOriginalPrice,
                    checkedSpecHasVipPrice: selectedPriceDisplay.hasVipPrice,
                    checkedSpecVipPrice: selectedPriceDisplay.vipPrice,
                    checkedSpecVipPriceActive: selectedPriceDisplay.vipPriceActive,
                    goodsNumber: checkedProduct.goods_number,
                    soldout: false
                });

                var checkedSpecPrice = checkedProduct.retail_price;

            } else {
                const defaultPriceDisplay = this.getPriceDisplay(this.data.goods);
                this.setData({
                    checkedSpecPrice: defaultPriceDisplay.promoPrice,
                    checkedSpecPromoPrice: defaultPriceDisplay.promoPrice,
                    checkedSpecOriginalPrice: defaultPriceDisplay.originalPrice,
                    checkedSpecHasCouponPromo: defaultPriceDisplay.hasCouponPromo,
                    checkedSpecShowOriginalPrice: defaultPriceDisplay.showOriginalPrice,
                    checkedSpecHasVipPrice: defaultPriceDisplay.hasVipPrice,
                    checkedSpecVipPrice: defaultPriceDisplay.vipPrice,
                    checkedSpecVipPriceActive: defaultPriceDisplay.vipPriceActive,
                    soldout: true
                });
            }
        } else {
            const defaultPriceDisplay = this.getPriceDisplay(this.data.goods);
            this.setData({
                checkedSpecText: '请选择规格和数量',
                checkedSpecPrice: defaultPriceDisplay.promoPrice,
                checkedSpecPromoPrice: defaultPriceDisplay.promoPrice,
                checkedSpecOriginalPrice: defaultPriceDisplay.originalPrice,
                checkedSpecHasCouponPromo: defaultPriceDisplay.hasCouponPromo,
                checkedSpecShowOriginalPrice: defaultPriceDisplay.showOriginalPrice,
                checkedSpecHasVipPrice: defaultPriceDisplay.hasVipPrice,
                checkedSpecVipPrice: defaultPriceDisplay.vipPrice,
                checkedSpecVipPriceActive: defaultPriceDisplay.vipPriceActive,
                soldout: false
            });
        }
    },
    getCheckedProductItem: function(key) {
        return this.data.productList.filter(function(v) {
            if (v.goods_specification_ids == key) {
                return true;
            } else {
                return false;
            }
        });
    },
    onLoad: function(options) {
        let id = 0;
        var scene = decodeURIComponent(options.scene);
        if (scene != 'undefined') {
            id = scene;
        } else {
            id = options.id;
        }
        this.setData({
            id: id, // 这个是商品id
            valueId: id,
        });
    },
    onShow: function() {
        let userInfo = wx.getStorageSync('userInfo');
        let token = wx.getStorageSync('token');
        let info = util.getWindowInfo();
        let sysHeight = info.windowHeight - 100;
        let userId = userInfo && userInfo.id;
        if (token && userId > 0) {
            this.setData({
                userId: userId,
                userInfo: userInfo,
            });
        } else {
            this.setData({
                userId: 0,
                userInfo: {}
            });
        }
        this.resumePendingCartAction();
        this.setData({
            priceChecked: false,
            sysHeight: sysHeight
        })
        this.getGoodsInfo();
        this.getCartCount();
    },
    isLoggedIn: function() {
        const userInfo = wx.getStorageSync('userInfo');
        const token = wx.getStorageSync('token');
        return !!(token && userInfo && userInfo.id);
    },
    goLoginForCartAction: function(action) {
        wx.setStorageSync('pendingCartAction', {
            action: action,
            goodsId: this.data.id,
            ts: Date.now()
        });
        wx.navigateTo({
            url: '/pages/app-auth/index'
        });
    },
    resumePendingCartAction: function() {
        const pending = wx.getStorageSync('pendingCartAction');
        if (!pending || pending.goodsId != this.data.id) {
            return;
        }
        if (!this.isLoggedIn()) {
            return;
        }
        this.setData({
            pendingCartAction: pending.action || ''
        });
        wx.removeStorageSync('pendingCartAction');
    },
    consumePendingCartAction: function() {
        const action = this.data.pendingCartAction;
        if (!action) {
            return;
        }
        this.setData({
            pendingCartAction: ''
        });
        if (action === 'addToCart') {
            this.addToCart(true);
        } else if (action === 'fastToCart') {
            this.fastToCart(true);
        }
    },
    onHide:function(){
        this.setData({
            autoplay:false
        });
        this.stopPromotionTicker();
    },
    getCartCount: function() {
        let that = this;
        util.request(api.CartGoodsCount, {}, 'GET', { page: that }).then(function(res) {
            if (res.errno === 0) {
                that.setData({
                    cartGoodsCount: res.data.cartTotal.goodsCount
                });
                store.patch({
                    cartCount: Number(res.data.cartTotal.goodsCount || 0)
                });
            }
        }).catch(function() {
            util.showErrorToast('购物车数量加载失败');
        });
    },
    onPullDownRefresh: function() {
        wx.showNavigationBarLoading()
        this.getGoodsInfo();
        wx.hideNavigationBarLoading() //完成停止加载
        wx.stopPullDownRefresh() //停止下拉刷新
    },
    openCartPage: function() {
        wx.switchTab({
            url: '/pages/cart/cart',
        });
    },
    goIndexPage: function() {
        wx.switchTab({
            url: '/pages/index/index',
        });
    },
    switchAttrPop: function() {
        if (this.data.openAttr == false) {
            this.setData({
                openAttr: !this.data.openAttr
            });
        }
    },
    closeAttr: function() {
        this.setData({
            openAttr: false,
            alone_text: '单独购买'
        });
    },
    goMarketing: function(e) {
        let that = this;
        that.setData({
            showDialog: !this.data.showDialog
        });
    },
    addToCart: function(skipLoginCheck) {
        if (!skipLoginCheck && !this.isLoggedIn()) {
            this.goLoginForCartAction('addToCart');
            return false;
        }
        var that = this;
        let productLength = this.data.productList.length;
        if (this.data.openAttr == false && productLength != 1) {
            //打开规格选择窗口
            this.setData({
                openAttr: !that.data.openAttr
            });
            this.setData({
                alone_text: '加入购物车'
            })
        } else {
            //提示选择完整规格
            if (!this.isCheckedAllSpec()) {
                wx.showToast({
                    image: '/images/icon/icon_error.png',
                    title: '请选择规格',
                });
                return false;
            }
            //根据选中的规格，判断是否有对应的sku信息
            let checkedProductArray = this.getCheckedProductItem(this.getCheckedSpecKey());
            if (!checkedProductArray || checkedProductArray.length <= 0) {
                //找不到对应的product信息，提示没有库存
                wx.showToast({
                    image: '/images/icon/icon_error.png',
                    title: '库存不足',
                });
                return false;
            }
            let checkedProduct = checkedProductArray[0];
            //验证库存
            if (checkedProduct.goods_number < this.data.number) {
                //要买的数量比库存多
                wx.showToast({
                    image: '/images/icon/icon_error.png',
                    title: '库存不足',
                });
                return false;
            }
            wx.showLoading({
              title: '',
              mask:true
            })
            util.request(api.CartAdd, {
                    addType: 0,
                    goodsId: this.data.id,
                    number: this.data.number,
                    productId: checkedProduct.id
                }, "POST", { page: that })
                .then(function(res) {
                    let _res = res;
                    if (_res.errno == 0) {
                        wx.showToast({
                            title: '添加成功',
                        });
                        if (productLength != 1 || that.data.openAttr == true) {
                            that.setData({
                                openAttr: !that.data.openAttr,
                                cartGoodsCount: _res.data.cartTotal.goodsCount
                            });
                        } else {
                            that.setData({
                                cartGoodsCount: _res.data.cartTotal.goodsCount
                            });
                        }
                        store.patch({
                            cartCount: Number(_res.data.cartTotal.goodsCount || 0)
                        });
                    } else {
                        wx.showToast({
                            image: '/images/icon/icon_error.png',
                            title: _res.errmsg,
                        });
                    }
                    wx.hideLoading()
                });
        }
    },
    fastToCart: function(skipLoginCheck) {
        if (!skipLoginCheck && !this.isLoggedIn()) {
            this.goLoginForCartAction('fastToCart');
            return false;
        }
        var that = this;
        if (this.data.openAttr === false) {
            //打开规格选择窗口
            this.setData({
                openAttr: !this.data.openAttr
            });
            that.setData({
                alone_text: '加入购物车'
            })
        } else {
            //提示选择完整规格
            if (!this.isCheckedAllSpec()) {
                wx.showToast({
                    image: '/images/icon/icon_error.png',
                    title: '请选择规格',
                });
                return false;
            }
            //根据选中的规格，判断是否有对应的sku信息
            let checkedProductArray = this.getCheckedProductItem(this.getCheckedSpecKey());
            if (!checkedProductArray || checkedProductArray.length <= 0) {
                //找不到对应的product信息，提示没有库存
                wx.showToast({
                    image: '/images/icon/icon_error.png',
                    title: '库存不足',
                });
                return false;
            }
            let checkedProduct = checkedProductArray[0];
            //验证库存
            if (checkedProduct.goods_number < this.data.number) {
                //要买的数量比库存多
                wx.showToast({
                    image: '/images/icon/icon_error.png',
                    title: '库存不足',
                });
                return false;
            }
            //添加到购物车
            wx.showLoading({
                title: '',
                mask:true
              })
            util.request(api.CartAdd, {
                    addType: 1, // 0：正常加入购物车，1:立即购买，2:再来一单
                    goodsId: this.data.id,
                    number: this.data.number,
                    productId: checkedProduct.id,
                }, "POST", { page: that })
                .then(function(res) {
                    let _res = res;
                    wx.hideLoading()
                    if (_res.errno == 0) {
                        let id = that.data.id;
                        wx.navigateTo({
                            url: '/pages/order-check/index?addtype=1'
                        });
                    } else {
                        wx.showToast({
                            image: '/images/icon/icon_error.png',
                            title: _res.errmsg,
                        });
                    }
                });
        }
    },
    cutNumber: function() {
        this.setData({
            number: (this.data.number - 1 > 1) ? this.data.number - 1 : 1
        });
        this.setData({
            disabled: ''
        });
    },
    addNumber: function() {
        this.setData({
            number: Number(this.data.number) + 1
        });
        let checkedProductArray = this.getCheckedProductItem(this.getCheckedSpecKey());
        let checkedProduct = checkedProductArray;
        var check_number = this.data.number + 1;
        if (checkedProduct.goods_number < check_number) {
            this.setData({
                disabled: true
            });
        }
    },
    retryLoad: function() {
        this.setData({
            loading: 0,
            hasError: false
        });
        this.getGoodsInfo();
        this.getCartCount();
    }
})
