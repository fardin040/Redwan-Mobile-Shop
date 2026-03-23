// ============================================================
// services/payment.js — bKash, Nagad, SSLCommerz integrations
// ============================================================
const axios = require('axios');
const { query } = require('../database/db');

// ════════════════════════════════════════════════════════════
//  bKash Tokenized Payment
// ════════════════════════════════════════════════════════════
class BkashService {
  constructor() {
    this.baseURL  = process.env.BKASH_BASE_URL;
    this.appKey   = process.env.BKASH_APP_KEY;
    this.appSecret = process.env.BKASH_APP_SECRET;
    this.username = process.env.BKASH_USERNAME;
    this.password = process.env.BKASH_PASSWORD;
    this.token    = null;
    this.tokenExp = null;
  }

  // ── Step 1: Get token ────────────────────────────────────
  async getToken() {
    if (this.token && this.tokenExp > Date.now()) return this.token;

    const res = await axios.post(
      `${this.baseURL}/tokenized/checkout/token/grant`,
      { app_key: this.appKey, app_secret: this.appSecret },
      { headers: { username: this.username, password: this.password, 'Content-Type': 'application/json' } }
    );

    if (res.data.statusCode !== '0000') throw new Error('bKash token failed: ' + res.data.statusMessage);
    this.token    = res.data.id_token;
    this.tokenExp = Date.now() + (res.data.expires_in - 60) * 1000;
    return this.token;
  }

  // ── Step 2: Create payment ───────────────────────────────
  async createPayment({ amount, orderId, callbackURL }) {
    const token = await this.getToken();
    const res = await axios.post(
      `${this.baseURL}/tokenized/checkout/create`,
      {
        mode: '0011',  // checkout URL mode
        payerReference: orderId,
        callbackURL,
        amount: String(amount),
        currency: 'BDT',
        intent: 'sale',
        merchantInvoiceNumber: orderId,
      },
      {
        headers: {
          Authorization: token,
          'X-APP-Key': this.appKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (res.data.statusCode !== '0000')
      throw new Error('bKash create payment failed: ' + res.data.statusMessage);

    return { paymentID: res.data.paymentID, bkashURL: res.data.bkashURL };
  }

  // ── Step 3: Execute payment ──────────────────────────────
  async executePayment(paymentID) {
    const token = await this.getToken();
    const res = await axios.post(
      `${this.baseURL}/tokenized/checkout/execute`,
      { paymentID },
      { headers: { Authorization: token, 'X-APP-Key': this.appKey, 'Content-Type': 'application/json' } }
    );

    if (res.data.statusCode !== '0000')
      throw new Error('bKash execute failed: ' + res.data.statusMessage);

    return {
      transactionId: res.data.trxID,
      paymentID:     res.data.paymentID,
      amount:        res.data.amount,
      status:        'paid',
    };
  }

  // ── Query payment status ─────────────────────────────────
  async queryPayment(paymentID) {
    const token = await this.getToken();
    const res = await axios.post(
      `${this.baseURL}/tokenized/checkout/payment/status`,
      { paymentID },
      { headers: { Authorization: token, 'X-APP-Key': this.appKey, 'Content-Type': 'application/json' } }
    );
    return res.data;
  }

  // ── Refund ───────────────────────────────────────────────
  async refund({ paymentID, trxID, amount, orderId, reason }) {
    const token = await this.getToken();
    const res = await axios.post(
      `${this.baseURL}/tokenized/checkout/payment/refund`,
      { paymentID, amount, trxID, sku: orderId, reason },
      { headers: { Authorization: token, 'X-APP-Key': this.appKey, 'Content-Type': 'application/json' } }
    );
    return res.data;
  }
}

// ════════════════════════════════════════════════════════════
//  Nagad Payment
// ════════════════════════════════════════════════════════════
const crypto = require('crypto');

class NagadService {
  constructor() {
    this.merchantId     = process.env.NAGAD_MERCHANT_ID;
    this.privateKey     = process.env.NAGAD_MERCHANT_PRIVATE_KEY;
    this.nagadPublicKey = process.env.NAGAD_PUBLIC_KEY;
    this.baseURL        = process.env.NAGAD_BASE_URL;
  }

  encrypt(data) {
    const buf    = Buffer.from(JSON.stringify(data));
    const pubKey = `-----BEGIN PUBLIC KEY-----\n${this.nagadPublicKey}\n-----END PUBLIC KEY-----`;
    return crypto.publicEncrypt({ key: pubKey, padding: crypto.constants.RSA_PKCS1_PADDING }, buf).toString('base64');
  }

  sign(data) {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(JSON.stringify(data));
    const privKey = `-----BEGIN RSA PRIVATE KEY-----\n${this.privateKey}\n-----END RSA PRIVATE KEY-----`;
    return signer.sign(privKey, 'base64');
  }

  async createPayment({ orderId, amount, callbackURL }) {
    const datetime     = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
    const sensitiveData = { merchantId: this.merchantId, datetime, orderId, challenge: orderId };
    const body = {
      dateTime: datetime,
      sensitiveData: this.encrypt(sensitiveData),
      signature:     this.sign(sensitiveData),
    };

    const res = await axios.post(
      `${this.baseURL}/check-out/initialize/${this.merchantId}/${orderId}`,
      body, { headers: { 'X-KM-Api-Version': 'v-0.2.0', 'Content-Type': 'application/json' } }
    );

    const paymentData  = { merchantId: this.merchantId, orderId, amount: String(amount), currencyCode: 'BDT', challenge: res.data.challenge };
    const completeBody = {
      sensitiveData: this.encrypt(paymentData),
      signature:     this.sign(paymentData),
      merchantCallbackURL: callbackURL,
    };

    const complete = await axios.post(
      `${this.baseURL}/check-out/complete/${res.data.paymentReferenceId}`,
      completeBody, { headers: { 'X-KM-Api-Version': 'v-0.2.0', 'Content-Type': 'application/json' } }
    );

    return { paymentURL: complete.data.callBackUrl, paymentRefId: res.data.paymentReferenceId };
  }
}

// ════════════════════════════════════════════════════════════
//  SSLCommerz (Visa / MasterCard / DBBL etc.)
// ════════════════════════════════════════════════════════════
class SSLCommerzService {
  constructor() {
    this.storeId   = process.env.SSLCOMMERZ_STORE_ID;
    this.storePass = process.env.SSLCOMMERZ_STORE_PASS;
    this.isLive    = process.env.SSLCOMMERZ_IS_LIVE === 'true';
    this.baseURL   = this.isLive
      ? 'https://securepay.sslcommerz.com'
      : 'https://sandbox.sslcommerz.com';
  }

  async initiatePayment({ order, customer }) {
    const params = new URLSearchParams({
      store_id:    this.storeId,
      store_passwd: this.storePass,
      total_amount: String(order.total_amount),
      currency:    'BDT',
      tran_id:     order.order_number,
      success_url: `${process.env.FRONTEND_URL}/payment/success`,
      fail_url:    `${process.env.FRONTEND_URL}/payment/fail`,
      cancel_url:  `${process.env.FRONTEND_URL}/payment/cancel`,
      ipn_url:     `${process.env.FRONTEND_URL?.replace('3000', '5000')}/api/payments/sslcommerz/ipn`,
      cus_name:    customer.name,
      cus_email:   customer.email || 'noemail@redwanmobile.com',
      cus_phone:   customer.phone,
      cus_add1:    order.shipping_address?.address || '',
      cus_city:    order.shipping_address?.district || 'Dhaka',
      cus_country: 'Bangladesh',
      shipping_method: 'Courier',
      product_name:    'Mobile Phone & Accessories',
      product_category: 'Electronics',
      product_profile: 'general',
    });

    const res = await axios.post(`${this.baseURL}/gwprocess/v4/api.php`, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (res.data.status !== 'SUCCESS')
      throw new Error('SSLCommerz initiation failed: ' + res.data.failedreason);

    return { gatewayPageURL: res.data.GatewayPageURL, sessionkey: res.data.sessionkey };
  }

  async validatePayment(valId) {
    const res = await axios.get(`${this.baseURL}/validator/api/validationserverAPI.php`, {
      params: { val_id: valId, store_id: this.storeId, store_passwd: this.storePass, format: 'json' }
    });
    return res.data;
  }
}

// ════════════════════════════════════════════════════════════
//  Payment Router
// ════════════════════════════════════════════════════════════
const paymentRouter = require('express').Router();
const { authenticate: authMW, isAdmin: adminMW } = require('../middleware/auth');

const bkash     = new BkashService();
const nagad     = new NagadService();
const sslcommerz = new SSLCommerzService();

// ── POST /api/payments/bkash/create ───────────────────────────
paymentRouter.post('/bkash/create', authMW, async (req, res) => {
  try {
    const { orderId, amount } = req.body;
    const callbackURL = `${process.env.FRONTEND_URL}/payment/bkash/callback`;
    const result = await bkash.createPayment({ amount, orderId, callbackURL });

    await query(
      "INSERT INTO payments (order_id, method, amount, status, gateway_ref) VALUES ($1,'bkash',$2,'pending',$3)",
      [orderId, amount, result.paymentID]
    );

    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── POST /api/payments/bkash/execute ──────────────────────────
paymentRouter.post('/bkash/execute', authMW, async (req, res) => {
  try {
    const { paymentID, orderId } = req.body;
    const result = await bkash.executePayment(paymentID);

    await query(
      `UPDATE payments SET status='paid', transaction_id=$1, paid_at=NOW(), gateway_payload=$2 WHERE gateway_ref=$3`,
      [result.transactionId, JSON.stringify(result), paymentID]
    );
    await query(
      "UPDATE orders SET payment_status='paid', payment_ref=$1, status='confirmed' WHERE id=$2",
      [result.transactionId, orderId]
    );
    await query(
      "INSERT INTO order_status_history (order_id, status, note) VALUES ($1,'confirmed','Payment confirmed via bKash')",
      [orderId]
    );

    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── POST /api/payments/nagad/create ───────────────────────────
paymentRouter.post('/nagad/create', authMW, async (req, res) => {
  try {
    const { orderId, amount } = req.body;
    const callbackURL = `${process.env.FRONTEND_URL}/payment/nagad/callback`;
    const result = await nagad.createPayment({ orderId, amount, callbackURL });
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── POST /api/payments/sslcommerz/initiate ────────────────────
paymentRouter.post('/sslcommerz/initiate', authMW, async (req, res) => {
  try {
    const { orderId } = req.body;
    const { rows: orderRows } = await query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [orderId, req.user.id]);
    if (!orderRows.length) return res.status(404).json({ success: false, message: 'Order not found' });

    const result = await sslcommerz.initiatePayment({
      order: orderRows[0],
      customer: { name: req.user.name, phone: req.user.phone, email: req.user.email }
    });

    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── POST /api/payments/sslcommerz/ipn (webhook) ──────────────
paymentRouter.post('/sslcommerz/ipn', async (req, res) => {
  try {
    const { val_id, tran_id, status } = req.body;
    if (status === 'VALID') {
      const validation = await sslcommerz.validatePayment(val_id);
      if (validation.status === 'VALID') {
        await query(
          "UPDATE orders SET payment_status='paid', status='confirmed', payment_ref=$1 WHERE order_number=$2",
          [val_id, tran_id]
        );
      }
    }
    res.sendStatus(200);
  } catch (e) {
    console.error('IPN error:', e);
    res.sendStatus(500);
  }
});

// ── POST /api/payments/cod/confirm ────────────────────────────
paymentRouter.post('/cod/confirm', authMW, async (req, res) => {
  const { orderId } = req.body;
  await query(
    "UPDATE orders SET status='confirmed' WHERE id=$1 AND user_id=$2 AND payment_method='cod'",
    [orderId, req.user.id]
  );
  res.json({ success: true, message: 'COD order confirmed' });
});

// ── POST /api/payments/refund (admin) ─────────────────────────
paymentRouter.post('/refund', adminMW, async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    const { rows } = await query('SELECT * FROM payments WHERE order_id = $1 AND status = $2', [orderId, 'paid']);
    if (!rows.length) return res.status(400).json({ success: false, message: 'No paid payment found' });

    const payment = rows[0];
    let refundResult;

    if (payment.method === 'bkash') {
      refundResult = await bkash.refund({
        paymentID: payment.gateway_ref, trxID: payment.transaction_id,
        amount: String(payment.amount), orderId, reason
      });
    }

    await query("UPDATE payments SET status='refunded' WHERE id=$1", [payment.id]);
    await query("UPDATE orders SET payment_status='refunded', status='refunded' WHERE id=$1", [orderId]);

    res.json({ success: true, message: 'Refund processed', data: refundResult });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = { paymentRouter, BkashService, NagadService, SSLCommerzService };
