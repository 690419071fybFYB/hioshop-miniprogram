/**
 * 支付相关服务
 */
const util = require('../utils/util.js');
const api = require('../config/api.js');
function payOrder(orderId) {
    return util.request(api.PayPrepayId, {
        orderId: orderId
    }).then((res) => {
        if (res.errno !== 0) {
            return Promise.reject(res);
        }
        const payParam = res.data || {};
        return new Promise(function(resolve, reject) {
            wx.requestPayment({
                'timeStamp': payParam.timeStamp,
                'nonceStr': payParam.nonceStr,
                'package': payParam.package,
                'signType': payParam.signType,
                'paySign': payParam.paySign,
                'success': function(payRes) {
                    resolve(payRes);
                },
                'fail': function(payRes) {
                    reject(payRes);
                }
            });
        });
    });
}
module.exports = {
    payOrder
};
