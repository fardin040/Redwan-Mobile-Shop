# 🌊 Redwan Mobile Shop — DigitalOcean Deployment Guide

## 📋 What You'll Need
- ✅ GitHub account (repo pushed)
- ✅ DigitalOcean account → [digitalocean.com](https://digitalocean.com) *(New accounts get $200 free credit for 60 days)*
- ✅ Your API keys ready (bKash, Nagad, Cloudinary, Twilio, Gmail)

---

## 💰 Cost Overview

| Service | Plan | Cost |
|---|---|---|
| App (Node.js) | Basic XXS (512MB RAM) | $5/mo |
| PostgreSQL | Starter (1GB RAM) | $15/mo |
| Redis | Starter (1GB RAM) | $15/mo |
| **Total** | | **~$35/mo** |

> 💡 New DigitalOcean accounts get **$200 free credit** — covers ~5–6 months free!

---

## 🚀 Step-by-Step Deployment

### Step 1: Push Code to GitHub

Make sure your latest code is on GitHub:
```bash
git add .
git commit -m "Add DigitalOcean deployment config"
git push origin main
```

---

### Step 2: Create DigitalOcean Account

1. Go to [digitalocean.com](https://digitalocean.com)
2. Sign up (use GitHub login for easy repo access)
3. You'll receive **$200 free credit** for 60 days

---

### Step 3: Create a New App

1. Go to **App Platform** → click **"Create App"**
2. Select **GitHub** as source
3. Authorize DigitalOcean to access your GitHub
4. Select repo: `fardin040/Redwan-Mobile-Shop`
5. Branch: `main`
6. ✅ Check **"Auto-deploy on push"**
7. Click **"Next"**

---

### Step 4: Configure the App

DigitalOcean will auto-detect Node.js. Verify settings:

- **Source Directory**: `/backend`
- **Build Command**: `npm install --legacy-peer-deps`
- **Run Command**: `node server.js`
- **HTTP Port**: `5000`
- **Instance Size**: Basic XXS ($5/mo)

> ⚠️ If not auto-detected, set these manually.

---

### Step 5: Add PostgreSQL Database

1. In app setup, click **"Add Resource"** → **"Database"**
2. Select **PostgreSQL**
3. Version: **15**
4. Plan: **Starter** ($15/mo)
5. Name: `redwan-db`
6. Click **"Add"**

This automatically injects these variables into your app:
- `${redwan-db.HOSTNAME}`, `${redwan-db.PORT}`, `${redwan-db.DATABASE}`
- `${redwan-db.USERNAME}`, `${redwan-db.PASSWORD}`, `${redwan-db.DATABASE_URL}`

---

### Step 6: Add Redis Cache

1. Click **"Add Resource"** → **"Database"**
2. Select **Redis**
3. Version: **7**
4. Plan: **Starter** ($15/mo)
5. Name: `redwan-cache`
6. Click **"Add"**

This automatically injects:
- `${redwan-cache.REDIS_URL}`, `${redwan-cache.HOSTNAME}`, `${redwan-cache.PORT}`, `${redwan-cache.PASSWORD}`

---

### Step 7: Set Environment Variables

In **App Settings → Environment Variables**, add these:

#### 🔐 Generate JWT Secrets First
Run this in your terminal:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Run it twice — one for `JWT_SECRET`, one for `JWT_REFRESH_SECRET`.

#### Required Variables to Set Manually:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `5000` |
| `JWT_SECRET` | *(generated above)* |
| `JWT_EXPIRES_IN` | `7d` |
| `JWT_REFRESH_SECRET` | *(generated above)* |
| `JWT_REFRESH_EXPIRES_IN` | `30d` |
| `DB_SSL` | `true` |
| `FRONTEND_URL` | *(set after deploy — your .ondigitalocean.app URL)* |
| `ALLOWED_ORIGINS` | *(same as FRONTEND_URL)* |

#### Payment Gateways:
| Variable | Value |
|---|---|
| `BKASH_APP_KEY` | Your bKash production key |
| `BKASH_APP_SECRET` | Your bKash secret |
| `BKASH_USERNAME` | Your bKash username |
| `BKASH_PASSWORD` | Your bKash password |
| `BKASH_BASE_URL` | `https://tokenized.pay.bka.sh/v1.2.0-beta` |
| `NAGAD_MERCHANT_ID` | Your Nagad merchant ID |
| `NAGAD_MERCHANT_PRIVATE_KEY` | Your Nagad private key |
| `NAGAD_PUBLIC_KEY` | Your Nagad public key |
| `NAGAD_BASE_URL` | `https://api.mynagad.com` |

#### Other Services:
| Variable | Value |
|---|---|
| `TWILIO_ACCOUNT_SID` | Your Twilio SID |
| `TWILIO_AUTH_TOKEN` | Your Twilio token |
| `TWILIO_PHONE_NUMBER` | Your Twilio number |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Your Gmail address |
| `SMTP_PASS` | Your Gmail App Password |
| `SENDER_EMAIL` | `noreply@redwanmobile.com` |
| `CLOUDINARY_NAME` | Your Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Your Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Your Cloudinary API secret |
| `PATHAO_API_KEY` | Your Pathao API key |
| `STEADFAST_API_KEY` | Your Steadfast API key |

> 💡 **Gmail App Password**: Go to Google Account → Security → 2-Step Verification → App Passwords → Generate one for "Mail"

---

### Step 8: Deploy

1. Click **"Create Resources"** (or **"Deploy"**)
2. Wait 3–5 minutes for first deploy
3. Watch the **Build Logs** for any errors

---

### Step 9: Verify Deployment

Once deployed, DigitalOcean gives you a URL like:
```
https://redwan-mobile-shop-xxxxx.ondigitalocean.app
```

**Test the API:**
```bash
curl https://redwan-mobile-shop-xxxxx.ondigitalocean.app/api/health
# Expected: {"status":"ok","timestamp":"...","version":"1.0.0"}
```

**Test the frontend:**
- Visit your app URL → should see the homepage

---

### Step 10: Update CORS Settings

After you get your app URL:
1. Go to **App Settings → Environment Variables**
2. Update `FRONTEND_URL` → your actual URL
3. Update `ALLOWED_ORIGINS` → your actual URL
4. Click **"Save"** → app will auto-redeploy

---

## 🌐 Custom Domain (Optional)

1. Go to **App Settings → Domains**
2. Click **"Add Domain"**
3. Enter: `redwanmobile.com` (or your domain)
4. DigitalOcean shows DNS records to add
5. Go to your domain registrar → add the records
6. Wait 10–30 minutes for DNS propagation
7. Free SSL certificate is auto-generated ✅

---

## 🔍 Monitoring & Logs

In your DigitalOcean App dashboard:
- **Runtime Logs**: Real-time app logs
- **Build Logs**: See deploy history
- **Insights**: CPU, memory, request metrics
- **Alerts**: Set up email alerts for downtime

---

## 🆘 Troubleshooting

### ❌ Build Failed
- Check **Build Logs** for error details
- Ensure `backend/package.json` exists
- Run locally first: `cd backend && npm install && node server.js`

### ❌ Database Connection Error
- Verify `DB_SSL=true` is set
- Check all `DB_*` variables are using `${redwan-db.*}` references
- Check PostgreSQL service is running in dashboard

### ❌ Redis Connection Error
- Check `REDIS_URL` uses `${redwan-cache.REDIS_URL}`
- App works without Redis but cart/session features degrade

### ❌ Frontend Not Loading
- The backend serves frontend from `/frontend` folder
- Ensure `server.js` has: `app.use(express.static(path.join(__dirname, '../frontend')))`

### ❌ 502 Bad Gateway
- App is still starting (wait 1–2 min)
- Check if `PORT=5000` matches server.js
- Check Runtime Logs for crash details

---

## 📞 Support
- **DigitalOcean Docs**: https://docs.digitalocean.com/products/app-platform/
- **DigitalOcean Community**: https://www.digitalocean.com/community
- **Support Ticket**: Available in dashboard

---

**🎉 Your Redwan Mobile Shop is now live on DigitalOcean!**
