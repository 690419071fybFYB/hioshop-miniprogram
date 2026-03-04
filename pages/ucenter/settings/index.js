var util = require('../../../utils/util.js');
var api = require('../../../config/api.js');
const session = require('../../../utils/session.js');

Page({
  data: {
    nickName: '',
    mobile: '',
    avatarUrl: '/images/icon/default_avatar_big.png',
    avatarDisplayUrl: '/images/icon/default_avatar_big.png',
    hasAvatar: 0,
    root: api.ApiRoot,
    phoneAuthorized: false
  },
  onGetPhoneNumber(e) {
    const detail = e.detail || {};
    const requestPayload = {};
    if (detail.code) {
      requestPayload.code = detail.code;
    }
    if (detail.encryptedData && detail.iv) {
      requestPayload.encryptedData = detail.encryptedData;
      requestPayload.iv = detail.iv;
    }
    if (!requestPayload.code && !(requestPayload.encryptedData && requestPayload.iv)) {
      util.showErrorToast('未获取到微信手机号，可继续手动填写');
      return;
    }
    let that = this;
    util.request(api.AuthPhoneNumber, requestPayload, 'POST').then(function (res) {
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
    const previousAvatar = this.data.avatarUrl || '/images/icon/default_avatar_big.png';
    const { avatarUrl } = e.detail || {};
    if (!avatarUrl) {
      util.showErrorToast('未选择头像');
      return;
    }
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
        try {
          const payload = res && res.data ? JSON.parse(res.data) : {};
          if (res.statusCode !== 200 || payload.errno !== 0 || !payload.data || !payload.data.fileUrl) {
            throw new Error((payload && payload.errmsg) || '头像上传失败');
          }
          const uploadedAvatar = payload.data.fileUrl;
          const localUserInfo = wx.getStorageSync('userInfo') || {};
          localUserInfo.avatar = uploadedAvatar;
          wx.setStorageSync('userInfo', localUserInfo);
          that.setData({
            avatarUrl: uploadedAvatar,
            avatarDisplayUrl: util.normalizeImageUrl(uploadedAvatar, api.ApiRoot),
            hasAvatar: 1
          });
          util.showSuccessToast('头像已更新');
        } catch (error) {
          that.setData({
            avatarUrl: previousAvatar,
            avatarDisplayUrl: util.normalizeImageUrl(previousAvatar, api.ApiRoot),
          });
          util.showErrorToast(error.message || '头像上传失败');
        }
      },
      fail() {
        that.setData({
          avatarUrl: previousAvatar,
          avatarDisplayUrl: util.normalizeImageUrl(previousAvatar, api.ApiRoot),
        });
        util.showErrorToast('头像上传失败');
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
  getSettingsDetail() {
    let that = this;
    util.request(api.SettingsDetail).then(function (res) {
      if (res.errno === 0) {
        that.setData({
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
          phoneAuthorized: !!res.data.mobile
        });
        session.syncProfileCompleted(res.data);
      }
    });
  },
  onLoad: function (options) {
    this.getSettingsDetail();
  },
  saveInfo() {
    let mobile = String(this.data.mobile || '').replace(/(^\s*)|(\s*$)/g, "");
    if (!mobile) {
      return util.showErrorToast('请输入手机号');
    }
    if (!/^1[3-9]\d{9}$/.test(mobile)) {
      return util.showErrorToast('手机号码有问题');
    }
    let avatar = this.data.avatarUrl;
    let nickName = this.data.nickName;
    nickName = nickName.replace(/(^\s*)|(\s*$)/g, "");
    if (nickName == '') {
      util.showErrorToast('请输入昵称');
      return false;
    }
    util.request(api.SaveSettings, {
      name: '',
      mobile: mobile,
      nickName: nickName,
      avatar: avatar,
    }, 'POST').then(function (res) {
      if (res.errno === 0) {
        const savedProfile = {
          nickname: nickName,
          mobile: mobile,
          avatar: avatar
        };
        const localUserInfo = wx.getStorageSync('userInfo') || {};
        wx.setStorageSync('userInfo', Object.assign({}, localUserInfo, {
          nickname: nickName,
          avatar: avatar
        }));
        session.syncProfileCompleted(savedProfile);
        util.showSuccessToast('保存成功');
        wx.navigateBack()
      }
    });
  },
})
