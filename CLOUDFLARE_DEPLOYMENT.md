# ☁️ Cloudflare Deployment Guide — Redwan Mobile Shop

## Architecture
```
Visitor → Cloudflare Edge
  ├── Pages  → frontend/ (HTML, CSS, JS)
  └── Worker → worker/   (API: /api/*)
```

## Prerequisites
- Cloudflare account → [cloudflare.com](https://cloudflare.com) (free)
- Node.js 18+ installed
- Neon account (PostgreSQL) → [neon.tech](https://neon.tech) (free)

---

## Step 1: Set Up Neon PostgreSQL (Free)

1. Go to [neon.tech](https://neon.tech) → Create account
2. New Project → Name: `redwan-mobile-shop`
3. Region: **Singapore** (closest to Bangladesh)
4. Copy the **Connection String** → looks like:
   ```
   postgresql://user:password@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
5. Run the database schema:
   ```bash
   # Install postgres client
   npm install -g pg
   # Run schema
   node backend/database/schema.js
   ```
   Or paste the schema into Neon's SQL editor.

---

## Step 2: Install Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

---

## Step 3: Create KV Namespaces

```bash
cd worker
npm install

# Create KV namespaces
wrangler kv:namespace create "CART_KV"
wrangler kv:namespace create "SESSION_KV"
wrangler kv:namespace create "CACHE_KV"

# Also create preview namespaces (for local dev)
wrangler kv:namespace create "CART_KV" --preview
wrangler kv:namespace create "SESSION_KV" --preview
wrangler kv:namespace create "CACHE_KV" --preview
```

Copy the IDs printed and update `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "CART_KV"
id = "PASTE_ID_HERE"
preview_id = "PASTE_PREVIEW_ID_HERE"
```

---

## Step 4: Set Worker Secrets

```bash
cd worker

# Database
wrangler secret put DATABASE_URL
# Paste your Neon connection string

# JWT
wrangler secret put JWT_SECRET
# Paste: (run: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")

wrangler secret put JWT_REFRESH_SECRET
# Paste another random 64-char string

wrangler secret put JWT_EXPIRES_IN
# Type: 7d

wrangler secret put JWT_REFRESH_EXPIRES_IN
# Type: 30d

# Cloudinary
wrangler secret put CLOUDINARY_NAME
wrangler secret put CLOUDINARY_API_KEY
wrangler secret put CLOUDINARY_API_SECRET

# Twilio SMS
wrangler secret put TWILIO_ACCOUNT_SID
wrangler secret put TWILIO_AUTH_TOKEN
wrangler secret put TWILIO_PHONE_NUMBER

# Email
wrangler secret put SENDER_EMAIL
wrangler secret put SMTP_USER
wrangler secret put SMTP_PASS

# bKash
wrangler secret put BKASH_APP_KEY
wrangler secret put BKASH_APP_SECRET
wrangler secret put BKASH_USERNAME
wrangler secret put BKASH_PASSWORD

# Nagad
wrangler secret put NAGAD_MERCHANT_ID
wrangler secret put NAGAD_MERCHANT_PRIVATE_KEY
wrangler secret put NAGAD_PUBLIC_KEY

# Courier
wrangler secret put PATHAO_API_KEY
wrangler secret put PATHAO_CLIENT_ID
wrangler secret put PATHAO_CLIENT_SECRET
wrangler secret put STEADFAST_API_KEY

# CORS (set after Pages deploy)
wrangler secret put ALLOWED_ORIGINS
# Type: https://your-project.pages.dev,https://yourdomain.com

wrangler secret put FRONTEND_URL
# Type: https://your-project.pages.dev
```

---

## Step 5: Deploy the Worker

```bash
cd worker
wrangler deploy
```

You'll get a URL like: `https://redwan-mobile-shop-api.YOUR_SUBDOMAIN.workers.dev`

**Test it:**
```bash
curl https://redwan-mobile-shop-api.YOUR_SUBDOMAIN.workers.dev/api/health
# {"status":"ok","runtime":"Cloudflare Workers",...}
```

---

## Step 6: Deploy Frontend to Cloudflare Pages

### Option A: Via Dashboard (Easy)
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. **Pages** → **Create a project** → **Connect to Git**
3. Select your GitHub repo: `fardin040/Redwan-Mobile-Shop`
4. Build settings:
   - **Framework**: None
   - **Build command**: *(leave empty)*
   - **Build output directory**: `frontend`
5. Click **Save and Deploy**

### Option B: Via CLI
```bash
wrangler pages deploy frontend --project-name=redwan-mobile-shop
```

You'll get a URL like: `https://redwan-mobile-shop.pages.dev`

---

## Step 7: Update Frontend API URL

In your HTML files, make sure the API calls point to your Worker URL.
Search for `API_BASE` or `fetch('/api/` in the frontend files and update:

```javascript
// Change from:
const API_BASE = 'http://localhost:5000/api';
// To:
const API_BASE = 'https://redwan-mobile-shop-api.YOUR_SUBDOMAIN.workers.dev/api';
```

Or use a relative URL by setting up a Pages proxy rule.

---

## Step 8: Connect Custom Domain (Optional)

### For Pages (Frontend):
1. Pages → your project → **Custom domains**
2. Add: `redwanmobile.com`
3. Update DNS: add CNAME pointing to `redwan-mobile-shop.pages.dev`

### For Worker (API):
1. Workers → your worker → **Triggers** → **Custom Domains**
2. Add: `api.redwanmobile.com`
3. Update DNS: add CNAME pointing to `redwan-mobile-shop-api.YOUR_SUBDOMAIN.workers.dev`

Then update `ALLOWED_ORIGINS` and `FRONTEND_URL` secrets to use custom domains.

---

## Local Development

```bash
cd worker
npm run dev
# Worker runs on http://localhost:8787
# Test: curl http://localhost:8787/api/health
```

---

## Cost: 100% Free

| Service | Free Tier |
|---|---|
| Cloudflare Workers | 100,000 req/day |
| Cloudflare Pages | Unlimited requests |
| Cloudflare KV | 100,000 reads/day |
| Neon PostgreSQL | 0.5GB + 190 compute hours/month |
| Cloudinary | 25GB storage + 25GB bandwidth |

**Total: ৳0/month to start!** 🎉

---

## Troubleshooting

### Worker error: `could not connect to database`
- Check `DATABASE_URL` secret is set correctly
- Neon uses SSL — make sure connection string has `?sslmode=require`

### CORS errors in browser
- Update `ALLOWED_ORIGINS` secret to include your Pages URL
- Run: `wrangler secret put ALLOWED_ORIGINS`

### `bcryptjs` not working
- Make sure `compatibility_flags = ["nodejs_compat"]` is in `wrangler.toml`

### KV not found / binding error
- Run `wrangler kv:namespace create "CART_KV"` and update IDs in `wrangler.toml`
- Redeploy after updating `wrangler.toml`
