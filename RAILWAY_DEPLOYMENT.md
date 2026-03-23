# Redwan Mobile Shop — Railway Deployment Guide

## 📋 Prerequisites

1. ✅ GitHub account (connected to Railway)
2. ✅ Railway account (railway.app) — **Free tier available**
3. ✅ Node.js project ready (this repo)

---

## 🚀 Step-by-Step Deployment

### **Step 1: Create Railway Project from GitHub**

1. Go to [railway.app](https://railway.app/)
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Connect your GitHub account if not already connected
4. Select your repository: **fardin040/Redwan-Mobile-Shop**
5. Authorize Railway to access your repo
6. Click **"Deploy Now"**

---

### **Step 2: Configure Node.js Service**

Railway should auto-detect Node.js. If not:

1. In Railway dashboard, click **"Add"** → **"Database"** → **"PostgreSQL"**
2. Click **"Add"** → **"Database"** → **"Redis"**
3. Click **"Add Service"** → **"GitHub Repo"** (select same repo)

---

### **Step 3: Add PostgreSQL Database**

1. In Railway Dashboard, go to your project
2. Click **"+ Create"** → **"Database"** → **"PostgreSQL"**
3. Name it: `redwan_shop_db`
4. Click **"Create**

Railway automatically provides:
- `DATABASE_URL` environment variable
- Connection details

---

### **Step 4: Add Redis Cache**

1. Click **"+ Create"** → **"Database"** → **"Redis"**  
2. Name it: `redwan_cache`
3. Click **"Create"**

Railway automatically provides:
- `REDIS_URL` environment variable

---

### **Step 5: Configure Environment Variables**

In Railway Dashboard for your **Node.js service**:

Click **"Variables"** tab and set:

```
NODE_ENV=production
PORT=3000
APP_NAME=Redwan Mobile Shop
FRONTEND_URL=https://<YOUR_RAILWAY_DOMAIN>

# PostgreSQL (Railway auto-provides DATABASE_URL, but set these too)
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_NAME=${{Postgres.PGDATABASE}}
DB_USER=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_SSL=true

# Redis (Railway auto-provides REDIS_URL)
REDIS_URL=${{Redis.REDIS_URL}}
REDIS_HOST=${{Redis.REDIS_HOST}}
REDIS_PORT=${{Redis.REDIS_PORT}}
REDIS_PASSWORD=${{Redis.REDIS_PASSWORD}}

# JWT (Generate strong production keys)
JWT_SECRET=your_long_random_secret_key_minimum_64_chars_generate_new_one
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your_long_random_refresh_key_minimum_64_chars_generate_new_one
JWT_REFRESH_EXPIRES_IN=30d

# Payment Gateways (set to production keys when ready)
BKASH_APP_KEY=production_key
BKASH_APP_SECRET=production_secret
BKASH_USERNAME=production_user
BKASH_PASSWORD=production_pass
BKASH_BASE_URL=https://tokenized.pay.bka.sh/v1.2.0-beta

NAGAD_MERCHANT_ID=production_merchant_id
NAGAD_MERCHANT_PRIVATE_KEY=production_key
NAGAD_PUBLIC_KEY=production_public_key
NAGAD_BASE_URL=https://api.mynagad.com

# Twilio SMS (optional)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SENDER_EMAIL=noreply@redwanmobile.com

# Cloudinary Image Upload
CLOUDINARY_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Courier APIs
PATHAO_API_KEY=your_pathao_key
PATHAO_CLIENT_ID=your_client_id
PATHAO_CLIENT_SECRET=your_client_secret
STEADFAST_API_KEY=your_steadfast_key

# ALLOWED ORIGINS (CORS)
ALLOWED_ORIGINS=https://<YOUR_RAILWAY_DOMAIN>
```

**To get Railway-assigned variables:**
1. Deploy first (Railway will auto-assign subdomain)
2. Click on PostgreSQL plugin → view **"Variables"** tab
3. Copy the variables into your Node.js service config

---

### **Step 6: Deploy & Run Database Migration**

1. Railway should auto-deploy when you pushed code
2. Check **Deploy Logs** to ensure no errors
3. Once deployed, click **"Connect"** → copy your Railway URL

**Run database migration:**
```bash
# If you need to run manually:
cd backend
node database/schema.js
```

The database schema will:
- Create all tables (users, products, orders, etc.)
- Set up indexes for search
- Configure relationships and constraints

---

### **Step 7: Verify Deployment**

```bash
# Test API health check
curl https://<YOUR_RAILWAY_DOMAIN>/api/health

# Expected response:
# {"status":"ok","timestamp":"2026-03-23T...","version":"1.0.0"}
```

**Test Frontend:**
- Visit: `https://<YOUR_RAILWAY_DOMAIN>`
- Should see Redwan Mobile Shop homepage

---

## 📲 Your Public URL

After deployment, Railway assigns a URL like:

```
https://redwan-mobile-shop-production.railway.app
```

Or connect a custom domain:
1. Click **"Settings"** on your project
2. Add custom domain: `redwan.yourdomain.com`
3. Update DNS records (Railway provides instructions)

---

## 🔍 Monitoring & Logs

In Railway Dashboard:

- **Logs**: View real-time logs
- **Metrics**: Monitor CPU, memory, requests
- **Deployments**: See deployment history

---

## 🆘 Troubleshooting

### **Database Connection Failed**
- Check `DATABASE_URL` is set
- Verify PostgreSQL service is running
- Rails usually triggers auto-migration on deploy

### **Frontend Not Serving**
- Check `FRONTEND_URL` environment variable
- Verify `/frontend` folder exists in repo
- Check server.js has `app.use(express.static(path.join(__dirname, '../frontend')))`

### **Redis Connection Failed**
- Check `REDIS_URL` is set correctly
- If using Railway plugin, URL is auto-provided
- Can temporarily run without Redis (will degrade cache)

### **Environment Variables Not Loaded**
- Click **"Variables"** tab
- Redeploy service: Click menu → **"Redeploy"**
- Wait for new deployment

---

## 💡 Tips

1. **Generate Strong JWT Secrets:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Keep Sensitive Data Secure:**
   - Never commit `.env` to git ✅ (already in .gitignore)
   - Use Railway Variables for secrets
   - Rotate API keys regularly

3. **Scale as You Grow:**
   - Railway free tier: Reasonable limits
   - Paid tier: Higher quotas, better performance
   - PostgreSQL: Auto-backups, point-in-time recovery

4. **Custom Domain:**
   - Point DNS A/CNAME to Railway's domain
   - Free SSL certificate auto-generated
   - Update `FRONTEND_URL` in variables

---

## 📞 Support

- **Railway Docs**: https://docs.railway.app
- **Project Issues**: https://github.com/fardin040/Redwan-Mobile-Shop/issues

---

**Deployment Complete! 🎉**
Your e-commerce store is now live on Railway.
