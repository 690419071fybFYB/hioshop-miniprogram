var util = require('../../utils/util.js');
var api = require('../../config/api.js');
const pay = require('../../services/pay.js');

const DEFAULT_BENEFITS = [
    '会员专享价（按 SKU 固定价）',
    '每月 6 张会员券（30 天有效）',
    '会员价与促销二选一取低价',
    '下单可继续叠加普通优惠券'
];

const DEFAULT_PLAN_ROWS = [
    {
        id: 1,
        name: '黄金会员年卡',
        tag: '年卡',
        price: 69,
        desc: '365 天会员权益',
        is_default: 1
    },
    {
        id: 2,
        name: '黄金会员季卡',
        tag: '季卡',
        price: 25,
        desc: '90 天会员权益',
        is_default: 0
    }
];

const DEFAULT_ANNUAL_SAVE = '3828';

function formatMoney(value, fallbackValue) {
    const next = (value === '' || value === null || typeof value === 'undefined') ? fallbackValue : value;
    if (next === '' || next === null || typeof next === 'undefined') {
        return '';
    }
    const amount = Number(next);
    if (!Number.isFinite(amount)) {
        return String(next);
    }
    return amount.toFixed(2);
}

function toInt(value, fallbackValue) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallbackValue;
    }
    return Math.floor(parsed);
}

Page({
    data: {
        loading: false,
        submitting: false,
        hasError: false,
        errorMessage: '',
        isVip: false,
        statusText: '尚未开通黄金会员',
        expireTimeText: '',
        annualSaveText: DEFAULT_ANNUAL_SAVE,
        benefitSummary: DEFAULT_BENEFITS,
        plans: [],
        selectedPlanId: 0,
        selectedPlanPrice: '0.00',
        selectedPlanName: '',
        agreementText: '',
        submitButtonText: '确认开通',
        agreementChecked: true,
        autoRenewTip: '首期为手动续费，后续支持微信自动续费'
    },
    normalizeBenefits(list) {
        if (!Array.isArray(list) || list.length <= 0) {
            return DEFAULT_BENEFITS;
        }
        const rows = list.map((item) => {
            if (typeof item === 'string') {
                return item.trim();
            }
            if (item && typeof item === 'object') {
                return String(item.text || item.title || item.name || item.desc || '').trim();
            }
            return '';
        }).filter((item) => !!item);
        return rows.length > 0 ? rows : DEFAULT_BENEFITS;
    },
    hasCjkText(value) {
        return /[\u3400-\u9FFF]/.test(String(value || ''));
    },
    isLikelyCorruptedPlanName(value) {
        const raw = String(value || '').trim();
        if (!raw) {
            return true;
        }
        if (/\?{2,}/.test(raw) || /�/.test(raw)) {
            return true;
        }
        if (/[\x00-\x1F]/.test(raw)) {
            return true;
        }
        if (this.hasCjkText(raw)) {
            return false;
        }
        if (/[ÃÂÐÑ]/.test(raw)) {
            return true;
        }
        return false;
    },
    repairUtf8MojibakeText(value) {
        const raw = String(value || '').trim();
        if (!raw) {
            return raw;
        }
        if (this.hasCjkText(raw)) {
            return raw;
        }
        if (!/[\u00C0-\u00FF]/.test(raw)) {
            return raw;
        }
        try {
            const decoded = decodeURIComponent(escape(raw));
            if (decoded && this.hasCjkText(decoded)) {
                return decoded;
            }
        } catch (err) {
            // noop
        }
        if (typeof Buffer !== 'undefined') {
            try {
                const decoded = Buffer.from(raw, 'latin1').toString('utf8').trim();
                if (decoded && this.hasCjkText(decoded)) {
                    return decoded;
                }
            } catch (err) {
                // noop
            }
        }
        return raw;
    },
    normalizePlans(list) {
        const sourceList = Array.isArray(list) && list.length > 0 ? list : DEFAULT_PLAN_ROWS;
        return sourceList.map((item, index) => {
            const source = item || {};
            const rawPlanId = source.planId || source.plan_id || source.id || source.value;
            let planId = Number(rawPlanId);
            if (!Number.isFinite(planId) || planId <= 0) {
                planId = index + 1;
            }
            const rawName = source.name || source.plan_name || source.title || '';
            const dayCount = toInt(source.days || source.day_count || source.duration_days || 0, 0);
            const repairedName = this.repairUtf8MojibakeText(rawName);
            const normalizedName = this.isLikelyCorruptedPlanName(repairedName) ? '' : repairedName;
            const isYearCard = /年/.test(normalizedName || '') || dayCount >= 300 || index === 0;
            const fallbackName = isYearCard ? '黄金会员年卡' : '黄金会员季卡';
            const name = normalizedName || fallbackName;
            const fallbackPrice = isYearCard ? 69 : 25;
            const priceText = formatMoney(source.price || source.amount || source.pay_price || source.sale_price, fallbackPrice);
            const originPriceText = formatMoney(source.original_price || source.origin_price || source.market_price, '');
            const monthlyPrice = Number(priceText) > 0
                ? (Number(priceText) / (isYearCard ? 12 : 3)).toFixed(2)
                : '';
            return {
                planId: planId,
                name: name,
                tag: source.tag || source.plan_tag || (isYearCard ? '年卡' : '季卡'),
                desc: source.desc || source.description || source.sub_title || (isYearCard ? '365 天会员权益' : '90 天会员权益'),
                priceText: priceText,
                originPriceText: originPriceText,
                monthlyPriceText: monthlyPrice,
                isDefault: Number(source.is_default || source.default || source.checked || 0) === 1,
                giftTagText: source.gift_tag_text || source.giftTagText || (isYearCard ? '送40元红包' : ''),
                raw: source
            };
        });
    },
    getSelectedPlanById(planId) {
        const rows = this.data.plans || [];
        return rows.find((item) => Number(item.planId) === Number(planId));
    },
    applyVipHome(data) {
        const payload = data || {};
        const status = payload.status || payload.vipStatus || payload.memberStatus || {};
        const isVip = Number(status.is_vip || status.isVip || status.active || payload.is_vip || payload.isVip || 0) === 1;
        const statusText = status.status_text || status.statusText || payload.statusText || (isVip ? '黄金会员已开通' : '尚未开通黄金会员');
        const expireTimeText = status.expire_time_text || status.expireTimeText || status.expire_time || status.expireTime || payload.expireTimeText || payload.expire_time || payload.expireTime || '';
        const benefits = this.normalizeBenefits(payload.benefitSummary || payload.benefit_summary || payload.benefits || payload.rights || payload.rights_summary || []);
        const plans = this.normalizePlans(payload.plans || payload.planList || payload.plan_list || payload.packages || []);
        const defaultPlanId = Number(payload.defaultPlanId || payload.default_plan_id || status.defaultPlanId || status.default_plan_id || 0);
        const defaultPlan = plans.find((item) => item.isDefault);
        let selectedPlanId = defaultPlanId > 0 ? defaultPlanId : (defaultPlan ? defaultPlan.planId : (plans[0] ? plans[0].planId : 0));
        if (!plans.some((item) => Number(item.planId) === Number(selectedPlanId))) {
            selectedPlanId = plans[0] ? plans[0].planId : 0;
        }
        const selectedPlan = plans.find((item) => Number(item.planId) === Number(selectedPlanId)) || {};
        const autorenewAvailable = Number(payload.autorenew_available || payload.autorenewAvailable || 0) === 1;
        this.setData({
            isVip: isVip,
            statusText: statusText,
            expireTimeText: expireTimeText,
            annualSaveText: String(payload.annual_save_text || payload.annualSaveText || payload.max_save_year || DEFAULT_ANNUAL_SAVE),
            benefitSummary: benefits,
            plans: plans,
            selectedPlanId: selectedPlanId,
            selectedPlanPrice: selectedPlan.priceText || '0.00',
            selectedPlanName: selectedPlan.name || '',
            agreementText: payload.agreementText || payload.agreement_text || payload.protocolText || payload.protocol_text || '',
            submitButtonText: payload.submitButtonText || payload.submit_button_text || (isVip ? '确认续费开通' : '确认协议并开通'),
            autoRenewTip: autorenewAvailable ? '已支持微信自动续费，可在会员服务中开启' : '首期为手动续费，后续支持微信自动续费',
            hasError: false,
            errorMessage: ''
        });
    },
    getVipHome() {
        this.setData({
            loading: true
        });
        util.request(api.VipHome, {}, 'GET', { page: this }).then((res) => {
            if (res.errno === 0) {
                this.applyVipHome(res.data || {});
                return;
            }
            this.setData({
                hasError: true,
                errorMessage: res.errmsg || '会员信息加载失败'
            });
            util.showErrorToast(res.errmsg || '会员信息加载失败');
        }).catch((err) => {
            this.setData({
                hasError: true,
                errorMessage: '会员信息加载失败'
            });
            util.showErrorToast((err && (err.errmsg || err.message)) || '会员信息加载失败');
        }).finally(() => {
            this.setData({
                loading: false
            });
            wx.stopPullDownRefresh();
        });
    },
    onShow() {
        if (!util.loginNow()) {
            return;
        }
        this.getVipHome();
    },
    onPullDownRefresh() {
        if (!util.loginNow()) {
            wx.stopPullDownRefresh();
            return;
        }
        this.getVipHome();
    },
    selectPlan(event) {
        const planId = Number(event.currentTarget.dataset.planId || 0);
        if (planId <= 0) {
            return;
        }
        const selectedPlan = this.getSelectedPlanById(planId) || {};
        this.setData({
            selectedPlanId: planId,
            selectedPlanPrice: selectedPlan.priceText || '0.00',
            selectedPlanName: selectedPlan.name || ''
        });
    },
    switchAgreement() {
        this.setData({
            agreementChecked: !this.data.agreementChecked
        });
    },
    buildSubmitPayload(plan) {
        const source = (plan && plan.raw) ? plan.raw : {};
        const payload = {};
        if (typeof source.plan_id !== 'undefined') {
            payload.plan_id = source.plan_id;
        }
        if (typeof source.planId !== 'undefined') {
            payload.planId = source.planId;
        }
        if (typeof source.id !== 'undefined') {
            payload.id = source.id;
        }
        if (typeof payload.planId === 'undefined') {
            payload.planId = Number(plan && plan.planId || 0);
        }
        return payload;
    },
    redirectPayResult(status, orderId) {
        wx.redirectTo({
            url: `/pages/payResult/payResult?status=${status}&orderId=${orderId}`
        });
    },
    payVipOrder(orderId) {
        const parsedOrderId = Number(orderId || 0);
        if (parsedOrderId <= 0) {
            util.showErrorToast('会员订单创建失败');
            return Promise.resolve(false);
        }
        wx.showLoading({
            title: '',
            mask: true
        });
        return pay.payOrder(parsedOrderId).then(() => {
            this.redirectPayResult(1, parsedOrderId);
            return true;
        }).catch(() => {
            this.redirectPayResult(0, parsedOrderId);
            return false;
        }).finally(() => {
            wx.hideLoading();
        });
    },
    submitVip() {
        if (!util.loginNow()) {
            return;
        }
        if (this.data.submitting) {
            return;
        }
        if (!this.data.agreementChecked) {
            util.showErrorToast('请先同意会员服务协议');
            return;
        }
        const selectedPlan = this.getSelectedPlanById(this.data.selectedPlanId);
        if (!selectedPlan || Number(selectedPlan.planId || 0) <= 0) {
            util.showErrorToast('请选择会员套餐');
            return;
        }
        const payload = this.buildSubmitPayload(selectedPlan);
        this.setData({
            submitting: true
        });
        util.request(api.VipSubmit, payload, 'POST', { page: this }).then((res) => {
            if (res.errno !== 0) {
                util.showErrorToast(res.errmsg || '开通失败');
                return;
            }
            const orderInfo = (res.data && res.data.orderInfo) ? res.data.orderInfo : {};
            const orderId = Number(orderInfo.id || 0);
            return this.payVipOrder(orderId).finally(() => {
                this.getVipHome();
            });
        }).catch((err) => {
            util.showErrorToast((err && (err.errmsg || err.message)) || '开通失败，请稍后重试');
        }).finally(() => {
            this.setData({
                submitting: false
            });
        });
    },
    retryLoad() {
        this.setData({
            hasError: false,
            errorMessage: ''
        });
        this.getVipHome();
    }
});
