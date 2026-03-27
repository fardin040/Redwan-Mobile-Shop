# ☁️ 100% Cloudflare Deployment Guide — Redwan Mobile Shop

> **Full Stack on Cloudflare**: Workers (API) + D1 (Database) + KV (Cart/Cache) + Pages (Frontend)
> **Cost: ৳0/month on the free tier!**

---

## Architecture

```
Visitor → Cloudflare Edge
  ├── Cloudflare Pages  → frontend/ (HTML, CSS, JS)
  ├── Cloudflare Worker → worker/   (Express-like API)
  ├── Cloudflare D1     → SQLite DB (fully on Cloudflare)
  └── Cloudflare KV     → Cart & Cache (key-value store)
```

---

## Prerequisites

- **Cloudflare account**: [cloudflare.com](https://cloudflare.com) (free)
- **Node.js 18+** installed locally
- **Git** command line tool

---

## Step 1: Install Wrangler CLI

```powershell
npm install -g wrangler
wrangler login
# Browser will open — log in with your Cloudflare account
```

---

## Step 2: Create D1 Database

```powershell
cd C:\Users\Fardin\AntiGravity\Redwan-Mobile-Shop\worker

# Create the D1 database
wrangler d1 create redwan-mobile-shop-db
```

You'll see output like:
```
✅ Successfully created DB 'redwan-mobile-shop-db'
[[d1_databases]]
binding = "DB"
database_name = "redwan-mobile-shop-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**Copy the `database_id`** and update `wrangler.toml`:
```toml
[[d1_databases]]
binding  = "DB"
database_name = "redwan-mobile-shop-db"
database_id   = "PASTE_YOUR_ID_HERE"
```

---

## Step 3: Run Database Schema

```powershell
# Create all tables in production D1
npm run db:migrate

# Also run locally for development
npm run db:migrate:local
```

---

## Step 4: Create KV Namespaces

```powershell
# Create Cart KV
wrangler kv:namespace create "CART_KV"
wrangler kv:namespace create "CART_KV" --preview

# Create Cache KV
wrangler kv:namespace create "CACHE_KV"
wrangler kv:namespace create "CACHE_KV" --preview
```

Copy the IDs and update `wrangler.toml`:
```toml
[[kv_namespaces]]
binding    = "CART_KV"
id         = "PASTE_CART_KV_ID"
preview_id = "PASTE_CART_KV_PREVIEW_ID"

[[kv_namespaces]]
binding    = "CACHE_KV"
id         = "PASTE_CACHE_KV_ID"
preview_id = "PASTE_CACHE_KV_PREVIEW_ID"
```

---

## Step 5: Install Worker Dependencies

```powershell
cd C:\Users\Fardin\AntiGravity\Redwan-Mobile-Shop\worker
npm install
```

---

## Step 6: Set Worker Secrets

Run each command and paste the value when prompted:

```powershell
# ── JWT (generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
wrangler secret put JWT_SECRET
wrangler secret put JWT_REFRESH_SECRET

wrangler secret put JWT_EXPIRES_IN
# Type: 7d

wrangler secret put JWT_REFRESH_EXPIRES_IN
# Type: 30d

# ── Cloudinary (images)
wrangler secret put CLOUDINARY_NAME
wrangler secret put CLOUDINARY_API_KEY
wrangler secret put CLOUDINARY_API_SECRET

# ── Twilio (SMS)
wrangler secret put TWILIO_ACCOUNT_SID
wrangler secret put TWILIO_AUTH_TOKEN
wrangler secret put TWILIO_PHONE_NUMBER

# ── Email (MailChannels - uses your domain)
wrangler secret put SENDER_EMAIL
# Type: noreply@yourdomain.com

# ── bKash payment
wrangler secret put BKASH_APP_KEY
wrangler secret put BKASH_APP_SECRET
wrangler secret put BKASH_USERNAME
wrangler secret put BKASH_PASSWORD

# ── SSLCommerz payment
wrangler secret put SSLCOMMERZ_STORE_ID
wrangler secret put SSLCOMMERZ_STORE_PASS

# ── Courier APIs
wrangler secret put STEADFAST_API_KEY
wrangler secret put STEADFAST_SECRET_KEY

# ── CORS (set AFTER Pages deploy)
wrangler secret put ALLOWED_ORIGINS
# Type: https://your-project.pages.dev

wrangler secret put FRONTEND_URL
# Type: https://your-project.pages.dev
```

---

## Step 7: Deploy the Worker (API)

```powershell
cd C:\Users\Fardin\AntiGravity\Redwan-Mobile-Shop\worker
npm run deploy
```

Output: `https://redwan-mobile-shop-api.YOUR_ACCOUNT.workers.dev`

**Test it:**
```powershell
curl https://redwan-mobile-shop-api.YOUR_ACCOUNT.workers.dev/api/health
# {"status":"ok","runtime":"Cloudflare Workers"}
```

---

## Step 8: Deploy Frontend to Cloudflare Pages

### Via Dashboard (Recommended)
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. Select repo: `fardin040/Redwan-Mobile-Shop`
4. Build settings:
   - **Build command**: *(leave empty)*
   - **Build output directory**: `frontend`
5. Click **Save and Deploy**

### Via CLI
```powershell
cd C:\Users\Fardin\AntiGravity\Redwan-Mobile-Shop
wrangler pages deploy frontend --project-name=redwan-mobile-shop
```

Your site: `https://redwan-mobile-shop.pages.dev`

---

## Step 9: Update API URL in Frontend

Find where your frontend calls the API and update:
```javascript
// In your HTML/JS files:
const API_BASE = 'https://redwan-mobile-shop-api.YOUR_ACCOUNT.workers.dev/api';
```

Then redeploy Pages:
```powershell
wrangler pages deploy frontend --project-name=redwan-mobile-shop
```

---

## Step 10: Add Custom Domain (Optional)

### For Pages (Frontend → yourdomain.com):
1. Pages project → **Custom domains** → Add `redwanmobile.com`
2. In Cloudflare DNS: Add CNAME `redwanmobile.com` → `redwan-mobile-shop.pages.dev`

### For Worker (API → api.yourdomain.com):
1. Workers → your worker → **Settings** → **Triggers** → **Custom Domains**
2. Add: `api.redwanmobile.com`
3. DNS auto-configures since domain is on Cloudflare

---

## Local Development

```powershell
cd worker

# Run locally with local D1 + KV
npm run dev
# API available at http://localhost:8787

# Test
curl http://localhost:8787/api/health
```

---

## Free Tier Limits (More Than Enough to Start)

| Service | Free Tier |
|---|---|
| **Cloudflare Workers** | 100,000 req/day |
| **Cloudflare D1** | 5 million row reads/day, 100,000 writes/day, 5GB storage |
| **Cloudflare KV** | 100,000 reads/day, 1,000 writes/day |
| **Cloudflare Pages** | Unlimited requests, 500 builds/month |
| **Cloudinary** | 25GB storage + 25GB bandwidth |

**Total monthly cost: ৳0** 🎉

---

## Quick Command Reference

```powershell
# Deploy worker
cd worker && npm run deploy

# Deploy pages
wrangler pages deploy frontend --project-name=redwan-mobile-shop

# Run schema again (if needed)
cd worker && npm run db:migrate

# Open D1 database in browser
cd worker && npm run db:studio

# Check worker logs
cd worker && npm run tail

# Add/update a secret
wrangler secret put SECRET_NAME
```

---

## Troubleshooting

| Error | Solution |
|---|---|
| `D1_ERROR: no such table` | Run `npm run db:migrate` |
| `bcryptjs` not found | Add `compatibility_flags = ["nodejs_compat"]` to `wrangler.toml` |
| CORS error | Update `ALLOWED_ORIGINS` secret with your Pages URL |
| Cart not working | Check KV namespace IDs in `wrangler.toml` |
| Worker deploy fails | `npm install` inside the `worker/` folder first |
