// ==========================================================
// js/home.js - Dynamic Homepage Logic
// ==========================================================

document.addEventListener("DOMContentLoaded", () => {
    initFlashSaleTimer();
    initBrandPills();
    initScrollReveal();
    loadFlashSaleProducts();
});

// Flash sale countdown timer logic
function initFlashSaleTimer() {
    let total = 8 * 3600 + 45 * 60; // Mock 8h 45m left
    const hrEl = document.getElementById('hours');
    const minEl = document.getElementById('mins');
    const secEl = document.getElementById('secs');

    if (!hrEl || !minEl || !secEl) return;

    setInterval(() => {
        total--;
        if (total < 0) total = 86400; // Reset to 24 hours
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        hrEl.textContent = String(h).padStart(2, '0');
        minEl.textContent = String(m).padStart(2, '0');
        secEl.textContent = String(s).padStart(2, '0');
    }, 1000);
}

// Brand toggle visually
function initBrandPills() {
    document.querySelectorAll('.brand-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.brand-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            // If we have a generic search endpoint, we could trigger loadProducts(pill.textContent)
        });
    });
}

// Standard intersection observer for reveal animations
function initScrollReveal() {
    const observer = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                e.target.style.opacity = '1';
                e.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });
    document.querySelectorAll('.product-card, .why-card, .review-card, .cat-card').forEach(el => observer.observe(el));
}

// Global wishlist toggle wrapper
window.toggleWishlist = async (productId, btn) => {
    btn = btn || event.currentTarget;
    const token = localStorage.getItem('accessToken');
    if (!token) {
        alert('Please sign in to save your favorite items!');
        window.location.href = "/account.html";
        return;
    }

    if(btn) {
        btn.textContent = btn.textContent.trim() === '♡' ? '❤️' : '♡';
        btn.style.color = btn.textContent === '❤️' ? 'var(--red)' : '';
    }

    if (!productId) return;

    try {
        if (btn && btn.textContent === '❤️') {
            await window.API.post('/wishlist', { product_id: productId });
        } else {
            await window.API.del(`/wishlist/${productId}`);
        }
    } catch(e) {
        console.error("Wishlist error", e);
    }
};

// Fetch Dynamic Products
async function loadFlashSaleProducts() {
    const grid = document.querySelector('.products-grid');
    if (!grid) return;

    try {
        // Since database might be empty initially, fallback gracefully
        const res = await window.API.get('/promotions/flash-sale');
        
        if (res.success && res.data && res.data.length > 0) {
            renderProducts(res.data, grid);
        } else {
            // Load generic products if no flash sale active
            const fallback = await window.API.get('/search?limit=4');
            if (fallback.success && fallback.data && fallback.data.length > 0) {
                renderProducts(fallback.data, grid);
            } else {
                console.log("Database empty, keeping HTML mockups visible");
                // Do not clear the innerHTML just in case the DB is completely empty and we want to show the UI
            }
        }
    } catch (e) {
        console.error("Failed to load products dynamically", e);
    }
}

// HTML Renderer for abstracting product inject
function renderProducts(productArray, container) {
    container.innerHTML = productArray.map(p => {
        const discountBadge = p.sale_price 
            ? `<span class="card-badge badge-sale">Sale!</span>` 
            : `<span class="card-badge badge-new">New</span>`;

        const finalPrice = p.sale_price || p.price;
        const oldPriceHtml = p.sale_price ? `<span class="card-price-old">৳${p.price.toLocaleString()}</span>` : '';
        const savedHtml = p.sale_price ? `<span class="card-discount">Save ৳${(p.price - p.sale_price).toLocaleString()}</span>` : '';
        
        // Grab first image
        let imgHtml = `<div class="phone-icon">📱</div>`;
        if (p.images && p.images.length > 0) {
            imgHtml = `<img src="${p.images[0]}" style="width:100%; height:100%; object-fit:contain; padding:10px;" alt="${p.name}"/>`;
        }

        return `
        <div class="product-card" onclick="window.location.href='/product-detail.html?id=${p.id}'">
            ${discountBadge}
            <button class="card-wishlist" onclick="event.stopPropagation(); window.toggleWishlist('${p.id}', this)">♡</button>
            <div class="card-img">
                ${imgHtml}
            </div>
            <div class="card-body">
                <div class="card-brand">${p.brand_name || p.brand || 'Redwan'}</div>
                <div class="card-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${p.name}">${p.name}</div>
                <div class="card-specs">
                    <span class="spec-tag">★ ${p.avg_rating || '5.0'}</span>
                </div>
                <div class="card-price-row">
                    <div><span class="card-price">৳${finalPrice.toLocaleString()}</span>${oldPriceHtml}</div>
                    ${savedHtml}
                </div>
            </div>
            <div class="card-actions">
                <button class="btn-cart" onclick="event.stopPropagation(); window.addToCart('${p.id}')">🛒 Add to Cart</button>
                <button class="btn-compare" onclick="event.stopPropagation()">Compare</button>
            </div>
        </div>
        `;
    }).join("");
    
    // Re-bind intersection observer natively for injected elements
    const observer = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                e.target.style.opacity = '1';
                e.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });
    container.querySelectorAll('.product-card').forEach(el => observer.observe(el));
}
