const util = require('../../utils/util.js');
const api = require('../../config/api.js');
const session = require('../../utils/session.js');

const DEFAULT_AVATAR = '/images/icon/default_avatar_big.png';

function normalizeMobile(value) {
  return String(value || '').replace(/\s+/g, '').trim();
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
    avatarUrl: DEFAULT_AVATAR,
    avatarDisplayUrl: DEFAULT_AVATAR,
    submitting: false,
    profileAuthorized: false,
    phoneAuthorized: false,
    nicknameManualMode: false,
    focusNickname: false,
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
      this.setData({
        nickName: nickname,
        mobile: mobile,
        avatarUrl: avatarUrl,
        avatarDisplayUrl: util.normalizeImageUrl(avatarUrl, api.ApiRoot),
        profileAuthorized: !!nickname && nickname !== '微信用户',
        phoneAuthorized: /^1[3-9]\d{9}$/.test(mobile),
        nicknameManualMode: !!nickname && nickname !== '微信用户',
        focusNickname: false,
        phoneManualMode: /^1[3-9]\d{9}$/.test(mobile)
      });
    },
    onTapNicknameField() {
      const that = this;
      wx.showActionSheet({
        itemList: ['微信获取昵称头像', '上传头像（相册）', '手动输入昵称'],
        success(res) {
          if (res.tapIndex === 0) {
            that.useWechatProfile();
            return;
          }
          if (res.tapIndex === 1) {
            that.pickAndUploadAvatar();
            return;
          }
          if (res.tapIndex === 2) {
            that.setData({
              nicknameManualMode: true,
              focusNickname: true
            });
          }
        }
      });
    },
    onNickNameInput(e) {
      this.setData({
        nickName: String(e.detail.value || ''),
        nicknameManualMode: true,
        focusNickname: false
      });
    },
    onNickNameBlur() {
      this.setData({
        focusNickname: false
      });
    },
    onMobileInput(e) {
      this.setData({
        mobile: normalizeMobile(e.detail.value),
        phoneManualMode: true
      });
    },
    switchPhoneToWechat() {
      this.setData({
        phoneManualMode: false
      });
    },
    useWechatProfile() {
      const that = this;
      wx.getUserProfile({
        lang: 'zh_CN',
        desc: '用于补全头像和昵称',
        success(res) {
          const user = res.userInfo || {};
          const nickName = String(user.nickName || '').trim();
          const avatarUrl = user.avatarUrl || that.data.avatarUrl;
          if (!nickName && !avatarUrl) {
            util.showErrorToast('未获取到微信资料');
            return;
          }
          that.setData({
            nickName: nickName,
            avatarUrl: avatarUrl,
            avatarDisplayUrl: util.normalizeImageUrl(avatarUrl, api.ApiRoot),
            profileAuthorized: true,
            nicknameManualMode: true,
            focusNickname: false
          });
          util.showSuccessToast('已自动填充微信昵称和头像');
        },
        fail() {
          util.showErrorToast('你已取消微信资料授权，可继续手动填写');
        }
      });
    },
    pickAndUploadAvatar() {
      const that = this;
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success(res) {
          const temp = res && res.tempFiles && res.tempFiles[0] ? res.tempFiles[0] : null;
          const tempPath = temp && temp.tempFilePath ? temp.tempFilePath : '';
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
              avatarDisplayUrl: util.normalizeImageUrl(fileUrl, api.ApiRoot),
              profileAuthorized: true
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
          that.setData({
            mobile: normalizeMobile(res.data.mobile),
            phoneAuthorized: true,
            phoneManualMode: true
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
      if (this.properties.requiredPhone && !/^1[3-9]\d{9}$/.test(mobile)) {
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
