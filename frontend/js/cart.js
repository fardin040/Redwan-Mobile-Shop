// ==========================================================
// js/cart.js - Cart State and API Synchronizing
// ==========================================================

const Cart = {
    items: [],
    subtotal: 0,
    shippingFee: 0, // 0 means Free Shipping
    
    // Core cart identifier for guest users via KV
    getCartId() {
        let cartId = localStorage.getItem('cartId');
        if (!cartId) {
            cartId = 'cart_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('cartId', cartId);
        }
        return cartId;
    },

    /**
     * Fetch Cart from API
     */
    async load() {
        try {
            const result = await window.API.get(`/cart?cartId=${this.getCartId()}`);
            if (result.success) {
                this.items = result.data.items || [];
                this.subtotal = result.data.subtotal || 0;
            }
            this.updateUI();
        } catch (e) {
            console.error('Failed to load cart', e);
        }
    },

    /**
     * Add item to cart
     */
    async add(productId, variantId, quantity = 1) {
        try {
            const body = {
                cartId: this.getCartId(),
                items: [{ product_id: productId, variant_id: variantId, quantity }]
            };
            const result = await window.API.post('/cart', body);
            if (result.success) {
                this.items = result.data.items || [];
                this.subtotal = result.data.subtotal || 0;
                this.updateUI();
                
                // Show floating success modal or just open cart directly
                window.toggleCart(true); // Open cart immediately
            }
        } catch (e) {
            console.error('Failed to add to cart', e);
            alert("Failed to add to cart: " + e.message);
        }
    },

    /**
     * Update item quantity
     */
    async updateQty(productId, variantId, quantity) {
        if (quantity < 1) { return this.remove(productId, variantId); }

        try {
            const body = { productId, variantId, quantity, cartId: this.getCartId() };
            const result = await window.API.put('/cart/item', body);
            if(result.success) {
                this.items = result.data.items || [];
                this.subtotal = result.data.subtotal || 0;
                this.updateUI();
            }
        } catch (e) { console.error('Failed to update cart', e); }
    },

    /**
     * Remove item entirely
     */
    async remove(productId, variantId) {
        try {
            const body = { productId, variantId, cartId: this.getCartId() };
            const result = await window.API.post('/cart/item/remove', body); // Note API uses DELETE usually, assuming custom wrapper or POST for body mapping
            if(result.success) {
                this.items = result.data.items || [];
                this.subtotal = result.data.subtotal || 0;
                this.updateUI();
            }
        } catch(e) {
            // fallback if api fetch fails wrapper
            const url = `${window.API_BASE}/cart/item?cartId=${this.getCartId()}&productId=${productId}` + (variantId? `&variantId=${variantId}` :'');
            const res = await fetch(url, { method: 'DELETE', headers: {'Content-Type':'application/json'} });
            if(res.ok) { this.load(); }
        }
    },

    /**
     * Synchronize entire UI
     */
    updateUI() {
        const cartBadge = document.querySelector('.icon-btn[onclick="toggleCart()"] .badge');
        const cartSidebar = document.getElementById('cartSidebar');
        if (!cartSidebar) return;

        const cartBody = cartSidebar.querySelector('.cart-body');
        const totalElems = cartSidebar.querySelectorAll('.cart-total .val');
        const headerTitle = cartSidebar.querySelector('.cart-header h3');

        // Total count
        const count = this.items.reduce((sum, item) => sum + item.quantity, 0);
        
        // Update NavBar Badge
        if (cartBadge) {
            cartBadge.textContent = count;
            cartBadge.style.display = count > 0 ? 'flex' : 'none';
        }

        // Update Header
        if (headerTitle) { headerTitle.textContent = `Your Cart (${count})`; }

        // Update Body
        if (cartBody) {
            if (this.items.length === 0) {
                cartBody.innerHTML = `<div style="text-align:center;color:var(--muted);padding:40px 0;">Your cart is empty.</div>`;
            } else {
                cartBody.innerHTML = this.items.map(item => `
                    <div class="cart-item">
                        <div class="cart-item-img">
                            ${item.image ? `<img src="${item.image}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">` : '📱'}
                        </div>
                        <div class="cart-item-info">
                            <div class="cart-item-name">${item.name}</div>
                            ${item.variant_id ? `<div style="font-size:11px;color:var(--muted);">Variant: ${item.variant_id}</div>` : ''}
                            <div class="cart-item-price">৳${item.price.toLocaleString()}</div>
                            <div class="cart-item-qty">
                                <button class="qty-btn" onclick="Cart.updateQty('${item.product_id}', ${item.variant_id ? `'${item.variant_id}'` : 'null'}, ${item.quantity - 1})">−</button>
                                <span class="qty-val">${item.quantity}</span>
                                <button class="qty-btn" onclick="Cart.updateQty('${item.product_id}', ${item.variant_id ? `'${item.variant_id}'` : 'null'}, ${item.quantity + 1})">+</button>
                                <button class="btn-outline" style="padding:4px 8px; font-size:11px; margin-left:auto; border:none; color:var(--red);" 
                                        onclick="Cart.remove('${item.product_id}', ${item.variant_id ? `'${item.variant_id}'` : 'null'})">Remove</button>
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        }

        // Update Footer Subtotal
        if (totalElems && totalElems.length > 0) {
            totalElems[0].textContent = `৳${this.subtotal.toLocaleString()}`;
        }
    }
};

// Expose Global Cart Methods
window.Cart = Cart;

// Toggle Cart wrapper 
window.toggleCart = (forceOpen = null) => {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('cartOverlay');
    if (!sidebar || !overlay) return;

    if (forceOpen === true) {
        sidebar.classList.add('open');
        overlay.classList.add('open');
    } else if (forceOpen === false) {
        sidebar.classList.remove('open');
        overlay.classList.remove('open');
    } else {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('open');
    }
};

// Global addToCart called by old HTML buttons
window.addToCart = (productId) => {
    Cart.add(productId, null, 1);
};

document.addEventListener("DOMContentLoaded", () => {
    Cart.load();
});
