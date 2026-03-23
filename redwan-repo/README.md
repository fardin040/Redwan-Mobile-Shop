# 📱 Redwan Mobile Shop

A full-stack e-commerce website for a mobile phone shop, built with HTML/CSS/JS (frontend) and Node.js + Express + PostgreSQL (backend).

## 🌐 Live Demo
> Deploy using the steps below and update this link.

---

## 📁 Project Structure

```
redwan-mobile-shop/
├── frontend/                        # All HTML pages (no build step needed)
│   ├── index.html                   # Homepage — hero, flash sale, products
│   ├── product-detail.html          # Product page — specs, gallery, reviews
│   ├── checkout.html                # Checkout + order tracking
│   ├── account.html                 # Login / Register / Profile
│   ├── my-orders.html               # Order history
│   ├── wishlist-search.html         # Wishlist + search results
│   ├── admin-dashboard.html         # Admin — KPIs, charts, orders
│   ├── admin-products.html          # Admin — product & inventory manager
│   └── admin-orders-customers.html  # Admin — orders & customers
│
└── backend/                         # Node.js REST API
    ├── server.js                    # Express entry point
    ├── package.json
    ├── .env.example                 # Copy → .env and fill in values
    ├── README.md                    # Full setup + deployment guide
    ├── database/
    │   └── schema.js                # PostgreSQL schema (15 tables) + migrate
    ├── middleware/
    │   └── auth.js                  # JWT auth middleware
    ├── routes/
    │   ├── auth.js                  # Register, login, OTP, refresh
    │   ├── products.js              # Products CRUD + full-text search
    │   ├── orders.js                # Place orders + cart (Redis)
    │   └── remaining.js             # Reviews, wishlist, coupons, upload
    └── services/
        ├── payment.js               # bKash + Nagad + SSLCommerz
        └── notifications.js         # SMS (Twilio) + Email + shipping APIs
```

---

## ✨ Features

### Customer Features
- 🏠 **Homepage** — Flash sale timer, product grid, brand filter, compare tool
- 📱 **Product Pages** — Full specs (40+ fields), image gallery, color/storage variants, live price update
- 🛒 **Shopping Cart** — Redis-backed persistent cart, coupon codes, EMI info
- 💳 **Checkout** — bKash / Nagad / Card / Cash on Delivery
- 🚚 **Order Tracking** — Live timeline with courier integration
- 👤 **Account** — OTP login, order history, wishlist, profile management
- 🔍 **Search** — Full-text PostgreSQL search with filters (brand, price, RAM, storage, network)

### Admin Features
- 📊 **Dashboard** — Revenue charts (Chart.js), KPIs, top products, low stock alerts
- 📦 **Product Manager** — Add/edit/delete with 40+ spec fields, bulk CSV import
- 📋 **Order Manager** — Status updates, invoice, refunds, courier dispatch
- 👥 **Customer Manager** — VIP tiers, block/unblock, order history per customer
- 🏷️ **Promotions** — Coupon codes (%, flat, free shipping), flash sale banners
- 📸 **Inventory** — Stock levels, low-stock alerts, restock with one click

### Backend
- 🔐 JWT auth with refresh tokens + OTP via SMS
- 💰 bKash, Nagad, SSLCommerz (Visa/MasterCard) payment gateways
- 🚚 Pathao + Steadfast courier API integration
- 📧 Email notifications (Nodemailer) + SMS (Twilio)
- 🖼️ Cloudinary image storage
- 🐘 PostgreSQL with full-text search (tsvector)
- ⚡ Redis cart + session caching
- 🛡️ Helmet, CORS, rate limiting, input validation

---

## 🚀 Quick Start

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/redwan-mobile-shop.git
cd redwan-mobile-shop
```

### 2. Open the frontend
Just open `frontend/index.html` in any browser — no build step needed.

### 3. Start the backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your database + service credentials

# Create database tables
node database/schema.js

# Start development server
npm run dev
```

Full backend setup guide → [`backend/README.md`](backend/README.md)

---

## 🛠️ Tech Stack

| Layer        | Technology                                      |
|--------------|-------------------------------------------------|
| Frontend     | HTML5, CSS3, Vanilla JS, Bebas Neue + Outfit fonts |
| Backend      | Node.js, Express.js                             |
| Database     | PostgreSQL (Neon / Supabase / local)            |
| Cache / Cart | Redis (Upstash / local)                         |
| Auth         | JWT (access + refresh) + OTP SMS                |
| Payments     | bKash, Nagad, SSLCommerz                        |
| Images       | Cloudinary                                      |
| SMS          | Twilio                                          |
| Email        | Nodemailer (Gmail SMTP)                         |
| Courier      | Pathao, Steadfast                               |
| Deploy       | Vercel (frontend) + Railway (backend)           |

---

## 📜 License
MIT — free to use, modify, and deploy for your business.

---

Built with ❤️ in Bangladesh 🇧🇩
