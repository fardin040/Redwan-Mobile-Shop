# ⚡ Appwrite Cloud Deployment & Integration Guide — Redwan Mobile Shop

> **Full Stack with Appwrite Cloud**: Database + Authentication + Storage Buckets + Serverless Functions + Frontend Hosting (Cloudflare Pages / Vercel)

---

## 🏗️ Architecture Overview

```
User Browser
  ├── Static Hosting (Cloudflare Pages / Vercel) → frontend/ (HTML, CSS, JS)
  └── Appwrite Cloud (appwrite.io)
        ├── Auth            → Email/Password, Phone OTP & Sessions
        ├── Databases       → Collections: products, orders, variants, reviews...
        ├── Storage         → Buckets: product-images, banners, avatars
        └── Functions       → Serverless Node.js (bKash, Nagad, SSLCommerz, Steadfast)
```

---

## 🚀 Quick Setup Steps

### Step 1: Create an Appwrite Cloud Account
1. Go to [appwrite.io](https://appwrite.io) and register/login.
2. Click **Create Project** and name it: `Redwan Mobile Shop`.
3. Copy your **Project ID** from the Project Settings page.

---

### Step 2: Automated Database & Storage Initialization Script

We have provided an automated setup script in `appwrite/setup.mjs`.

1. Open your terminal in the project root:
```bash
cd appwrite
npm install node-appwrite dotenv
```

2. Set your environment variables (or create `appwrite/.env`):
```env
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=YOUR_PROJECT_ID
APPWRITE_API_KEY=YOUR_APPWRITE_SECRET_API_KEY
```
*(Generate an API Key in Appwrite Console → Overview → Integrations → API Keys with full Database and Storage scopes)*

3. Run the automated schema generator:
```bash
node setup.mjs
```

This script automatically creates:
- **Database**: `redwan_shop`
- **18 Collections**: `users`, `addresses`, `brands`, `categories`, `products`, `product_specs`, `product_variants`, `inventory_logs`, `orders`, `order_items`, `order_status_history`, `reviews`, `wishlist`, `coupons`, `coupon_usage`, `banners`, `payments`, `notifications`
- **Storage Buckets**: `product-images`, `banners`, `avatars` with public read permissions.

---

### Step 3: Frontend Client Integration

Include the Appwrite Web SDK in your HTML files (`frontend/index.html`, `frontend/checkout.html`, etc.):

```html
<script src="https://cdn.jsdelivr.net/npm/appwrite@14.0.1"></script>
<script src="js/appwrite-client.js"></script>
```

Update `frontend/js/appwrite-client.js` with your project credentials:
```javascript
const APPWRITE_CONFIG = {
    ENDPOINT: 'https://cloud.appwrite.io/v1',
    PROJECT_ID: 'YOUR_PROJECT_ID',
    DATABASE_ID: 'redwan_shop',
    BUCKETS: {
        PRODUCT_IMAGES: 'product-images',
        BANNERS: 'banners'
    }
};
```

---

### Step 4: Deploying Payment & Courier Functions (bKash / Nagad / SSLCommerz)

1. In the Appwrite Console, go to **Functions** → **Create Function**.
2. Name: `payment-handler`
3. Runtime: **Node.js 18.0+**
4. Set Environment Variables in Appwrite Console:
   - `BKASH_APP_KEY`
   - `BKASH_APP_SECRET`
   - `BKASH_USERNAME`
   - `BKASH_PASSWORD`
   - `SSLCOMMERZ_STORE_ID`
   - `SSLCOMMERZ_STORE_PASS`
5. Deploy code from `appwrite/functions/payment-gateway/`.

---

### Step 5: Deploy Frontend to Cloudflare Pages or Vercel

```bash
# Deploying frontend to Cloudflare Pages via Wrangler CLI
wrangler pages deploy frontend --project-name=redwan-mobile-shop
```
*(Or import your repository directly on Vercel / Netlify and set build output directory to `frontend`)*

---

## 🔐 Permissions & Security Rules

| Resource | Public Permission | Authenticated User | Admin / Creator |
| :--- | :--- | :--- | :--- |
| `products`, `categories`, `brands` | **Read** | **Read** | **Create, Update, Delete** |
| `orders` | None | **Create, Read (Own)** | **Read, Update, Delete (All)** |
| `reviews` | **Read (Approved)** | **Create (Own)** | **Update, Delete** |
| `product-images` (Bucket) | **Read** | **Read** | **Create, Delete** |

---

## ⚡ Free Tier Limits on Appwrite Cloud

- **Databases & Collections**: Unlimited
- **Storage**: 10 GB free bandwidth & storage
- **Bandwidth**: 100 GB/month
- **Executions (Functions)**: 750,000 requests/month

**Total Monthly Cost**: **৳0 / $0** 🎉
