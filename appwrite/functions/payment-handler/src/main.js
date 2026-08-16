// Appwrite Serverless Function: Payment Gateway Execution & Callbacks

export default async ({ req, res, log, error }) => {
  try {
    const payload = JSON.parse(req.body || '{}');
    const { gateway, orderId, amount, customerInfo } = payload;

    log(`Processing ${gateway} payment for Order #${orderId}, Amount: BDT ${amount}`);

    if (gateway === 'bkash') {
      // 1. Grant bKash Token
      // 2. Create Payment Request via Tokenized API
      return res.json({
        success: true,
        gateway: 'bkash',
        paymentID: `BKASH_MOCK_${Date.now()}`,
        bkashURL: `https://tokenized.pay.bka.sh/v1.2.0-beta/pay?order=${orderId}`
      });
    }

    if (gateway === 'sslcommerz') {
      return res.json({
        success: true,
        gateway: 'sslcommerz',
        redirectUrl: `https://sandbox.sslcommerz.com/gwprocess/v4/api.php?order=${orderId}`
      });
    }

    if (gateway === 'nagad') {
      return res.json({
        success: true,
        gateway: 'nagad',
        callBackUrl: `https://api.mynagad.com/pay?order=${orderId}`
      });
    }

    return res.json({ success: false, message: 'Invalid payment gateway' }, 400);

  } catch (err) {
    error(`Payment function error: ${err.message}`);
    return res.json({ success: false, message: err.message }, 500);
  }
};
