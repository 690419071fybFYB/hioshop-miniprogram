var api = require('../config/api.js');
const requestSdk = require('./request/index.js');
const session = require('./session.js');

function formatTime(date) {
    var year = date.getFullYear()
    var month = date.getMonth() + 1
    var day = date.getDate()

    var hour = date.getHours()
    var minute = date.getMinutes()
    var second = date.getSeconds()

    return [year, month, day].map(formatNumber).join('-') + ' ' + [hour, minute, second].map(formatNumber).join(':')
}

const formatNumber = n => {
    n = n.toString()
    return n[1] ? n : '0' + n
}

function formatTimeNum(number, format) {

    var formateArr = ['Y', 'M', 'D', 'h', 'm', 's'];
    var returnArr = [];

    var date = new Date(number * 1000);
    returnArr.push(date.getFullYear());
    returnArr.push(formatNumber(date.getMonth() + 1));
    returnArr.push(formatNumber(date.getDate()));

    returnArr.push(formatNumber(date.getHours()));
    returnArr.push(formatNumber(date.getMinutes()));
    returnArr.push(formatNumber(date.getSeconds()));

    for (var i in returnArr) {
        format = format.replace(formateArr[i], returnArr[i]);
    }
    return format;
}

function testMobile(num) {
    console.log
    var myreg = /^(((13[0-9]{1})|(15[0-9]{1})|(18[0-9]{1})|(17[0-9]{1})|(16[0-9]{1})|(19[0-9]{1}))+\d{8})$/;
    if (num.length == 0) {
        wx.showToast({
            title: '手机号为空',
            image: '/images/icon/icon_error.png',
        })
        return false;
    } else if (num.length < 11) {
        wx.showToast({
            title: '手机号长度有误！',
            image: '/images/icon/icon_error.png',
        })
        return false;
    } else if (!myreg.test(num)) {
        wx.showToast({
            title: '手机号有误！',
            image: '/images/icon/icon_error.png',
        })
        return false;
    } else {
        return true;
    }
}

function postProcessResponse(res) {
    const normalizedData = normalizeResponseImageFields(res, api.ApiRoot);
    if (!normalizedData || typeof normalizedData !== 'object' || Array.isArray(normalizedData)) {
        return {
            errno: -1,
            errmsg: 'Invalid API response',
            data: {}
        };
    }
    if (!Object.prototype.hasOwnProperty.call(normalizedData, 'data') || normalizedData.data === null || typeof normalizedData.data === 'undefined') {
        normalizedData.data = {};
    }
    return normalizedData;
}

function legacyRequest(url, data = {}, method = "GET") {
    return new Promise(function(resolve, reject) {
        wx.request({
            url: url,
            data: data,
            method: method,
            header: {
                'Content-Type': 'application/json',
                'X-Hioshop-Token': wx.getStorageSync('token')
            },
            success: function(res) {
                if (res.statusCode == 200) {

                    if (res.data.errno == 401) {
                        //需要登录后才可以操作

                        // let code = null;
                        // return login().then((res) => {
                        //     code = res.code;
                        //     return getUserInfo();
                        // }).then((userInfo) => {
                        //     //登录远程服务器
                        //     request(api.AuthLoginByWeixin, {
                        //         code: code,
                        //         userInfo: userInfo
                        //     }, 'POST').then(res => {
                        //         if (res.errno === 0) {
                        //             //存储用户信息
                        //             wx.setStorageSync('userInfo', res.data.userInfo);
                        //             wx.setStorageSync('token', res.data.token);
                        //             resolve(res);
                        //         } else {
                        //             reject(res);
                        //         }
                        //     }).catch((err) => {
                        //         reject(err);
                        //     });
                        // }).catch((err) => {
                        //     reject(err);
                        // })
                    } else {
                        resolve(postProcessResponse(res.data));
                    }
                } else {
                    reject(res.errMsg);
                }

            },
            fail: function(err) {
                reject(err)
            }
        })
    });
}

/**
 * 封装微信 request。
 * 当开启 features.newRequestSdk 时走新 SDK，可通过 feature 开关快速回滚。
 */
function request(url, data = {}, method = "GET", options = {}) {
    if (!api.features || !api.features.newRequestSdk) {
        return legacyRequest(url, data, method);
    }
    return requestSdk.request(url, data, method, options).then(function(res) {
        return postProcessResponse(res);
    }).catch(function(err) {
        if (err && err.code === 'UNAUTHORIZED' && options.silent401 !== true) {
            wx.showToast({
                title: '登录状态已过期，请重新登录',
                icon: 'none'
            });
            const pages = getCurrentPages();
            const current = pages && pages.length ? pages[pages.length - 1] : null;
            if (!current || current.route !== 'pages/ucenter/index/index') {
                wx.switchTab({
                    url: '/pages/ucenter/index/index'
                });
            }
        }
        if (err && err.code === 'PROFILE_INCOMPLETE') {
            wx.showToast({
                title: '请先完善登录资料',
                icon: 'none'
            });
            const pages = getCurrentPages();
            const current = pages && pages.length ? pages[pages.length - 1] : null;
            if (!current || current.route !== 'pages/ucenter/index/index') {
                wx.switchTab({
                    url: '/pages/ucenter/index/index'
                });
            }
        }
        return Promise.reject(err);
    });
}

/**
 * 检查微信会话是否过期
 */
function checkSession() {
    return new Promise(function(resolve, reject) {
        wx.checkSession({
            success: function() {
                resolve(true);
            },
            fail: function() {
                reject(false);
            }
        })
    });
}

/**
 * 调用微信登录
 */
function login() {
    return new Promise(function(resolve, reject) {
        wx.login({
            success: function(res) {
                if (res.code) {
                    //登录远程服务器
                    resolve(res);
                } else {
                    reject(res);
                }
            },
            fail: function(err) {
                reject(err);
            }
        });
    });
}

function getUserInfo() {
    return new Promise(function(resolve, reject) {
        wx.getUserInfo({
            withCredentials: true,
            success: function(res) {
                resolve(res);
            },
            fail: function(err) {
                reject(err);
            }
        })
    });
}

function redirect(url) {

    //判断页面是否需要登录
    if (false) {
        wx.redirectTo({
            url: '/pages/auth/login/login'
        });
        return false;
    } else {
        wx.redirectTo({
            url: url
        });
    }
}

function showErrorToast(msg) {
    wx.showToast({
        title: msg,
        icon: 'none',
    })
}

function showSuccessToast(msg) {
    wx.showToast({
        title: msg,
        icon: 'success',
    })
}

function sentRes(url, data, method, fn) {
    data = data || null;
    if (data == null) {
        var content = require('querystring').stringify(data);
    } else {
        var content = JSON.stringify(data); //json format
    }

    var parse_u = require('url').parse(url, true);
    var isHttp = parse_u.protocol == 'http:';
    var options = {
        host: parse_u.hostname,
        port: parse_u.port || (isHttp ? 80 : 443),
        path: parse_u.path,
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(content, "utf8"),
            'Trackingmore-Api-Key': '1b70c67e-d191-4301-9c05-a50436a2526d'
        }
    };
    var req = require(isHttp ? 'http' : 'https').request(options, function(res) {
        var _data = '';
        res.on('data', function(chunk) {
            _data += chunk;
        });
        res.on('end', function() {
            fn != undefined && fn(_data);
        });
    });
    req.write(content);
    req.end();
}

function loginNow() {
    const token = wx.getStorageSync('token') || '';
    const pages = getCurrentPages();
    const current = pages && pages.length ? pages[pages.length - 1] : null;
    const isUcenterPage = !!(current && current.route === 'pages/ucenter/index/index');

    if (!token) {
        wx.showToast({
            title: '请先登录',
            icon: 'none'
        });
        if (!isUcenterPage) {
            wx.switchTab({
                url: '/pages/ucenter/index/index'
            });
        }
        return false;
    }

    if (!session.getProfileCompleted()) {
        wx.showToast({
            title: '请先完善登录资料',
            icon: 'none'
        });
        if (!isUcenterPage) {
            wx.switchTab({
                url: '/pages/ucenter/index/index'
            });
        }
        return false;
    }

    return true;
}

function getTextLength(str, full) {
    let len = 0;
    for (let i = 0; i < str.length; i++) {
        let c = str.charCodeAt(i);
        //单字节加1 
        if ((c >= 0x0001 && c <= 0x007e) || (0xff60 <= c && c <= 0xff9f)) {
            len++;
        } else {
            len += (full ? 2 : 1);
        }
    }
    return len;
}

/**
 * rgba(255, 255, 255, 1) => #ffffff
 * @param {String} color 
 */
function transferColor(color = '') {
    let res = '#';
    color = color.replace(/^rgba?\(/, '').replace(/\)$/, '');
    color = color.split(', ');

    color.length > 3 ? color.length = 3 : '';
    for (let item of color) {
        item = parseInt(item || 0);
        if (item < 10) {
            res += ('0' + item)
        } else {
            res += (item.toString(16))
        }
    }

    return res;
}

function transferBorder(border = '') {
    let res = border.match(/(\w+)px\s(\w+)\s(.*)/);
    let obj = {};

    if (res) {
        obj = {
            width: +res[1],
            style: res[2],
            color: res[3]
        }
    }

    return res ? obj : null;
}


/**
 * 内边距，依次为上右下左
 * @param {*} padding 
 */
function transferPadding(padding = '0 0 0 0') {
    padding = padding.split(' ');
    for (let i = 0, len = padding.length; i < len; i++) {
        padding[i] = +padding[i].replace('px', '');
    }

    return padding;
}
/**
 * type1: 0, 25, 17, rgba(0, 0, 0, 0.3)
 * type2: rgba(0, 0, 0, 0.3) 0px 25px 17px 0px => (0, 25, 17, rgba(0, 0, 0, 0.3))
 * @param {*} shadow 
 */
function transferBoxShadow(shadow = '', type) {
    if (!shadow || shadow === 'none') return;
    let color;
    let split;

    split = shadow.match(/(\w+)\s(\w+)\s(\w+)\s(rgb.*)/);

    if (split) {
        split.shift();
        shadow = split;
        color = split[3] || '#ffffff';
    } else {
        split = shadow.split(') ');
        color = split[0] + ')'
        shadow = split[1].split('px ');
    }

    return {
        offsetX: +shadow[0] || 0,
        offsetY: +shadow[1] || 0,
        blur: +shadow[2] || 0,
        color
    }
}

function getUid(prefix) {
    prefix = prefix || '';

    return (
        prefix +
        'xxyxxyxx'.replace(/[xy]/g, c => {
            let r = (Math.random() * 16) | 0;
            let v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        })
    );
}

function getWindowInfo() {
    if (typeof wx.getWindowInfo === 'function') {
        return wx.getWindowInfo();
    }
    if (typeof wx.getSystemInfoSync === 'function') {
        try {
            const systemInfo = wx.getSystemInfoSync() || {};
            return {
                windowWidth: systemInfo.windowWidth || systemInfo.screenWidth || 375,
                windowHeight: systemInfo.windowHeight || systemInfo.screenHeight || 667
            };
        } catch (e) {}
    }
    return {
        windowWidth: 375,
        windowHeight: 667
    };
}

function getDeviceInfo() {
    if (typeof wx.getDeviceInfo === 'function') {
        return wx.getDeviceInfo();
    }
    return {
        system: '',
        platform: ''
    };
}

function normalizeImageUrl(url, root) {
    const fallback = '/images/icon/default_avatar_big.png';
    if (!url) return fallback;

    let finalUrl = String(url).trim();
    if (!finalUrl) return fallback;

    if (finalUrl.startsWith('/images/')) return finalUrl;
    if (finalUrl.startsWith('data:image') || finalUrl.startsWith('wxfile://')) return finalUrl;
    if (finalUrl.startsWith('//')) finalUrl = 'https:' + finalUrl;

    if (finalUrl.startsWith('/')) {
        if (!root) return fallback;
        const base = root.endsWith('/') ? root.slice(0, -1) : root;
        finalUrl = base + finalUrl;
    }

    if (finalUrl.startsWith('http://')) {
        if (/^http:\/\/(127\.0\.0\.1|localhost)/i.test(finalUrl)) {
            return fallback;
        }
        finalUrl = finalUrl.replace(/^http:\/\//i, 'https://');
    }

    if (!/^https:\/\//i.test(finalUrl) && !finalUrl.startsWith('/')) {
        return fallback;
    }
    return finalUrl;
}

function normalizeContentImageUrl(url, root) {
    const fallback = '/images/icon/no-img.png';
    if (!url) return fallback;

    let finalUrl = String(url).trim();
    if (!finalUrl) return fallback;

    if (finalUrl.startsWith('/images/')) return finalUrl;
    if (finalUrl.startsWith('data:image') || finalUrl.startsWith('wxfile://')) return finalUrl;
    if (finalUrl.startsWith('//')) finalUrl = 'https:' + finalUrl;

    if (finalUrl.startsWith('/')) {
        if (!root) return fallback;
        const base = root.endsWith('/') ? root.slice(0, -1) : root;
        finalUrl = base + finalUrl;
    }

    if (finalUrl.startsWith('http://')) {
        if (/^http:\/\/(127\.0\.0\.1|localhost)/i.test(finalUrl)) {
            return fallback;
        }
        finalUrl = finalUrl.replace(/^http:\/\//i, 'https://');
    }

    if (!/^https:\/\//i.test(finalUrl) && !finalUrl.startsWith('/')) {
        return fallback;
    }
    return finalUrl;
}

function normalizeResponseImageFields(payload, root) {
    const imageLikeKeys = [
        'image_url',
        'list_pic_url',
        'icon_url',
        'img_url',
        'banner',
        'avatar',
        'avatar_url',
        'https_pic_url'
    ];

    if (Array.isArray(payload)) {
        return payload.map((item) => normalizeResponseImageFields(item, root));
    }

    if (!payload || typeof payload !== 'object') {
        return payload;
    }

    const next = {};
    Object.keys(payload).forEach((key) => {
        const value = payload[key];
        if (typeof value === 'string' && imageLikeKeys.indexOf(key) >= 0) {
            if (key === 'avatar' || key === 'avatar_url') {
                next[key] = normalizeImageUrl(value, root);
            } else {
                next[key] = normalizeContentImageUrl(value, root);
            }
        } else {
            next[key] = normalizeResponseImageFields(value, root);
        }
    });
    return next;
}


module.exports = {
    formatTime: formatTime,
    formatTimeNum: formatTimeNum,
    request,
    redirect,
    showErrorToast,
    showSuccessToast,
    checkSession,
    login,
    getUserInfo,
    testMobile,
    sentRes,
    loginNow,
    getTextLength,
    transferBorder,
    transferColor,
    transferPadding,
    transferBoxShadow,
    getUid,
    getWindowInfo,
    getDeviceInfo,
    normalizeImageUrl,
    normalizeContentImageUrl,
    normalizeResponseImageFields
}
