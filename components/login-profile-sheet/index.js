const util = require('../../utils/util.js');
const api = require('../../config/api.js');
const session = require('../../utils/session.js');

const DEFAULT_AVATAR = '/images/icon/default_avatar_big.png';

function normalizeMobile(value) {
  return String(value || '').replace(/\s+/g, '').trim();
}

function isValidMobile(value) {
  return /^1[3-9]\d{9}$/.test(normalizeMobile(value));
}

function maskMobile(value) {
  const mobile = normalizeMobile(value);
  if (!isValidMobile(mobile)) {
    return '未授权';
  }
  return `${mobile.slice(0, 3)}****${mobile.slice(-4)}`;
}

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    initialProfile: {
      type: Object,
      value: {}
    },
    requiredPhone: {
      type: Boolean,
      value: true
    },
    requiredNickname: {
      type: Boolean,
      value: true
    }
  },
  data: {
    nickName: '',
    mobile: '',
    mobileMasked: '未授权',
    avatarUrl: DEFAULT_AVATAR,
    avatarDisplayUrl: DEFAULT_AVATAR,
    submitting: false,
    phoneAuthorized: false,
    phoneManualMode: false
  },
  observers: {
    visible(value) {
      if (value) {
        this.hydrateForm();
      }
    },
    initialProfile() {
      if (this.data.visible) {
        this.hydrateForm();
      }
    }
  },
  methods: {
    hydrateForm() {
      const profile = this.properties.initialProfile || {};
      const nickname = String(profile.nickname || profile.nickName || '').trim();
      const mobile = normalizeMobile(profile.mobile);
      const avatarUrl = profile.avatar || DEFAULT_AVATAR;
      const phoneValid = isValidMobile(mobile);
      this.setData({
        nickName: nickname,
        mobile: mobile,
        mobileMasked: maskMobile(mobile),
        avatarUrl: avatarUrl,
        avatarDisplayUrl: util.normalizeImageUrl(avatarUrl, api.ApiRoot),
        phoneAuthorized: phoneValid,
        phoneManualMode: false
      });
    },
    onNickNameInput(e) {
      const nickName = String(e.detail.value || '');
      this.setData({
        nickName: nickName
      });
    },
    onNickNameBlur() {},
    onMobileInput(e) {
      const mobile = normalizeMobile(e.detail.value);
      this.setData({
        mobile,
        mobileMasked: maskMobile(mobile),
        phoneManualMode: true
      });
    },
    togglePhoneManualInput() {
      this.setData({
        phoneManualMode: !this.data.phoneManualMode
      });
    },
    onChooseAvatar(e) {
      const avatarUrl = e && e.detail ? String(e.detail.avatarUrl || '') : '';
      if (avatarUrl) {
        this.uploadAvatar(avatarUrl);
        return;
      }
      this.pickAndUploadAvatar();
    },
    pickAndUploadAvatar() {
      const that = this;
      wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success(res) {
          const tempPath = res && res.tempFilePaths && res.tempFilePaths[0] ? res.tempFilePaths[0] : '';
          if (!tempPath) {
            util.showErrorToast('未选择图片');
            return;
          }
          that.uploadAvatar(tempPath);
        },
        fail() {
          util.showErrorToast('未选择图片');
        }
      });
    },
    uploadAvatar(tempPath) {
      const previousAvatar = this.data.avatarUrl || DEFAULT_AVATAR;
      this.setData({
        avatarDisplayUrl: util.normalizeImageUrl(tempPath, api.ApiRoot)
      });
      const that = this;
      wx.uploadFile({
        url: api.UploadAvatar,
        filePath: tempPath,
        name: 'upload_file',
        header: {
          'X-Hioshop-Token': wx.getStorageSync('token') || ''
        },
        success(res) {
          if (!res.data) {
            that.setData({
              avatarDisplayUrl: util.normalizeImageUrl(previousAvatar, api.ApiRoot)
            });
            util.showErrorToast('头像上传失败，请稍后再试');
            return;
          }
          try {
            const payload = JSON.parse(res.data);
            if (res.statusCode !== 200 || payload.errno !== 0) {
              throw new Error(payload.errmsg || '头像上传失败');
            }
            const fileUrl = payload && payload.data ? payload.data.fileUrl : '';
            if (!fileUrl) {
              throw new Error('头像地址为空');
            }
            that.setData({
              avatarUrl: fileUrl,
              avatarDisplayUrl: util.normalizeImageUrl(fileUrl, api.ApiRoot)
            });
            util.showSuccessToast('头像已更新');
          } catch (error) {
            that.setData({
              avatarDisplayUrl: util.normalizeImageUrl(previousAvatar, api.ApiRoot)
            });
            util.showErrorToast(error.message || '头像上传失败，请稍后再试');
          }
        },
        fail() {
          that.setData({
            avatarDisplayUrl: util.normalizeImageUrl(previousAvatar, api.ApiRoot)
          });
          util.showErrorToast('头像上传失败，请稍后再试');
        }
      });
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
        this.setData({
          phoneManualMode: true,
          phoneAuthorized: false
        });
        util.showErrorToast('未获取到微信手机号，请手动输入');
        return;
      }
      const that = this;
      util.request(api.AuthPhoneNumber, requestPayload, 'POST').then(function(res) {
        if (res.errno === 0 && res.data && res.data.mobile) {
          const mobile = normalizeMobile(res.data.mobile);
          that.setData({
            mobile,
            mobileMasked: maskMobile(mobile),
            phoneAuthorized: true,
            phoneManualMode: false
          });
          util.showSuccessToast('已自动填充微信手机号');
        } else {
          that.setData({
            phoneManualMode: true,
            phoneAuthorized: false
          });
          util.showErrorToast(res.errmsg || '获取手机号失败，请手动填写');
        }
      }).catch(function() {
        that.setData({
          phoneManualMode: true,
          phoneAuthorized: false
        });
        util.showErrorToast('获取手机号失败，请手动填写');
      });
    },
    submitProfile() {
      if (this.data.submitting) {
        return;
      }
      const nickName = String(this.data.nickName || '').trim();
      const mobile = normalizeMobile(this.data.mobile);

      if (this.properties.requiredNickname && (!nickName || nickName === '微信用户')) {
        util.showErrorToast('请输入有效昵称');
        return;
      }
      if (this.properties.requiredPhone && !isValidMobile(mobile)) {
        util.showErrorToast('请输入有效手机号');
        return;
      }

      const payload = {
        name: (this.properties.initialProfile && this.properties.initialProfile.name) || '',
        mobile: mobile,
        nickName: nickName,
        avatar: this.data.avatarUrl || DEFAULT_AVATAR
      };

      const that = this;
      that.setData({
        submitting: true
      });
      util.request(api.SaveSettings, payload, 'POST').then(function(res) {
        if (res.errno !== 0) {
          util.showErrorToast(res.errmsg || '保存失败，请稍后重试');
          return;
        }
        const cachedUserInfo = wx.getStorageSync('userInfo') || {};
        const savedProfile = Object.assign({}, that.properties.initialProfile || {}, {
          nickname: nickName,
          mobile: mobile,
          avatar: payload.avatar
        });
        wx.setStorageSync('userInfo', Object.assign({}, cachedUserInfo, {
          nickname: nickName,
          mobile: mobile,
          avatar: payload.avatar
        }));
        session.syncProfileCompleted(savedProfile);
        util.showSuccessToast('登录资料已完成');
        that.triggerEvent('success', {
          profile: savedProfile
        });
      }).catch(function() {
        util.showErrorToast('保存失败，请稍后重试');
      }).finally(function() {
        that.setData({
          submitting: false
        });
      });
    },
    onCancel() {
      this.triggerEvent('cancel');
    }
  }
});
