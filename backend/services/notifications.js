// ============================================================
// services/notifications.js — SMS + Email
// ============================================================
const nodemailer = require('nodemailer');

let transporter = null;
try {
  transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST  || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
} catch (err) {
  console.warn('⚠️  Email service not configured:', err.message);
}

const sendOTPSms = async (phone, otp) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV SMS] OTP for ${phone}: ${otp}`);
    return;
  }
  if (process.env.SMS_PROVIDER === 'twilio') {
    const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await twilio.messages.create({
      body: `Your Redwan Mobile Shop OTP is: ${otp}. Valid for ${process.env.OTP_EXPIRES_MINUTES || 10} minutes. Do not share with anyone.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to:   phone,
    });
  }
};

const sendOrderStatusSMS = async (phone, orderNumber, status) => {
  const messages = {
    confirmed:  `Your order ${orderNumber} has been confirmed! We are preparing it for dispatch. Redwan Mobile Shop`,
    shipped:    `Great news! Your order ${orderNumber} has been shipped and is on its way. Track at redwanmobile.com. Redwan Mobile Shop`,
    delivered:  `Your order ${orderNumber} has been delivered! Thank you for shopping with us. Redwan Mobile Shop`,
    cancelled:  `Your order ${orderNumber} has been cancelled. If you paid online, refund will arrive in 3-5 days. Redwan Mobile Shop`,
  };
  const body = messages[status];
  if (!body) return;

  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV SMS] To ${phone}: ${body}`);
    return;
  }
  if (process.env.SMS_PROVIDER === 'twilio') {
    const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await twilio.messages.create({ body, from: process.env.TWILIO_PHONE_NUMBER, to: phone });
  }
};

const sendWelcomeEmail = async (email, name) => {
  if (!transporter) {
    console.warn('Email service not configured, skipping welcome email');
    return;
  }
  try {
    await transporter.sendMail({
      from:    process.env.SMTP_USER || process.env.EMAIL_FROM,
      to:      email,
      subject: `Welcome to Redwan Mobile Shop, ${name}! 🎉`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
          <div style="background:#E8132A;padding:30px;text-align:center;">
            <h1 style="color:#fff;font-size:28px;margin:0;letter-spacing:2px;">REDWAN MOBILE SHOP</h1>
          </div>
          <div style="padding:40px 30px;">
            <h2 style="color:#111;">Welcome, ${name}! 🎉</h2>
            <p style="color:#555;line-height:1.7;">
              Your account has been created successfully. You can now:
            </p>
            <ul style="color:#555;line-height:2;">
              <li>Browse 500+ genuine smartphones and accessories</li>
              <li>Track your orders in real-time</li>
              <li>Save your favorite products to wishlist</li>
              <li>Get exclusive deals and flash sale alerts</li>
            </ul>
            <a href="${process.env.FRONTEND_URL}" style="display:inline-block;background:#E8132A;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px;">Start Shopping →</a>
          </div>
          <div style="background:#f5f5f5;padding:20px 30px;text-align:center;color:#888;font-size:12px;">
            Redwan Mobile Shop · Narsingdi, Dhaka, Bangladesh<br/>
            📞 +880 1700-000000 · ✉️ hello@redwanmobile.com
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error('Failed to send welcome email:', err.message);
  }
};

const sendOrderConfirmationEmail = async (email, order) => {
  if (!transporter) {
    console.warn('Email service not configured, skipping order confirmation email');
    return;
  }
  try {
    await transporter.sendMail({
      from:    process.env.SMTP_USER || process.env.EMAIL_FROM,
      to:      email,
      subject: `Order Confirmed: ${order.order_number} — Redwan Mobile Shop`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#E8132A;padding:24px;text-align:center;">
            <h1 style="color:#fff;font-size:24px;margin:0;">ORDER CONFIRMED ✓</h1>
          </div>
          <div style="padding:32px 24px;background:#fff;">
            <h2 style="color:#111;">Thank you for your order!</h2>
            <div style="background:#f9f9f9;border-radius:8px;padding:20px;margin:20px 0;">
              <p style="margin:4px 0;"><strong>Order ID:</strong> ${order.order_number}</p>
              <p style="margin:4px 0;"><strong>Total:</strong> ৳${order.total_amount}</p>
              <p style="margin:4px 0;"><strong>Payment:</strong> ${order.payment_method?.toUpperCase()}</p>
              <p style="margin:4px 0;"><strong>Estimated Delivery:</strong> ${order.estimated_delivery || '3-5 business days'}</p>
            </div>
            <a href="${process.env.FRONTEND_URL}/orders/${order.id}" style="display:inline-block;background:#E8132A;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Track Your Order →</a>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error('Failed to send order confirmation email:', err.message);
  }
};

module.exports = { sendOTPSms, sendOrderStatusSMS, sendWelcomeEmail, sendOrderConfirmationEmail };


// ============================================================
// services/shipping.js — Pathao + Steadfast courier APIs
// ============================================================
const shippingRouter = require('express').Router();
const { isAdmin: shipAdmin } = require('../middleware/auth');
const axios2 = require('axios');

// ── Pathao Courier ────────────────────────────────────────────
const pathaoToken = { value: null, exp: 0 };

const getPathaoToken = async () => {
  if (pathaoToken.value && pathaoToken.exp > Date.now()) return pathaoToken.value;
  const res = await axios2.post(`${process.env.PATHAO_BASE_URL}/issue-token`, {
    client_id:     process.env.PATHAO_CLIENT_ID,
    client_secret: process.env.PATHAO_CLIENT_SECRET,
    grant_type:    'client_credentials',
  });
  pathaoToken.value = res.data.access_token;
  pathaoToken.exp   = Date.now() + (res.data.expires_in - 60) * 1000;
  return pathaoToken.value;
};

// Create Pathao shipment
shippingRouter.post('/pathao/create', shipAdmin, async (req, res) => {
  try {
    const token = await getPathaoToken();
    const { order } = req.body;
    const payload = {
      store_id:              parseInt(process.env.PATHAO_STORE_ID || '1'),
      merchant_order_id:     order.order_number,
      recipient_name:        order.shipping_address.full_name,
      recipient_phone:       order.shipping_address.phone,
      recipient_address:     order.shipping_address.address,
      recipient_city:        3,   // Dhaka city ID
      recipient_zone:        87,  // Zone ID
      delivery_type:         48,  // Normal delivery
      item_type:             2,   // Parcel
      special_instruction:   order.notes || '',
      item_quantity:         1,
      item_weight:           0.5,
      amount_to_collect:     order.payment_method === 'cod' ? order.total_amount : 0,
    };
    const result = await axios2.post(`${process.env.PATHAO_BASE_URL}/orders`, payload, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    res.json({ success: true, data: result.data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Track Pathao shipment
shippingRouter.get('/pathao/track/:consignmentId', async (req, res) => {
  try {
    const token = await getPathaoToken();
    const result = await axios2.get(
      `${process.env.PATHAO_BASE_URL}/orders/${req.params.consignmentId}/info`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    res.json({ success: true, data: result.data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── Steadfast Courier ─────────────────────────────────────────
shippingRouter.post('/steadfast/create', shipAdmin, async (req, res) => {
  try {
    const { order } = req.body;
    const result = await axios2.post(`${process.env.STEADFAST_BASE_URL}/create_order`, {
      invoice:       order.order_number,
      recipient_name:  order.shipping_address.full_name,
      recipient_phone: order.shipping_address.phone,
      recipient_address: order.shipping_address.address,
      cod_amount:    order.payment_method === 'cod' ? order.total_amount : 0,
      note:          order.notes || '',
    }, {
      headers: {
        'Api-Key':    process.env.STEADFAST_API_KEY,
        'Secret-Key': process.env.STEADFAST_SECRET_KEY,
        'Content-Type': 'application/json',
      }
    });
    res.json({ success: true, data: result.data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

shippingRouter.get('/steadfast/track/:trackingCode', async (req, res) => {
  try {
    const result = await axios2.get(
      `${process.env.STEADFAST_BASE_URL}/track?tracking_code=${req.params.trackingCode}`,
      { headers: { 'Api-Key': process.env.STEADFAST_API_KEY, 'Secret-Key': process.env.STEADFAST_SECRET_KEY } }
    );
    res.json({ success: true, data: result.data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = { notificationsService: module.exports, shippingRouter };


// ============================================================
// routes/admin.js — Admin-only analytics + management
// ============================================================
const adminRouter  = require('express').Router();
const { query: dbQuery } = require('../database/db');
const { isAdmin: adminGuard } = require('../middleware/auth');

adminRouter.use(adminGuard);

// Dashboard stats
adminRouter.get('/stats', async (req, res) => {
  const [revenue, orders, customers, stock] = await Promise.all([
    dbQuery(`SELECT COALESCE(SUM(total_amount), 0) AS total,
               COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE THEN total_amount END), 0) AS today
             FROM orders WHERE payment_status = 'paid'`),
    dbQuery(`SELECT COUNT(*) AS total,
               COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) AS today,
               COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending
             FROM orders`),
    dbQuery(`SELECT COUNT(*) AS total,
               COUNT(CASE WHEN created_at >= date_trunc('month', CURRENT_DATE) THEN 1 END) AS this_month
             FROM users WHERE role = 'customer'`),
    dbQuery(`SELECT COUNT(*) AS total_products,
               COUNT(CASE WHEN v.stock <= v.low_stock_at AND v.stock > 0 THEN 1 END) AS low_stock,
               COUNT(CASE WHEN v.stock = 0 THEN 1 END) AS out_of_stock
             FROM product_variants v`),
  ]);

  res.json({ success: true, data: {
    revenue: revenue.rows[0], orders: orders.rows[0],
    customers: customers.rows[0], stock: stock.rows[0],
  }});
});

// Top selling products
adminRouter.get('/top-products', async (req, res) => {
  const { rows } = await dbQuery(
    `SELECT p.id, p.name, p.slug, p.total_sales, p.price, p.sale_price,
            b.name AS brand_name, p.images
     FROM products p LEFT JOIN brands b ON p.brand_id = b.id
     ORDER BY p.total_sales DESC LIMIT 10`
  );
  res.json({ success: true, data: rows });
});

// Sales chart data (last 30 days)
adminRouter.get('/sales-chart', async (req, res) => {
  const { rows } = await dbQuery(
    `SELECT DATE(created_at) AS date,
            COUNT(*)          AS order_count,
            SUM(total_amount) AS revenue
     FROM orders WHERE created_at >= NOW() - INTERVAL '30 days'
       AND payment_status = 'paid'
     GROUP BY DATE(created_at) ORDER BY date`
  );
  res.json({ success: true, data: rows });
});

// All orders (admin)
adminRouter.get('/orders', async (req, res) => {
  const { page = 1, limit = 20, status, payment, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params = [];
  const filters = ['1=1'];

  if (status) { params.push(status); filters.push(`o.status = $${params.length}`); }
  if (payment) { params.push(payment); filters.push(`o.payment_method = $${params.length}`); }
  if (search) { params.push(`%${search}%`); filters.push(`(o.order_number ILIKE $${params.length} OR u.name ILIKE $${params.length} OR u.phone ILIKE $${params.length})`); }

  params.push(parseInt(limit), offset);
  const { rows } = await dbQuery(
    `SELECT o.*, u.name AS customer_name, u.phone AS customer_phone
     FROM orders o LEFT JOIN users u ON o.user_id = u.id
     WHERE ${filters.join(' AND ')}
     ORDER BY o.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json({ success: true, data: rows });
});

// All customers (admin)
adminRouter.get('/customers', async (req, res) => {
  const { page = 1, limit = 20, search, tier } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params = ["'customer'"];
  const filters = [`role = $1`];

  if (search) { params.push(`%${search}%`); filters.push(`(name ILIKE $${params.length} OR phone ILIKE $${params.length} OR email ILIKE $${params.length})`); }
  if (tier)   { params.push(tier); filters.push(`tier = $${params.length}`); }

  params.push(parseInt(limit), offset);
  const { rows } = await dbQuery(
    `SELECT u.id, u.name, u.email, u.phone, u.tier, u.is_blocked, u.created_at,
            COUNT(o.id)        AS order_count,
            COALESCE(SUM(o.total_amount), 0) AS total_spent,
            MAX(o.created_at)  AS last_order_at
     FROM users u LEFT JOIN orders o ON o.user_id = u.id
     WHERE ${filters.join(' AND ')}
     GROUP BY u.id ORDER BY total_spent DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json({ success: true, data: rows });
});

// Block / unblock customer
adminRouter.put('/customers/:id/block', async (req, res) => {
  const { block } = req.body;
  await dbQuery('UPDATE users SET is_blocked = $1 WHERE id = $2', [block, req.params.id]);
  res.json({ success: true, message: block ? 'Customer blocked' : 'Customer unblocked' });
});

// Update customer tier
adminRouter.put('/customers/:id/tier', async (req, res) => {
  const { tier } = req.body;
  if (!['new','regular','vip'].includes(tier))
    return res.status(400).json({ success: false, message: 'Invalid tier' });
  await dbQuery('UPDATE users SET tier = $1 WHERE id = $2', [tier, req.params.id]);
  res.json({ success: true });
});

// Inventory: low stock alerts
adminRouter.get('/inventory/alerts', async (req, res) => {
  const { rows } = await dbQuery(
    `SELECT v.id, v.color, v.storage, v.stock, v.low_stock_at,
            p.name AS product_name, p.sku, b.name AS brand_name
     FROM product_variants v
     JOIN products p ON v.product_id = p.id
     LEFT JOIN brands b ON p.brand_id = b.id
     WHERE v.stock <= v.low_stock_at AND p.status = 'published'
     ORDER BY v.stock ASC LIMIT 50`
  );
  res.json({ success: true, data: rows });
});

// Inventory: restock variant
adminRouter.put('/inventory/:variantId/restock', async (req, res) => {
  const { quantity, note } = req.body;
  await dbQuery('UPDATE product_variants SET stock = stock + $1 WHERE id = $2', [quantity, req.params.variantId]);
  await dbQuery(
    "INSERT INTO inventory_logs (variant_id, change, reason, note, done_by) VALUES ($1,$2,'restock',$3,$4)",
    [req.params.variantId, quantity, note || null, req.user.id]
  );
  res.json({ success: true, message: `Added ${quantity} units` });
});

// Review moderation
adminRouter.get('/reviews/pending', async (req, res) => {
  const { rows } = await dbQuery(
    `SELECT r.*, p.name AS product_name, u.name AS reviewer_name, u.phone AS reviewer_phone
     FROM reviews r JOIN products p ON r.product_id = p.id JOIN users u ON r.user_id = u.id
     WHERE r.status = 'pending' ORDER BY r.created_at DESC`
  );
  res.json({ success: true, data: rows });
});

adminRouter.put('/reviews/:id/moderate', async (req, res) => {
  const { status } = req.body;  // approved | rejected
  const { rows } = await dbQuery(
    'UPDATE reviews SET status = $1 WHERE id = $2 RETURNING *, (SELECT name FROM products WHERE id = reviews.product_id) AS product_name',
    [status, req.params.id]
  );
  if (status === 'approved') {
    // Recalculate product avg rating
    await dbQuery(
      `UPDATE products SET
         avg_rating   = (SELECT AVG(rating) FROM reviews WHERE product_id = $1 AND status = 'approved'),
         review_count = (SELECT COUNT(*)    FROM reviews WHERE product_id = $1 AND status = 'approved')
       WHERE id = $1`,
      [rows[0].product_id]
    );
  }
  res.json({ success: true, data: rows[0] });
});

module.exports = adminRouter;


// ============================================================
// database/seed.js — Sample data for development
// ============================================================
const seedScript = `
-- Sample brands
INSERT INTO brands (name, slug) VALUES
  ('Samsung',  'samsung'),
  ('Apple',    'apple'),
  ('Xiaomi',   'xiaomi'),
  ('Realme',   'realme'),
  ('OPPO',     'oppo'),
  ('Vivo',     'vivo'),
  ('OnePlus',  'oneplus'),
  ('Nokia',    'nokia'),
  ('Tecno',    'tecno')
ON CONFLICT (slug) DO NOTHING;

-- Sample categories
INSERT INTO categories (name, slug, icon) VALUES
  ('Smartphones',   'smartphones',   '📱'),
  ('Accessories',   'accessories',   '🎧'),
  ('Power Banks',   'power-banks',   '🔋'),
  ('Chargers',      'chargers',      '🔌'),
  ('Phone Cases',   'phone-cases',   '🛡️'),
  ('Smart Watches', 'smart-watches', '⌚'),
  ('Earphones',     'earphones',     '🎧'),
  ('Tablets',       'tablets',       '📺'),
  ('Screen Guards', 'screen-guards', '🔲'),
  ('Speakers',      'speakers',      '🔊')
ON CONFLICT (slug) DO NOTHING;

-- Sample super admin
INSERT INTO users (name, phone, email, password_hash, role, is_verified)
VALUES (
  'Redwan Ahmed',
  '+8801700000000',
  'admin@redwanmobile.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBpj2z/GX.qyMm',  -- password: admin123
  'superadmin',
  TRUE
) ON CONFLICT (phone) DO NOTHING;

-- Coupons
INSERT INTO coupons (code, type, value, min_order, max_discount)
VALUES
  ('REDWAN20', 'percentage', 20, 10000,  50000),
  ('WELCOME10', 'percentage', 10, 5000,   20000),
  ('FLAT500',   'flat',      500, 3000,   NULL),
  ('FREESHIP',  'free_shipping', 0, 1000, NULL)
ON CONFLICT (code) DO NOTHING;
`;

if (require.main === module) {
  const { query: seedQ } = require('./db');
  seedQ(seedScript)
    .then(() => { console.log('✅  Seed complete'); process.exit(0); })
    .catch(err => { console.error('❌  Seed failed:', err); process.exit(1); });
}

module.exports = { seedScript };
