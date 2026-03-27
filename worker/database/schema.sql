-- ============================================================
-- Cloudflare D1 Schema — Redwan Mobile Shop
-- SQLite-compatible (D1 is SQLite 3.44+)
-- Run: wrangler d1 execute redwan-mobile-shop-db --file=worker/database/schema.sql
-- ============================================================

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE,
  phone         TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  role          TEXT NOT NULL DEFAULT 'customer',
  avatar_url    TEXT,
  is_verified   INTEGER NOT NULL DEFAULT 0,
  is_blocked    INTEGER NOT NULL DEFAULT 0,
  tier          TEXT NOT NULL DEFAULT 'new',
  otp           TEXT,
  otp_expires   TEXT,
  refresh_token TEXT,
  last_login    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);

-- ── Addresses ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS addresses (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label       TEXT NOT NULL DEFAULT 'Home',
  full_name   TEXT NOT NULL,
  phone       TEXT NOT NULL,
  address     TEXT NOT NULL,
  district    TEXT NOT NULL,
  upazila     TEXT,
  postal_code TEXT,
  is_default  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);

-- ── Brands ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brands (
  id         TEXT PRIMARY KEY,
  name       TEXT UNIQUE NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  logo_url   TEXT,
  is_active  INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Categories ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id         TEXT PRIMARY KEY,
  name       TEXT UNIQUE NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  icon       TEXT,
  image_url  TEXT,
  parent_id  TEXT REFERENCES categories(id),
  is_active  INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Products ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  slug              TEXT UNIQUE NOT NULL,
  sku               TEXT UNIQUE NOT NULL,
  brand_id          TEXT REFERENCES brands(id),
  category_id       TEXT REFERENCES categories(id),
  short_description TEXT,
  description       TEXT,
  price             REAL NOT NULL,
  sale_price        REAL,
  cost_price        REAL,
  status            TEXT NOT NULL DEFAULT 'draft',
  is_featured       INTEGER NOT NULL DEFAULT 0,
  is_flash_sale     INTEGER NOT NULL DEFAULT 0,
  flash_sale_ends_at TEXT,
  images            TEXT NOT NULL DEFAULT '[]',
  tags              TEXT NOT NULL DEFAULT '[]',
  view_count        INTEGER NOT NULL DEFAULT 0,
  total_sales       INTEGER NOT NULL DEFAULT 0,
  avg_rating        REAL NOT NULL DEFAULT 0,
  review_count      INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_brand    ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status   ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_price    ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured);

-- ── Product FTS5 (Full-Text Search) ──────────────────────────
CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
  id UNINDEXED,
  name,
  short_description,
  tags,
  content='products',
  content_rowid='rowid'
);

-- ── Product Specs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_specs (
  id         TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  group_name TEXT NOT NULL,
  spec_key   TEXT NOT NULL,
  spec_value TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_specs_product ON product_specs(product_id);

-- ── Product Variants ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_variants (
  id           TEXT PRIMARY KEY,
  product_id   TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color        TEXT,
  color_hex    TEXT,
  storage      TEXT,
  ram          TEXT,
  extra_price  REAL NOT NULL DEFAULT 0,
  sku_suffix   TEXT,
  stock        INTEGER NOT NULL DEFAULT 0,
  low_stock_at INTEGER NOT NULL DEFAULT 10,
  image_url    TEXT,
  is_active    INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);

-- ── Inventory Logs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_logs (
  id         TEXT PRIMARY KEY,
  variant_id TEXT NOT NULL REFERENCES product_variants(id),
  change     INTEGER NOT NULL,
  reason     TEXT NOT NULL,
  order_id   TEXT,
  note       TEXT,
  done_by    TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Orders ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id               TEXT PRIMARY KEY,
  order_number     TEXT UNIQUE NOT NULL,
  user_id          TEXT REFERENCES users(id),
  guest_name       TEXT,
  guest_phone      TEXT,
  guest_email      TEXT,
  status           TEXT NOT NULL DEFAULT 'pending',
  subtotal         REAL NOT NULL,
  delivery_charge  REAL NOT NULL DEFAULT 0,
  discount_amount  REAL NOT NULL DEFAULT 0,
  vat_amount       REAL NOT NULL DEFAULT 0,
  total_amount     REAL NOT NULL,
  shipping_address TEXT NOT NULL,
  delivery_method  TEXT,
  courier_name     TEXT,
  tracking_id      TEXT,
  coupon_code      TEXT,
  payment_method   TEXT,
  payment_status   TEXT NOT NULL DEFAULT 'pending',
  payment_ref      TEXT,
  notes            TEXT,
  estimated_delivery TEXT,
  delivered_at     TEXT,
  cancelled_at     TEXT,
  cancel_reason    TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_user    ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_number  ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- ── Order Items ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id          TEXT PRIMARY KEY,
  order_id    TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL REFERENCES products(id),
  variant_id  TEXT REFERENCES product_variants(id),
  name        TEXT NOT NULL,
  image_url   TEXT,
  color       TEXT,
  storage     TEXT,
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  unit_price  REAL NOT NULL,
  total_price REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- ── Order Status History ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_status_history (
  id         TEXT PRIMARY KEY,
  order_id   TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status     TEXT NOT NULL,
  note       TEXT,
  done_by    TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_status_history_order ON order_status_history(order_id);

-- ── Reviews ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id                  TEXT PRIMARY KEY,
  product_id          TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id             TEXT NOT NULL REFERENCES users(id),
  order_id            TEXT REFERENCES orders(id),
  rating              INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title               TEXT,
  body                TEXT,
  images              TEXT NOT NULL DEFAULT '[]',
  is_verified_purchase INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'pending',
  helpful             INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (product_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status  ON reviews(status);

-- ── Wishlist ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wishlist (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist(user_id);

-- ── Coupons ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupons (
  id             TEXT PRIMARY KEY,
  code           TEXT UNIQUE NOT NULL,
  type           TEXT NOT NULL,
  value          REAL NOT NULL,
  min_order      REAL NOT NULL DEFAULT 0,
  max_discount   REAL,
  usage_limit    INTEGER,
  used_count     INTEGER NOT NULL DEFAULT 0,
  per_user_limit INTEGER NOT NULL DEFAULT 1,
  expires_at     TEXT,
  is_active      INTEGER NOT NULL DEFAULT 1,
  created_by     TEXT REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);

-- ── Coupon Usage ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupon_usage (
  id        TEXT PRIMARY KEY,
  coupon_id TEXT NOT NULL REFERENCES coupons(id),
  user_id   TEXT NOT NULL REFERENCES users(id),
  order_id  TEXT REFERENCES orders(id),
  used_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (coupon_id, user_id, order_id)
);

-- ── Banners ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS banners (
  id         TEXT PRIMARY KEY,
  title      TEXT,
  image_url  TEXT NOT NULL,
  link_url   TEXT,
  position   TEXT NOT NULL DEFAULT 'hero',
  is_active  INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  starts_at  TEXT,
  ends_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Payments ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id              TEXT PRIMARY KEY,
  order_id        TEXT NOT NULL REFERENCES orders(id),
  method          TEXT NOT NULL,
  amount          REAL NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'BDT',
  status          TEXT NOT NULL DEFAULT 'pending',
  transaction_id  TEXT UNIQUE,
  gateway_ref     TEXT,
  gateway_payload TEXT,
  paid_at         TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_txn   ON payments(transaction_id);

-- ── Notifications ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  link       TEXT,
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
