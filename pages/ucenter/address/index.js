var util = require('../../../utils/util.js');
var api = require('../../../config/api.js');
const ADDRESS_PICKED_ONCE_KEY = 'checkoutAddressPickedOnce';

Page({
    data: {
        addresses: [],
        nowAddress: 0
    },
    goAddressDetail: function(e) {
        let id = e.currentTarget.dataset.addressid;
        wx.navigateTo({
            url: '/pages/ucenter/address-detail/index?id=' + id,
        })
    },
    getAddresses() {
        let that = this;
        return util.request(api.GetAddresses).then(function(res) {
            if (res.errno === 0) {
                that.setData({
                    addresses: res.data
                })
            }
        }).catch(function () {
            util.showErrorToast('地址列表加载失败');
        });
    },
    selectAddress:function(e) {
        let addressId = e.currentTarget.dataset.addressid
        wx.setStorageSync('addressId', addressId);
        wx.setStorageSync(ADDRESS_PICKED_ONCE_KEY, 1);
        wx.navigateBack();
    },
    onLoad: function(options) {
        let type = options.type;
        this.setData({
            type: type
        })
    },
    onUnload: function() {},
    onShow: function() {
        this.getAddresses();
        let addressId = Number(wx.getStorageSync('addressId') || 0);
        if (addressId > 0) {
            this.setData({
                nowAddress: addressId
            });
        }
        else {
            this.setData({
                nowAddress: 0
            });
        }
    },
    addAddress: function() {
        wx.navigateTo({
            url: '/pages/ucenter/address-detail/index?id=' + 0,
        })
    },
    onPullDownRefresh: function () {
        wx.showNavigationBarLoading()
        this.getAddresses().finally(function () {
            wx.hideNavigationBarLoading() //完成停止加载
            wx.stopPullDownRefresh() //停止下拉刷新
        });
    }
})
