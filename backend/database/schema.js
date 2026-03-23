// ============================================================
// database/db.js — PostgreSQL connection pool
// ============================================================
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'redwan_shop',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => console.log('✅  PostgreSQL connected'));
pool.on('error', (err) => console.error('❌  PostgreSQL error:', err));

// Helper: run a query
const query = (text, params) => pool.query(text, params);

// Helper: get a client for transactions
const getClient = () => pool.connect();

module.exports = { pool, query, getClient };

/* ============================================================
   database/migrate.js — Full schema
   Run with: node database/migrate.js
   ============================================================ */

const SCHEMA = `

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- for fuzzy search

-- ── Users ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(255) UNIQUE,
  phone         VARCHAR(20)  UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  role          VARCHAR(20)  NOT NULL DEFAULT 'customer',  -- customer | admin | superadmin
  avatar_url    TEXT,
  is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
  is_blocked    BOOLEAN NOT NULL DEFAULT FALSE,
  tier          VARCHAR(20)  NOT NULL DEFAULT 'new',       -- new | regular | vip
  otp           VARCHAR(6),
  otp_expires   TIMESTAMPTZ,
  refresh_token TEXT,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);

-- ── Addresses ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS addresses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label       VARCHAR(50)  NOT NULL DEFAULT 'Home',
  full_name   VARCHAR(120) NOT NULL,
  phone       VARCHAR(20)  NOT NULL,
  address     TEXT         NOT NULL,
  district    VARCHAR(80)  NOT NULL,
  upazila     VARCHAR(80),
  postal_code VARCHAR(10),
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);

-- ── Brands ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brands (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) UNIQUE NOT NULL,
  slug        VARCHAR(120) UNIQUE NOT NULL,
  logo_url    TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Categories ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) UNIQUE NOT NULL,
  slug        VARCHAR(120) UNIQUE NOT NULL,
  icon        VARCHAR(20),
  parent_id   UUID REFERENCES categories(id),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Products ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             VARCHAR(255) NOT NULL,
  slug             VARCHAR(300) UNIQUE NOT NULL,
  sku              VARCHAR(100) UNIQUE NOT NULL,
  brand_id         UUID REFERENCES brands(id),
  category_id      UUID REFERENCES categories(id),
  short_description TEXT,
  description      TEXT,
  price            NUMERIC(12,2) NOT NULL,
  sale_price       NUMERIC(12,2),
  cost_price       NUMERIC(12,2),
  status           VARCHAR(20) NOT NULL DEFAULT 'draft',   -- draft | published | archived
  is_featured      BOOLEAN NOT NULL DEFAULT FALSE,
  images           JSONB    NOT NULL DEFAULT '[]',
  tags             TEXT[]   NOT NULL DEFAULT '{}',
  search_vector    TSVECTOR,
  view_count       INT NOT NULL DEFAULT 0,
  total_sales      INT NOT NULL DEFAULT 0,
  avg_rating       NUMERIC(3,2) NOT NULL DEFAULT 0,
  review_count     INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_brand    ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status   ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_search   ON products USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_products_price    ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured) WHERE is_featured = TRUE;

-- Auto-update search vector
CREATE OR REPLACE FUNCTION products_search_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.short_description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_search_trigger ON products;
CREATE TRIGGER products_search_trigger
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION products_search_update();

-- ── Product Specs (key-value, flexible for any phone model) ──
CREATE TABLE IF NOT EXISTS product_specs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  group_name VARCHAR(80)  NOT NULL,  -- e.g. 'display', 'performance'
  spec_key   VARCHAR(100) NOT NULL,  -- e.g. 'screen_size', 'processor'
  spec_value TEXT         NOT NULL,  -- e.g. '6.9 inch', 'Snapdragon 8 Elite'
  sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_specs_product ON product_specs(product_id);

-- ── Product Variants (color + storage combos) ─────────────────
CREATE TABLE IF NOT EXISTS product_variants (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color          VARCHAR(80),
  color_hex      VARCHAR(10),
  storage        VARCHAR(30),
  ram            VARCHAR(20),
  extra_price    NUMERIC(10,2) NOT NULL DEFAULT 0,
  sku_suffix     VARCHAR(50),
  stock          INT NOT NULL DEFAULT 0,
  low_stock_at   INT NOT NULL DEFAULT 10,
  image_url      TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);

-- ── Inventory Log ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_logs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  change     INT  NOT NULL,           -- positive = restock, negative = sale/adjustment
  reason     VARCHAR(100) NOT NULL,   -- 'sale', 'restock', 'adjustment', 'return'
  order_id   UUID,
  note       TEXT,
  done_by    UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Orders ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number     VARCHAR(30) UNIQUE NOT NULL,
  user_id          UUID REFERENCES users(id),
  guest_name       VARCHAR(120),
  guest_phone      VARCHAR(20),
  guest_email      VARCHAR(255),
  status           VARCHAR(30) NOT NULL DEFAULT 'pending',
  -- pending | confirmed | processing | packed | shipped | delivered | cancelled | refunded
  subtotal         NUMERIC(12,2) NOT NULL,
  delivery_charge  NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
  vat_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount     NUMERIC(12,2) NOT NULL,
  shipping_address JSONB NOT NULL,
  delivery_method  VARCHAR(50),          -- same_day | standard | express | pickup
  courier_name     VARCHAR(50),          -- pathao | steadfast | redx
  tracking_id      VARCHAR(100),
  coupon_code      VARCHAR(50),
  payment_method   VARCHAR(30),          -- bkash | nagad | card | cod
  payment_status   VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | paid | failed | refunded
  payment_ref      VARCHAR(100),
  notes            TEXT,
  estimated_delivery DATE,
  delivered_at     TIMESTAMPTZ,
  cancelled_at     TIMESTAMPTZ,
  cancel_reason    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_user      ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status    ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment   ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_number    ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_created   ON orders(created_at DESC);

-- ── Order Items ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id),
  variant_id  UUID REFERENCES product_variants(id),
  name        VARCHAR(255) NOT NULL,
  image_url   TEXT,
  color       VARCHAR(80),
  storage     VARCHAR(30),
  quantity    INT          NOT NULL CHECK (quantity > 0),
  unit_price  NUMERIC(12,2) NOT NULL,
  total_price NUMERIC(12,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- ── Order Status History ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_status_history (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status     VARCHAR(30) NOT NULL,
  note       TEXT,
  done_by    UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_status_history_order ON order_status_history(order_id);

-- ── Reviews ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  order_id    UUID REFERENCES orders(id),
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title       VARCHAR(200),
  body        TEXT,
  images      JSONB NOT NULL DEFAULT '[]',
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  helpful     INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, user_id, order_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status  ON reviews(status);

-- ── Wishlist ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wishlists (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlists(user_id);

-- ── Coupons ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupons (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code             VARCHAR(50) UNIQUE NOT NULL,
  type             VARCHAR(20) NOT NULL,  -- percentage | flat | free_shipping
  value            NUMERIC(10,2) NOT NULL,
  min_order        NUMERIC(12,2) NOT NULL DEFAULT 0,
  max_discount     NUMERIC(10,2),
  usage_limit      INT,
  used_count       INT NOT NULL DEFAULT 0,
  per_user_limit   INT NOT NULL DEFAULT 1,
  starts_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);

-- ── Coupon Usage ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupon_usage (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_id  UUID NOT NULL REFERENCES coupons(id),
  user_id    UUID NOT NULL REFERENCES users(id),
  order_id   UUID REFERENCES orders(id),
  used_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (coupon_id, user_id, order_id)
);

-- ── Banners ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS banners (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title      VARCHAR(200),
  image_url  TEXT NOT NULL,
  link_url   TEXT,
  position   VARCHAR(30) NOT NULL DEFAULT 'hero',  -- hero | flash_sale | sidebar
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  starts_at  TIMESTAMPTZ,
  ends_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Payments ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES orders(id),
  method          VARCHAR(30) NOT NULL,   -- bkash | nagad | sslcommerz | cod
  amount          NUMERIC(12,2) NOT NULL,
  currency        VARCHAR(5) NOT NULL DEFAULT 'BDT',
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  transaction_id  VARCHAR(200) UNIQUE,
  gateway_ref     VARCHAR(200),
  gateway_payload JSONB,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_order  ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_txn    ON payments(transaction_id);

-- ── Notifications ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50) NOT NULL,   -- order_placed | order_shipped | review_reply ...
  title      VARCHAR(200) NOT NULL,
  message    TEXT NOT NULL,
  link       TEXT,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, is_read);

-- ── Updated_at trigger for all relevant tables ────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DO $$ DECLARE t TEXT;
BEGIN FOR t IN SELECT unnest(ARRAY['users','products','orders']) LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', t);
  EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t);
END LOOP; END; $$;

`;

module.exports = { SCHEMA };

// Run directly: node database/migrate.js
if (require.main === module) {
  const { query } = require('./db');
  query(SCHEMA)
    .then(() => { console.log('✅  Migration complete'); process.exit(0); })
    .catch(err => { console.error('❌  Migration failed:', err); process.exit(1); });
}
