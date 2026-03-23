# Redwan Mobile Shop — Backend Setup & Deployment Guide

## Project Structure

```
backend/
├── server.js                    # Express app entry point
├── package.json
├── .env.example                 # Copy to .env and fill values
├── database/
│   ├── db.js                    # PostgreSQL pool connection
│   ├── schema.js                # Full DB schema + migrate script
│   └── seed.js                  # Sample data for development
├── middleware/
│   └── auth.js                  # JWT authentication middleware
├── routes/
│   ├── auth.js                  # Register, login, OTP, refresh
│   ├── products.js              # Products CRUD + search
│   ├── orders.js                # Place + manage orders
│   ├── reviews.js               # Product reviews
│   ├── wishlist.js              # Wishlist management
│   ├── promotions.js            # Coupons + banners
│   └── upload.js                # Cloudinary image upload
└── services/
    ├── payment.js               # bKash + Nagad + SSLCommerz
    ├── notifications.js         # SMS (Twilio) + Email (Nodemailer)
    ├── shipping.js              # Pathao + Steadfast courier APIs
    └── redis.js                 # Redis/ioredis client
```

---

## Step 1 — Install & Setup Locally

```bash
# Clone / copy the backend folder
cd backend

# Install all dependencies
npm install

# Copy env template
cp .env.example .env

# Edit .env with your values (see below)
nano .env
```

---

## Step 2 — Setup PostgreSQL

### Option A: Local (development)
```bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib    # Ubuntu/Debian
brew install postgresql                           # macOS

# Create database
psql -U postgres
CREATE DATABASE redwan_shop;
\q

# Set DB_HOST=localhost, DB_NAME=redwan_shop in .env
```

### Option B: Neon (free cloud PostgreSQL — recommended)
1. Go to https://neon.tech → create free account
2. Create project → copy DATABASE_URL
3. Paste in .env as: `DATABASE_URL=postgresql://user:pass@host/redwan_shop`

### Option C: Supabase
1. Go to https://supabase.com → new project
2. Settings → Database → copy connection string
3. Paste in .env as DATABASE_URL

### Run migration (creates all tables):
```bash
node database/schema.js
# ✅ Migration complete

# Optionally seed sample data
node database/seed.js
# ✅ Seed complete
# Default admin: +8801700000000 / admin123
```

---

## Step 3 — Setup Redis

### Option A: Local
```bash
sudo apt install redis-server    # Ubuntu
brew install redis               # macOS
redis-server
```

### Option B: Upstash (free cloud Redis — recommended)
1. Go to https://upstash.com → create free Redis database
2. Copy REDIS_URL from dashboard
3. Set in .env: `REDIS_URL=rediss://default:password@host:6379`

---

## Step 4 — Setup External Services

### bKash Sandbox (for testing)
1. Register at https://developer.bka.sh
2. Get sandbox credentials
3. Fill BKASH_* variables in .env
4. Test with sandbox bKash app

### Nagad Sandbox
1. Register at https://nagad.com.bd/developer
2. Get test merchant credentials
3. Fill NAGAD_* variables in .env

### SSLCommerz Sandbox (Visa/MasterCard)
1. Register at https://developer.sslcommerz.com
2. Get SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASS
3. Set SSLCOMMERZ_IS_LIVE=false for testing

### Cloudinary (Image uploads)
1. Register at https://cloudinary.com (free tier: 25GB)
2. Dashboard → copy Cloud Name, API Key, API Secret
3. Fill CLOUDINARY_* variables in .env

### Twilio SMS
1. Register at https://twilio.com (free trial: $15 credit)
2. Get Account SID, Auth Token, Phone Number
3. Fill TWILIO_* variables in .env

### Email (Gmail)
1. Enable 2FA on your Gmail account
2. Go to: Google Account → Security → App Passwords
3. Generate app password → paste as EMAIL_PASSWORD in .env

### Pathao Courier API
1. Register merchant at https://merchant.pathao.com
2. Get Client ID and Client Secret from API settings
3. Fill PATHAO_* variables in .env

### Steadfast Courier
1. Register at https://steadfast.com.bd
2. API Settings → copy API Key and Secret Key
3. Fill STEADFAST_* variables in .env

---

## Step 5 — Run Locally

```bash
# Development (auto-restart on changes)
npm run dev

# Production
npm start

# API available at:
http://localhost:5000/api/health
```

---

## Step 6 — Deploy to Production

### Deploy Backend to Railway (recommended — free tier available)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project
railway init

# Add environment variables in Railway dashboard
# (copy from .env.example, fill in production values)

# Deploy
railway up

# Your API URL: https://yourapp.railway.app
```

### Deploy Backend to Render
1. Push code to GitHub
2. Go to https://render.com → New Web Service
3. Connect GitHub repo
4. Build Command: `npm install`
5. Start Command: `node server.js`
6. Add all environment variables
7. Deploy → get URL like: `https://redwan-api.onrender.com`

### Deploy Frontend to Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy HTML files
cd /path/to/frontend/files
vercel

# Or drag-and-drop in Vercel dashboard
# Get URL: https://redwanmobile.vercel.app
```

---

## Complete API Reference

### Authentication
| Method | Endpoint                    | Auth     | Description              |
|--------|-----------------------------|---------  |--------------------------|
| POST   | /api/auth/register          | Public   | Create account            |
| POST   | /api/auth/login             | Public   | Login with phone/password |
| POST   | /api/auth/send-otp          | Public   | Send OTP to phone         |
| POST   | /api/auth/verify-otp        | Public   | Verify OTP, get token     |
| POST   | /api/auth/refresh           | Public   | Refresh access token      |
| POST   | /api/auth/logout            | Bearer   | Logout                    |
| GET    | /api/auth/me                | Bearer   | Get current user          |
| PUT    | /api/auth/profile           | Bearer   | Update profile            |
| PUT    | /api/auth/change-password   | Bearer   | Change password           |

### Products
| Method | Endpoint                    | Auth     | Description              |
|--------|-----------------------------|---------  |--------------------------|
| GET    | /api/products               | Public   | List products (paginated) |
| GET    | /api/products/:slug         | Public   | Get single product + specs|
| POST   | /api/products               | Admin    | Create product            |
| PUT    | /api/products/:id           | Admin    | Update product            |
| DELETE | /api/products/:id           | Admin    | Archive product           |

### Search
| Method | Endpoint                    | Auth     | Description              |
|--------|-----------------------------|---------  |--------------------------|
| GET    | /api/search?q=samsung       | Public   | Full-text product search  |
| GET    | /api/search/suggest?q=sam   | Public   | Autocomplete suggestions  |

### Orders
| Method | Endpoint                    | Auth     | Description              |
|--------|-----------------------------|---------  |--------------------------|
| POST   | /api/orders                 | Optional | Place order               |
| GET    | /api/orders                 | Bearer   | Customer's order history  |
| GET    | /api/orders/:id             | Bearer   | Single order details      |
| PUT    | /api/orders/:id/status      | Admin    | Update order status       |
| POST   | /api/orders/:id/cancel      | Bearer   | Cancel order              |

### Cart (Redis-backed)
| Method | Endpoint                    | Auth     | Description              |
|--------|-----------------------------|---------  |--------------------------|
| GET    | /api/cart                   | Optional | Get cart items            |
| POST   | /api/cart/add               | Optional | Add item to cart          |
| PUT    | /api/cart/update            | Optional | Update item quantity      |
| DELETE | /api/cart/clear             | Optional | Clear cart                |

### Payments
| Method | Endpoint                           | Auth  | Description         |
|--------|------------------------------------|-------|---------------------|
| POST   | /api/payments/bkash/create         | Bearer | Init bKash payment  |
| POST   | /api/payments/bkash/execute        | Bearer | Execute bKash       |
| POST   | /api/payments/nagad/create         | Bearer | Init Nagad payment  |
| POST   | /api/payments/sslcommerz/initiate  | Bearer | Init card payment   |
| POST   | /api/payments/sslcommerz/ipn       | Public | SSLCommerz webhook  |
| POST   | /api/payments/cod/confirm          | Bearer | Confirm COD order   |
| POST   | /api/payments/refund               | Admin  | Issue refund        |

### Wishlist
| Method | Endpoint                    | Auth   | Description              |
|--------|-----------------------------|--------|--------------------------|
| GET    | /api/wishlist               | Bearer | Get wishlist items        |
| POST   | /api/wishlist/:productId    | Bearer | Add to wishlist           |
| DELETE | /api/wishlist/:productId    | Bearer | Remove from wishlist      |

### Reviews
| Method | Endpoint                      | Auth   | Description              |
|--------|-------------------------------|--------|--------------------------|
| GET    | /api/reviews/product/:id      | Public | Get product reviews       |
| POST   | /api/reviews                  | Bearer | Submit review             |
| POST   | /api/reviews/:id/helpful      | Bearer | Mark review helpful       |

### Promotions
| Method | Endpoint                      | Auth   | Description              |
|--------|-------------------------------|--------|--------------------------|
| POST   | /api/promotions/coupons/validate | Public | Validate coupon code  |
| GET    | /api/promotions/coupons       | Admin  | List all coupons          |
| POST   | /api/promotions/coupons       | Admin  | Create coupon             |
| GET    | /api/promotions/banners       | Public | Active banners            |

### Shipping
| Method | Endpoint                      | Auth  | Description               |
|--------|-------------------------------|-------|---------------------------|
| POST   | /api/shipping/pathao/create   | Admin | Create Pathao shipment    |
| GET    | /api/shipping/pathao/track/:id | Public | Track Pathao shipment   |
| POST   | /api/shipping/steadfast/create | Admin | Create Steadfast shipment |
| GET    | /api/shipping/steadfast/track/:code | Public | Track Steadfast    |

### Admin
| Method | Endpoint                       | Auth  | Description             |
|--------|--------------------------------|-------|-------------------------|
| GET    | /api/admin/stats               | Admin | Dashboard KPIs          |
| GET    | /api/admin/top-products        | Admin | Top selling products    |
| GET    | /api/admin/sales-chart         | Admin | Revenue chart data      |
| GET    | /api/admin/orders              | Admin | All orders (filterable) |
| GET    | /api/admin/customers           | Admin | All customers           |
| PUT    | /api/admin/customers/:id/block | Admin | Block/unblock customer  |
| PUT    | /api/admin/customers/:id/tier  | Admin | Update customer tier    |
| GET    | /api/admin/inventory/alerts    | Admin | Low stock alerts        |
| PUT    | /api/admin/inventory/:id/restock | Admin | Restock variant       |
| GET    | /api/admin/reviews/pending     | Admin | Reviews awaiting moderation |
| PUT    | /api/admin/reviews/:id/moderate | Admin | Approve/reject review  |

---

## Frontend Integration

Connect your HTML pages to the API by updating the base URL:

```javascript
// In each HTML file, add this config at the top of your <script>
const API_BASE = 'https://your-api.railway.app/api';  // replace with your deployed URL

// Example: Login
const response = await fetch(`${API_BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: phone, password })
});
const data = await response.json();
localStorage.setItem('token', data.data.accessToken);

// Example: Fetch products
const products = await fetch(`${API_BASE}/products?brand=samsung&limit=12`);
const { data } = await products.json();

// Example: Place order (authenticated)
const token = localStorage.getItem('token');
const order = await fetch(`${API_BASE}/orders`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ items, shipping_address, payment_method: 'bkash' })
});
```

---

## Security Checklist Before Going Live

- [ ] Change all default passwords in .env
- [ ] Set NODE_ENV=production
- [ ] Set SSLCOMMERZ_IS_LIVE=true
- [ ] Switch bKash/Nagad to production URLs
- [ ] Enable HTTPS (SSL certificate)
- [ ] Set strong JWT_SECRET (min 64 chars)
- [ ] Configure ALLOWED_ORIGINS to your domain only
- [ ] Enable DB_SSL=true for production database
- [ ] Set up automatic database backups
- [ ] Configure proper CORS headers
- [ ] Enable rate limiting (already configured)
- [ ] Set up error monitoring (Sentry)
- [ ] Test all payment flows in sandbox first
