// ==========================================================
// js/checkout.js - Checkout API Integration
// ==========================================================

let deliveryFee = 0;
let selectedDeliveryMethod = 'same_day';
let selectedPaymentMethod = 'bkash';
let appliedCouponCode = null;
let discountAmt = 0;

document.addEventListener("DOMContentLoaded", async () => {
    // Attempt to await Cart load if it hasn't already
    if (!window.Cart.items || window.Cart.items.length === 0) {
        await window.Cart.load();
    }
    renderCart();

    // Attach local auth state if user is logged in
    setTimeout(() => {
        if (window.Auth && window.Auth.user) {
            const u = window.Auth.user;
            if(document.getElementById('checkoutFirstName')) {
                const parts = (u.name || '').split(' ');
                document.getElementById('checkoutFirstName').value = parts[0] || '';
                document.getElementById('checkoutLastName').value = parts.slice(1).join(' ') || '';
            }
            if(document.getElementById('checkoutEmail')) document.getElementById('checkoutEmail').value = u.email || '';
            if(document.getElementById('checkoutPhone')) document.getElementById('checkoutPhone').value = u.phone || '';
        }
    }, 200);
});

// ── UI Rendering ──────────────────────────────────────────────

function renderCart() {
    const container = document.getElementById('cartItemsContainer');
    if (!container) return;

    if (!window.Cart.items || window.Cart.items.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted);">Your cart is empty. <br><br><a href="/redwan-mobile-shop.html" style="color:var(--red);">Return to Shop</a></div>`;
        document.getElementById('submitOrderBtn').style.opacity = '0.5';
        document.getElementById('submitOrderBtn').style.pointerEvents = 'none';
        updateTotals();
        return;
    }

    container.innerHTML = window.Cart.items.map(item => `
        <div class="summary-item">
          <div class="item-img">${item.image ? `<img src="${item.image}" alt="img" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">` : '📱'}</div>
          <div class="item-info">
            <div class="item-name">${item.name}</div>
            <div class="item-variant">${item.variant_id ? 'Custom Variant' : 'Default'}</div>
            <div class="item-qty">Qty: ${item.quantity}</div>
          </div>
          <div class="item-price">৳${(item.price * item.quantity).toLocaleString()}</div>
        </div>
    `).join('');

    updateTotals();
}

function updateTotals() {
    let count = 0;
    if (window.Cart.items) {
        count = window.Cart.items.reduce((s, i) => s + i.quantity, 0);
    }
    const subtotal = window.Cart.subtotal || 0;
    
    // Free delivery threshold
    let finalDeliveryFee = deliveryFee;
    if (subtotal >= 50000 && finalDeliveryFee > 0) finalDeliveryFee = 0; // Promotional fallback logic
    
    if (document.getElementById('subtotalLabel')) {
        document.getElementById('subtotalLabel').textContent = `Subtotal (${count} items)`;
    }
    if (document.getElementById('subtotalValue')) {
        document.getElementById('subtotalValue').textContent = `৳${subtotal.toLocaleString()}`;
    }
    
    if (document.getElementById('deliveryCost')) {
        document.getElementById('deliveryCost').textContent = finalDeliveryFee <= 0 ? 'FREE' : `৳${finalDeliveryFee}`;
    }

    const vat = parseFloat(((subtotal - discountAmt) * 0.05).toFixed(2));
    if (document.getElementById('vatValue')) {
        document.getElementById('vatValue').textContent = `৳${vat.toLocaleString()}`;
    }

    const finalTotal = subtotal - discountAmt + finalDeliveryFee + vat;
    if (document.getElementById('totalAmount')) {
        document.getElementById('totalAmount').textContent = `৳${finalTotal.toLocaleString()}`;
    }
}

// ── Options Handlers ──────────────────────────────────────────

window.selectDelivery = function(el, fee, methodStr) {
    document.querySelectorAll('.delivery-opt').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    deliveryFee = fee < 0 ? 0 : fee;
    selectedDeliveryMethod = methodStr;
    updateTotals();
};

window.selectPay = function(el, type) {
    document.querySelectorAll('.pay-opt').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    document.querySelectorAll('.card-form').forEach(f => f.classList.remove('active'));
    const form = document.getElementById('pay-' + type);
    if(form) form.classList.add('active');
    selectedPaymentMethod = type;
};

window.applyCoupon = function() {
    const code = document.getElementById('couponInput')?.value.trim().toUpperCase();
    if (!code) {
        alert('Please enter a coupon code!');
        return;
    }
    
    // In production this maps to a GET /api/cart/coupon endpoint 
    // but for demo flow we statically mock the REDWAN20 response
    if (code === 'REDWAN20') {
        const subtotal = window.Cart.subtotal || 0;
        discountAmt = Math.min(20000, subtotal * 0.2); // 20% off up to 20k
        appliedCouponCode = code;
        
        document.getElementById('couponSuccess').style.display = 'block';
        document.getElementById('couponSuccess').textContent = `🎉 Coupon ${code} applied! You save ৳${discountAmt.toLocaleString()}`;
        document.getElementById('discountRow').style.display = 'flex';
        document.getElementById('discountAmt').textContent = `−৳${discountAmt.toLocaleString()}`;
        updateTotals();
    } else {
        alert('Invalid coupon code. Try: REDWAN20');
        document.getElementById('discountRow').style.display = 'none';
        discountAmt = 0;
        appliedCouponCode = null;
        updateTotals();
    }
};

// ── Order Dispatch ────────────────────────────────────────────

window.submitCheckoutOrder = async function() {
    if (!window.Cart.items || window.Cart.items.length === 0) return;

    const btn = document.getElementById('submitOrderBtn');
    btn.innerHTML = '<span style="opacity:0.8;">Processing Securely...</span>';
    btn.style.pointerEvents = 'none';

    // 1. Gather Customer & Shipping details
    const shipping_address = {
        address: document.getElementById('checkoutAddress')?.value.trim(),
        district: document.getElementById('checkoutDistrict')?.value.trim(),
        upazila: document.getElementById('checkoutUpazila')?.value.trim() || '',
        postal_code: document.getElementById('checkoutPostal')?.value.trim() || ''
    };

    if (!shipping_address.address || !shipping_address.district) {
        alert("Please provide the required Shipping Address and District.");
        btn.innerHTML = '🔒 Place Order Securely';
        btn.style.pointerEvents = 'auto';
        return;
    }

    const payload = {
        items: window.Cart.items.map(item => ({
            product_id: item.product_id,
            variant_id: item.variant_id || null, // Allow null for default variants
            quantity: item.quantity
        })),
        shipping_address: shipping_address,
        delivery_method: selectedDeliveryMethod || 'standard',
        payment_method: selectedPaymentMethod || 'cod',
        coupon_code: appliedCouponCode,
        notes: document.getElementById('checkoutNotes')?.value.trim(),
        guest_name: `${document.getElementById('checkoutFirstName')?.value.trim()} ${document.getElementById('checkoutLastName')?.value.trim()}`,
        guest_phone: document.getElementById('checkoutPhone')?.value.trim(),
        guest_email: document.getElementById('checkoutEmail')?.value.trim()
    };

    if (!payload.guest_phone) {
        alert("Phone Number is required for delivery.");
        btn.innerHTML = '🔒 Place Order Securely';
        btn.style.pointerEvents = 'auto';
        return;
    }

    try {
        const res = await window.API.post('/orders', payload);
        if (res.success && res.data) {
            const order_number = res.data.order.order_number;
            
            // Wipe Cart immediately to prevent double submissions
            localStorage.removeItem('cartId');
            window.Cart.items = [];
            window.Cart.subtotal = 0;
            window.Cart.updateUI();

            // Populate Success Data
            const successOverlay = document.getElementById('successOverlay');
            if (successOverlay) {
                const soNum = successOverlay.querySelector('.success-order');
                if(soNum) soNum.textContent = '#' + order_number;
                successOverlay.classList.add('show');
            }

            // Populate Tracking Window Background
            const trackingPage = document.getElementById('trackingPage');
            if(trackingPage) {
                const tv = trackingPage.querySelector('.meta-item .meta-value.red');
                if(tv) tv.textContent = '#' + order_number;
                
                // Expose tracking swap callback
                window.showTracking = function() {
                    successOverlay.classList.remove('show');
                    document.getElementById('checkoutPage').style.display = 'none';
                    document.querySelector('.checkout-steps').style.display = 'none'; // hide progress bar
                    trackingPage.style.display = 'block';
                    window.scrollTo({top: 0, behavior: 'smooth'});
                }
            }
            
            // Animate progress step
            setTimeout(() => {
                document.getElementById('step3')?.classList.add('done');
                if(document.getElementById('step3')) document.getElementById('step3').querySelector('.step-circle').textContent = '✓';
                document.getElementById('line2')?.classList.add('done');
                document.getElementById('step4')?.classList.add('done');
                if(document.getElementById('step4')) document.getElementById('step4').querySelector('.step-circle').textContent = '✓';
                document.getElementById('line3')?.classList.add('done');
            }, 300);

        } else {
            alert("Order failed: " + (res.message || 'Unknown error'));
            btn.innerHTML = '🔒 Place Order Securely';
            btn.style.pointerEvents = 'auto';
        }
    } catch (e) {
        console.error("Critical submission error", e);
        alert("Network error. Please try again or contact support.");
        btn.innerHTML = '🔒 Place Order Securely';
        btn.style.pointerEvents = 'auto';
    }
};
