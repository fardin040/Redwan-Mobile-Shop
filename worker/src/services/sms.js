// ============================================================
// worker/src/services/sms.js — Twilio REST API
// Replaces: twilio SDK (not Workers-compatible)
// ============================================================

const twilioBase = (accountSid) =>
  `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

const twilioAuth = (env) =>
  'Basic ' + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);

export const sendSMS = async (env, to, body) => {
  if (!env.TWILIO_ACCOUNT_SID || env.TWILIO_ACCOUNT_SID === 'test_sid') {
    console.log(`[SMS DEV] To: ${to} | Message: ${body}`);
    return;
  }
  const res = await fetch(twilioBase(env.TWILIO_ACCOUNT_SID), {
    method: 'POST',
    headers: {
      Authorization:   twilioAuth(env),
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      To:   to,
      From: env.TWILIO_PHONE_NUMBER,
      Body: body,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error('Twilio error:', text);
    throw new Error('Failed to send SMS');
  }
};

export const sendOTPSms = (env, phone, otp) =>
  sendSMS(env, phone, `Your Redwan Mobile Shop OTP is: ${otp}. Valid for 10 minutes.`);

export const sendOrderStatusSMS = (env, phone, orderNumber, status) => {
  const messages = {
    confirmed:  `✅ Order ${orderNumber} confirmed! We're preparing your package.`,
    processing: `⚙️ Order ${orderNumber} is being processed.`,
    packed:     `📦 Order ${orderNumber} is packed and ready for pickup.`,
    shipped:    `🚚 Order ${orderNumber} has been shipped! Track via your account.`,
    delivered:  `🎉 Order ${orderNumber} delivered! Hope you love your new phone.`,
    cancelled:  `❌ Order ${orderNumber} has been cancelled. Contact us for help.`,
    refunded:   `💰 Refund for order ${orderNumber} is being processed.`,
  };
  const msg = messages[status] || `Order ${orderNumber} status updated to: ${status}`;
  return sendSMS(env, phone, msg);
};
