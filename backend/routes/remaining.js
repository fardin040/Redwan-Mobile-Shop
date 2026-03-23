// ============================================================
// services/redis.js — Redis client (ioredis)
// ============================================================
const Redis = require('ioredis');

const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL)
  : new Redis({
      host:     process.env.REDIS_HOST     || 'localhost',
      port:     parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

redis.on('connect', () => console.log('✅  Redis connected'));
redis.on('error',   (e) => console.error('❌  Redis error:', e.message));

module.exports = redis;


// ============================================================
// routes/reviews.js
// ============================================================
const reviewsRouter = require('express').Router();
const { query: rq } = require('../database/db');
const { authenticate: rAuth, optionalAuth: rOptAuth } = require('../middleware/auth');

// Get reviews for a product (public)
reviewsRouter.get('/product/:productId', async (req, res) => {
  const { page = 1, limit = 10, sort = 'newest' } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const sortMap = { newest: 'r.created_at DESC', highest: 'r.rating DESC', lowest: 'r.rating ASC', helpful: 'r.helpful DESC' };
  const { rows } = await rq(
    `SELECT r.id, r.rating, r.title, r.body, r.images, r.helpful, r.is_verified, r.created_at,
            u.name AS reviewer_name, u.avatar_url
     FROM reviews r JOIN users u ON r.user_id = u.id
     WHERE r.product_id = $1 AND r.status = 'approved'
     ORDER BY ${sortMap[sort] || 'r.created_at DESC'}
     LIMIT $2 OFFSET $3`,
    [req.params.productId, parseInt(limit), offset]
  );
  res.json({ success: true, data: rows });
});

// Post a review (authenticated)
reviewsRouter.post('/', rAuth, async (req, res) => {
  const { product_id, order_id, rating, title, body, images = [] } = req.body;
  if (!product_id || !rating) return res.status(400).json({ success: false, message: 'product_id and rating required' });

  // Check if user bought this product
  let is_verified = false;
  if (order_id) {
    const { rows } = await rq(
      "SELECT 1 FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE o.id = $1 AND o.user_id = $2 AND oi.product_id = $3 AND o.status = 'delivered'",
      [order_id, req.user.id, product_id]
    );
    is_verified = rows.length > 0;
  }

  try {
    const { rows } = await rq(
      `INSERT INTO reviews (product_id, user_id, order_id, rating, title, body, images, is_verified, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending') RETURNING *`,
      [product_id, req.user.id, order_id || null, rating, title || null, body || null, JSON.stringify(images), is_verified]
    );
    res.status(201).json({ success: true, data: rows[0], message: 'Review submitted for moderation' });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ success: false, message: 'You already reviewed this product' });
    res.status(500).json({ success: false, message: 'Failed to submit review' });
  }
});

// Mark review as helpful
reviewsRouter.post('/:id/helpful', rAuth, async (req, res) => {
  await rq('UPDATE reviews SET helpful = helpful + 1 WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

module.exports = reviewsRouter;


// ============================================================
// routes/wishlist.js
// ============================================================
const wishlistRouter = require('express').Router();
const { query: wq } = require('../database/db');
const { authenticate: wAuth } = require('../middleware/auth');

wishlistRouter.use(wAuth);

wishlistRouter.get('/', async (req, res) => {
  const { rows } = await wq(
    `SELECT w.id, w.created_at, p.id AS product_id, p.name, p.slug, p.price, p.sale_price, p.images,
            b.name AS brand_name,
            (SELECT SUM(v.stock) FROM product_variants v WHERE v.product_id = p.id) AS total_stock
     FROM wishlists w JOIN products p ON w.product_id = p.id LEFT JOIN brands b ON p.brand_id = b.id
     WHERE w.user_id = $1 ORDER BY w.created_at DESC`,
    [req.user.id]
  );
  res.json({ success: true, data: rows });
});

wishlistRouter.post('/:productId', async (req, res) => {
  try {
    await wq('INSERT INTO wishlists (user_id, product_id) VALUES ($1, $2)', [req.user.id, req.params.productId]);
    res.status(201).json({ success: true, message: 'Added to wishlist' });
  } catch (e) {
    if (e.code === '23505') return res.json({ success: true, message: 'Already in wishlist' });
    res.status(500).json({ success: false, message: 'Failed to add to wishlist' });
  }
});

wishlistRouter.delete('/:productId', async (req, res) => {
  await wq('DELETE FROM wishlists WHERE user_id = $1 AND product_id = $2', [req.user.id, req.params.productId]);
  res.json({ success: true, message: 'Removed from wishlist' });
});

module.exports = wishlistRouter;


// ============================================================
// routes/promotions.js
// ============================================================
const promoRouter = require('express').Router();
const { query: pq } = require('../database/db');
const { authenticate: pAuth, isAdmin: pAdmin } = require('../middleware/auth');

// Validate a coupon (public)
promoRouter.post('/coupons/validate', async (req, res) => {
  const { code, subtotal, user_id } = req.body;
  const { rows } = await pq(
    `SELECT * FROM coupons WHERE code = $1 AND is_active = TRUE
     AND (expires_at IS NULL OR expires_at > NOW())
     AND (usage_limit IS NULL OR used_count < usage_limit)`,
    [code?.toUpperCase()]
  );
  if (!rows.length) return res.status(404).json({ success: false, message: 'Invalid or expired coupon code' });

  const coupon = rows[0];
  if (subtotal < coupon.min_order)
    return res.status(400).json({ success: false, message: `Minimum order ৳${coupon.min_order} required for this coupon` });

  let discount = 0;
  if (coupon.type === 'percentage')
    discount = Math.min(subtotal * coupon.value / 100, coupon.max_discount || Infinity);
  else if (coupon.type === 'flat')
    discount = coupon.value;
  else if (coupon.type === 'free_shipping')
    discount = 0;

  res.json({ success: true, data: { coupon, discount, type: coupon.type } });
});

// Admin: manage coupons
promoRouter.get('/coupons', pAdmin, async (req, res) => {
  const { rows } = await pq('SELECT * FROM coupons ORDER BY created_at DESC');
  res.json({ success: true, data: rows });
});

promoRouter.post('/coupons', pAdmin, async (req, res) => {
  const { code, type, value, min_order = 0, max_discount, usage_limit, per_user_limit = 1, expires_at } = req.body;
  const { rows } = await pq(
    'INSERT INTO coupons (code, type, value, min_order, max_discount, usage_limit, per_user_limit, expires_at, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
    [code.toUpperCase(), type, value, min_order, max_discount || null, usage_limit || null, per_user_limit, expires_at || null, req.user.id]
  );
  res.status(201).json({ success: true, data: rows[0] });
});

promoRouter.put('/coupons/:id', pAdmin, async (req, res) => {
  const { is_active } = req.body;
  const { rows } = await pq('UPDATE coupons SET is_active = $1 WHERE id = $2 RETURNING *', [is_active, req.params.id]);
  res.json({ success: true, data: rows[0] });
});

// Banners
promoRouter.get('/banners', async (req, res) => {
  const { rows } = await pq(
    "SELECT * FROM banners WHERE is_active = TRUE AND (starts_at IS NULL OR starts_at <= NOW()) AND (ends_at IS NULL OR ends_at > NOW()) ORDER BY sort_order"
  );
  res.json({ success: true, data: rows });
});

module.exports = promoRouter;


// ============================================================
// routes/upload.js — Cloudinary image upload
// ============================================================
const uploadRouter  = require('express').Router();
const multer        = require('multer');
const cloudinary    = require('cloudinary').v2;
const { isAdmin: upAdmin } = require('../middleware/auth');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
const upload  = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '5') * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only images allowed'));
    cb(null, true);
  },
});

// Upload product images (admin)
uploadRouter.post('/product-images', upAdmin, upload.array('images', 10), async (req, res) => {
  try {
    const uploads = await Promise.all(req.files.map(file => {
      return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { folder: `${process.env.CLOUDINARY_UPLOAD_FOLDER || 'redwan'}/products`, quality: 'auto', fetch_format: 'auto' },
          (err, result) => err ? reject(err) : resolve({ url: result.secure_url, public_id: result.public_id })
        ).end(file.buffer);
      });
    }));
    res.json({ success: true, data: uploads });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Upload user avatar
uploadRouter.post('/avatar', upload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  try {
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: `${process.env.CLOUDINARY_UPLOAD_FOLDER || 'redwan'}/avatars`, width: 200, height: 200, crop: 'fill', quality: 'auto' },
        (err, r) => err ? reject(err) : resolve(r)
      ).end(req.file.buffer);
    });
    const { query: uq } = require('../database/db');
    await uq('UPDATE users SET avatar_url = $1 WHERE id = $2', [result.secure_url, req.user?.id]);
    res.json({ success: true, data: { url: result.secure_url } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Delete image (admin)
uploadRouter.delete('/:publicId', upAdmin, async (req, res) => {
  await cloudinary.uploader.destroy(req.params.publicId);
  res.json({ success: true, message: 'Image deleted' });
});

module.exports = uploadRouter;
