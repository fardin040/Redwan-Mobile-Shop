#!/bin/bash
# ============================================================
# Redwan Mobile Shop — GitHub Setup Script
# Run this once on your computer to push everything to GitHub
#
# Usage:
#   chmod +x push-to-github.sh
#   ./push-to-github.sh
# ============================================================

set -e  # Exit on any error

# ── Colors ───────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "  ____  _____  ______          ___    _   _   "
echo " |  _ \| ____||  _ \ \        / / \  | \ | |  "
echo " | |_) |  _|  | | | \ \  /\ / / _ \ |  \| |  "
echo " |  _ < | |___| |_| |\ \/  \/ / ___ \| |\  |  "
echo " |_| \_\|_____|____/  \__/\__/_/   \_\_| \_|  "
echo ""
echo "     Mobile Shop — GitHub Push Script"
echo -e "${NC}"

# ── Step 1: Check prerequisites ──────────────────────────────
echo -e "${YELLOW}[1/5] Checking prerequisites...${NC}"

if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ git is not installed. Install it from https://git-scm.com${NC}"
    exit 1
fi

if ! command -v gh &> /dev/null; then
    echo -e "${YELLOW}⚠️  GitHub CLI (gh) not found. Installing instructions:${NC}"
    echo "   macOS:   brew install gh"
    echo "   Ubuntu:  sudo apt install gh"
    echo "   Windows: winget install GitHub.cli"
    echo ""
    echo -e "${YELLOW}OR skip gh and use manual method (see below).${NC}"
    echo ""
    MANUAL_MODE=true
else
    MANUAL_MODE=false
fi

echo -e "${GREEN}✅ Git version: $(git --version)${NC}"

# ── Step 2: Git config ────────────────────────────────────────
echo ""
echo -e "${YELLOW}[2/5] Setting up git config...${NC}"

read -p "Enter your GitHub username: " GITHUB_USERNAME
read -p "Enter your email (for git commits): " GIT_EMAIL
read -p "Enter repo name (default: redwan-mobile-shop): " REPO_NAME
REPO_NAME=${REPO_NAME:-redwan-mobile-shop}

git config user.name  "$GITHUB_USERNAME"
git config user.email "$GIT_EMAIL"

echo -e "${GREEN}✅ Git configured for $GITHUB_USERNAME${NC}"

# ── Step 3: Initialize git repo ──────────────────────────────
echo ""
echo -e "${YELLOW}[3/5] Initializing git repository...${NC}"

# Make sure we're in the right directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ -d ".git" ]; then
    echo "   Git repo already initialized."
else
    git init
    echo -e "${GREEN}✅ Git initialized${NC}"
fi

git add -A
git commit -m "🚀 Initial commit — Redwan Mobile Shop

Complete e-commerce website for a mobile shop:

Frontend (9 HTML pages):
- Homepage with flash sale, product grid, brands
- Product detail with specs, gallery, reviews
- Checkout with bKash/Nagad/Card/COD
- Order tracking with live timeline
- User account, login/register with OTP
- My orders, wishlist, search results
- Admin dashboard with Chart.js analytics
- Admin product & inventory manager
- Admin orders & customers manager

Backend (Node.js + Express):
- PostgreSQL database with 15 tables
- JWT authentication + OTP via SMS
- bKash, Nagad, SSLCommerz payment APIs
- Pathao + Steadfast courier integration
- Cloudinary image storage
- Redis cart + session cache
- 40+ REST API endpoints"

echo -e "${GREEN}✅ Git commit created${NC}"

# ── Step 4: Create GitHub repo ────────────────────────────────
echo ""
echo -e "${YELLOW}[4/5] Creating GitHub repository...${NC}"

if [ "$MANUAL_MODE" = true ]; then
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}MANUAL STEPS (since gh CLI is not installed):${NC}"
    echo ""
    echo "  1. Go to: https://github.com/new"
    echo "  2. Repository name: ${REPO_NAME}"
    echo "  3. Description: Full-stack mobile shop e-commerce website"
    echo "  4. Set to: Public (or Private)"
    echo "  5. ❌ Do NOT check 'Add README' or any other init options"
    echo "  6. Click 'Create repository'"
    echo ""
    echo "  Then run these commands:"
    echo ""
    echo -e "${GREEN}  git remote add origin https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git${NC}"
    echo -e "${GREEN}  git branch -M main${NC}"
    echo -e "${GREEN}  git push -u origin main${NC}"
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # Still set up remote so user just needs to run push
    read -p "Press Enter after creating the repo on GitHub to set up remote..."
    git remote remove origin 2>/dev/null || true
    git remote add origin "https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"
    git branch -M main

    echo ""
    echo -e "${YELLOW}[5/5] Pushing to GitHub...${NC}"
    git push -u origin main

else
    # Use gh CLI
    echo "Logging into GitHub..."
    gh auth status 2>/dev/null || gh auth login

    read -p "Make repo public? (y/n, default: y): " IS_PUBLIC
    IS_PUBLIC=${IS_PUBLIC:-y}

    if [ "$IS_PUBLIC" = "y" ]; then
        VISIBILITY="--public"
    else
        VISIBILITY="--private"
    fi

    gh repo create "$REPO_NAME" \
        $VISIBILITY \
        --description "Full-stack mobile shop e-commerce website — Bangladesh" \
        --source=. \
        --remote=origin \
        --push

    echo -e "${GREEN}✅ Repository created and pushed!${NC}"
fi

# ── Step 5: Done ──────────────────────────────────────────────
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 SUCCESS! Your code is now on GitHub!${NC}"
echo ""
echo -e "  📦 Repository: ${BLUE}https://github.com/${GITHUB_USERNAME}/${REPO_NAME}${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Deploy frontend to Vercel:"
echo "     → https://vercel.com/new → Import GitHub repo → set root to 'frontend'"
echo ""
echo "  2. Deploy backend to Railway:"
echo "     → https://railway.app/new → Deploy from GitHub → set root to 'backend'"
echo "     → Add all .env variables in Railway dashboard"
echo ""
echo "  3. Set up PostgreSQL:"
echo "     → https://neon.tech (free) → create project → copy DATABASE_URL"
echo ""
echo "  4. Set up Redis:"
echo "     → https://upstash.com (free) → create database → copy REDIS_URL"
echo ""
echo "  Full guide: backend/README.md"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
