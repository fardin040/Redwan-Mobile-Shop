// ============================================================
// worker/src/services/payment.js — bKash, Nagad, SSLCommerz
// Replaces: axios with native fetch for Workers
// ============================================================

// ── bKash Tokenized Payment ───────────────────────────────────
export class BkashService {
  constructor(env) {
    this.baseURL    = env.BKASH_BASE_URL;
    this.appKey     = env.BKASH_APP_KEY;
    this.appSecret  = env.BKASH_APP_SECRET;
    this.username   = env.BKASH_USERNAME;
    this.password   = env.BKASH_PASSWORD;
    this.token      = null;
    this.tokenExp   = null;
  }

  async getToken() {
    if (this.token && this.tokenExp > Date.now()) return this.token;
    const res = await fetch(`${this.baseURL}/tokenized/checkout/token/grant`, {
      method:  'POST',
      headers: { username: this.username, password: this.password, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ app_key: this.appKey, app_secret: this.appSecret }),
    });
    const data = await res.json();
    if (data.statusCode !== '0000') throw new Error('bKash token failed: ' + data.statusMessage);
    this.token    = data.id_token;
    this.tokenExp = Date.now() + (data.expires_in - 60) * 1000;
    return this.token;
  }

  async createPayment({ amount, orderId, callbackURL }) {
    const token = await this.getToken();
    const res = await fetch(`${this.baseURL}/tokenized/checkout/create`, {
      method:  'POST',
      headers: { Authorization: token, 'X-APP-Key': this.appKey, 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        mode: '0011', payerReference: orderId, callbackURL,
        amount: String(amount), currency: 'BDT', intent: 'sale', merchantInvoiceNumber: orderId,
      }),
    });
    const data = await res.json();
    if (data.statusCode !== '0000') throw new Error('bKash create failed: ' + data.statusMessage);
    return { paymentID: data.paymentID, bkashURL: data.bkashURL };
  }

  async executePayment(paymentID) {
    const token = await this.getToken();
    const res = await fetch(`${this.baseURL}/tokenized/checkout/execute`, {
      method:  'POST',
      headers: { Authorization: token, 'X-APP-Key': this.appKey, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ paymentID }),
    });
    const data = await res.json();
    if (data.statusCode !== '0000') throw new Error('bKash execute failed: ' + data.statusMessage);
    return { transactionId: data.trxID, paymentID: data.paymentID, amount: data.amount, status: 'paid' };
  }

  async refund({ paymentID, trxID, amount, orderId, reason }) {
    const token = await this.getToken();
    const res = await fetch(`${this.baseURL}/tokenized/checkout/payment/refund`, {
      method:  'POST',
      headers: { Authorization: token, 'X-APP-Key': this.appKey, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ paymentID, amount, trxID, sku: orderId, reason }),
    });
    return res.json();
  }
}

// ── SSLCommerz ────────────────────────────────────────────────
export class SSLCommerzService {
  constructor(env) {
    this.storeId   = env.SSLCOMMERZ_STORE_ID;
    this.storePass = env.SSLCOMMERZ_STORE_PASS;
    this.isLive    = env.SSLCOMMERZ_IS_LIVE === 'true';
    this.baseURL   = this.isLive
      ? 'https://securepay.sslcommerz.com'
      : 'https://sandbox.sslcommerz.com';
    this.frontendURL = env.FRONTEND_URL || 'https://redwanmobile.com';
  }

  async initiatePayment({ order, customer }) {
    const params = new URLSearchParams({
      store_id: this.storeId, store_passwd: this.storePass,
      total_amount: String(order.total_amount), currency: 'BDT',
      tran_id: order.order_number,
      success_url: `${this.frontendURL}/payment/success`,
      fail_url:    `${this.frontendURL}/payment/fail`,
      cancel_url:  `${this.frontendURL}/payment/cancel`,
      ipn_url:     `${this.frontendURL}/api/payments/sslcommerz/ipn`,
      cus_name: customer.name, cus_email: customer.email || 'noemail@mail.com',
      cus_phone: customer.phone, cus_add1: order.shipping_address?.address || '',
      cus_city: order.shipping_address?.district || 'Dhaka', cus_country: 'Bangladesh',
      shipping_method: 'Courier', product_name: 'Mobile Phone',
      product_category: 'Electronics', product_profile: 'general',
    });
    const res  = await fetch(`${this.baseURL}/gwprocess/v4/api.php`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    params.toString(),
    });
    const data = await res.json();
    if (data.status !== 'SUCCESS') throw new Error('SSLCommerz failed: ' + data.failedreason);
    return { gatewayPageURL: data.GatewayPageURL, sessionkey: data.sessionkey };
  }

  async validatePayment(valId) {
    const url = `${this.baseURL}/validator/api/validationserverAPI.php?val_id=${valId}&store_id=${this.storeId}&store_passwd=${this.storePass}&format=json`;
    const res = await fetch(url);
    return res.json();
  }
}
