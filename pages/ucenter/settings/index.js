var util = require('../../../utils/util.js');
var api = require('../../../config/api.js');

Page({
  data: {
    name: '',
    nickName: '',
    mobile: '',
    avatarUrl: '/images/icon/default_avatar_big.png',
    avatarDisplayUrl: '/images/icon/default_avatar_big.png',
    hasAvatar: 0,
    root: api.ApiRoot,
    profileAuthorized: false,
    phoneAuthorized: false
  },
  useWechatProfile() {
    let that = this;
    wx.getUserProfile({
      lang: 'zh_CN',
      desc: '用于补全头像和昵称',
      success(res) {
        const user = res.userInfo || {};
        const nickName = user.nickName || '';
        const avatarUrl = user.avatarUrl || that.data.avatarUrl;
        if (!nickName && !avatarUrl) {
          util.showErrorToast('未获取到微信资料');
          return;
        }
        that.setData({
          nickName,
          avatarUrl,
          avatarDisplayUrl: util.normalizeImageUrl(avatarUrl, api.ApiRoot),
          profileAuthorized: true
        });
        util.showSuccessToast('已自动填充微信昵称和头像');
      },
      fail() {
        util.showErrorToast('你已取消微信资料授权，可继续手动填写');
      }
    });
  },
  onGetPhoneNumber(e) {
    const detail = e.detail || {};
    if (detail.errMsg !== 'getPhoneNumber:ok' || !detail.code) {
      util.showErrorToast('未授权手机号，可继续手动填写');
      return;
    }
    let that = this;
    util.request(api.AuthPhoneNumber, {
      code: detail.code
    }, 'POST').then(function (res) {
      if (res.errno === 0 && res.data && res.data.mobile) {
        that.setData({
          mobile: res.data.mobile,
          phoneAuthorized: true
        });
        util.showSuccessToast('已自动填充微信手机号');
      } else {
        util.showErrorToast(res.errmsg || '获取手机号失败，请手动填写');
      }
    }).catch(function () {
      util.showErrorToast('获取手机号失败，请手动填写');
    });
  },
  onChooseAvatar(e) {
    const {
      avatarUrl
    } = e.detail
    this.setData({
      avatarUrl,
      avatarDisplayUrl: util.normalizeImageUrl(avatarUrl, api.ApiRoot),
    })
    let that = this;
    wx.uploadFile({
      url: api.UploadAvatar,
      filePath: avatarUrl,
      name: 'upload_file',
      header: {
        'X-Hioshop-Token': wx.getStorageSync('token')
      },
      formData: {
        // 'userId': 'test'
      },
      success(res) {
        if (res.statusCode == 200) {
          let re = res.data
          let echo = JSON.parse(re);
          let data = echo.data;
          let avatarUrl = data.fileUrl
          const localUserInfo = wx.getStorageSync('userInfo') || {};
          localUserInfo.avatar = avatarUrl;
          wx.setStorageSync('userInfo', localUserInfo);
          that.setData({
            avatarUrl: avatarUrl,
            avatarDisplayUrl: util.normalizeImageUrl(avatarUrl, api.ApiRoot),
            hasAvatar: 1
          })
        }
      }
    })
  },
  mobilechange(e) {
    let mobile = e.detail.value;
    this.setData({
      mobile: mobile,
    });
  },
  bindinputNickName(event) {
    let nickName = event.detail.value;
    this.setData({
      nickName: nickName,
    });
  },
  bindinputName(event) {
    let name = event.detail.value;
    this.setData({
      name: name,
    });
  },
  getSettingsDetail() {
    let that = this;
    util.request(api.SettingsDetail).then(function (res) {
      if (res.errno === 0) {
        that.setData({
          name: res.data.name,
          mobile: res.data.mobile,
          nickName: res.data.nickname,
          hasAvatar: 0
        });
        if (res.data.avatar != '') {
          that.setData({
            avatarUrl: res.data.avatar,
            avatarDisplayUrl: util.normalizeImageUrl(res.data.avatar, api.ApiRoot),
            hasAvatar: 1
          })
        } else {
          that.setData({
            avatarDisplayUrl: '/images/icon/default_avatar_big.png'
          })
        }
        that.setData({
          profileAuthorized: !!res.data.nickname,
          phoneAuthorized: !!res.data.mobile
        });
      }
    });
  },
  onLoad: function (options) {
    this.getSettingsDetail();
  },
  saveInfo() {
    let name = this.data.name;
    let mobile = this.data.mobile;
    mobile = mobile.replace(/(^\s*)|(\s*$)/g, "");
    if (mobile != '') {
      var myreg = /^(((13[0-9]{1})|(14[0-9]{1})|(15[0-9]{1})|(18[0-9]{1})|(17[0-9]{1})|(16[0-9]{1})|(19[0-9]{1}))+\d{8})$/;
      if (mobile.length < 11) {
        return util.showErrorToast('手机号码长度不对');
      } else if (!myreg.test(mobile)) {
        return util.showErrorToast('手机号码有问题');
      }
    }
    let avatar = this.data.avatarUrl;
    let nickName = this.data.nickName;
    nickName = nickName.replace(/(^\s*)|(\s*$)/g, "");
    if (nickName == '') {
      util.showErrorToast('请输入昵称');
      return false;
    }
    util.request(api.SaveSettings, {
      name: name,
      mobile: mobile,
      nickName: nickName,
      avatar: avatar,
    }, 'POST').then(function (res) {
      if (res.errno === 0) {
        util.showErrorToast('保存成功');
        wx.navigateBack()
      }
    });
  },
})
