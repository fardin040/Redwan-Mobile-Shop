// ============================================================
// js/my-orders.js — Live Orders Page Logic
// ============================================================

const STATUS_CLASSES = {
    pending:    'sp-pending',
    confirmed:  'sp-processing',
    processing: 'sp-processing',
    packed:     'sp-processing',
    shipped:    'sp-shipped',
    delivered:  'sp-delivered',
    cancelled:  'sp-cancelled',
    refunded:   'sp-cancelled',
};

const STATUS_LABELS = {
    pending:    '⏳ Pending',
    confirmed:  '✓ Confirmed',
    processing: '● Processing',
    packed:     '📦 Packed',
    shipped:    '🚚 Shipped',
    delivered:  '✓ Delivered',
    cancelled:  '✕ Cancelled',
    refunded:   '↩ Refunded',
};

const TRACK_STEPS = ['pending', 'processing', 'shipped', 'delivered'];

let allOrders = [];
let activeStatus = 'all';

// ── Init ──────────────────────────────────────────────────────
(async () => {
    // Auth check
    if (window.Auth && typeof window.Auth.init === 'function') {
        await window.Auth.init();
    }
    if (!window.Auth?.user) {
        window.location.href = '/account.html';
        return;
    }

    // Populate sidebar profile
    const user = window.Auth.user;
    const sideAvatar = document.getElementById('sideAvatar');
    const sideName   = document.getElementById('sideName');
    const sideEmail  = document.getElementById('sideEmail');
    if (sideAvatar) sideAvatar.textContent = user.name?.charAt(0).toUpperCase() || 'U';
    if (sideName)   sideName.textContent = user.name || 'User';
    if (sideEmail)  sideEmail.textContent = user.email || user.phone || '';

    await loadOrders();
})();

// ── Load orders from API ──────────────────────────────────────
async function loadOrders() {
    const list = document.getElementById('ordersList');
    list.innerHTML = `<div style="text-align:center;padding:60px;color:var(--muted);">
        <div style="font-size:36px;margin-bottom:12px;">⏳</div>
        <div>Loading your orders...</div>
    </div>`;

    try {
        const result = await window.API.get('/orders?limit=50');
        if (!result.success) throw new Error(result.message);

        allOrders = result.data || [];

        // Update counts
        updateFilterCounts();
        renderOrders(allOrders);

        // Update page header count
        const headerCount = document.getElementById('orderCount');
        if (headerCount) headerCount.textContent = `${allOrders.length} order${allOrders.length !== 1 ? 's' : ''} placed`;

    } catch (e) {
        list.innerHTML = `<div style="text-align:center;padding:60px;color:var(--muted);">
            <div style="font-size:40px;margin-bottom:12px;">⚠️</div>
            <div style="font-weight:600;margin-bottom:8px;color:var(--text);">Could not load orders</div>
            <div style="font-size:13px;">${e.message || 'Please try again.'}</div>
        </div>`;
    }
}

// ── Render order cards ────────────────────────────────────────
function renderOrders(orders) {
    const list = document.getElementById('ordersList');

    if (!orders.length) {
        list.innerHTML = `<div class="empty-state">
            <div class="empty-icon">📦</div>
            <div class="empty-title">NO ORDERS YET</div>
            <div class="empty-sub">Looks like you haven't placed any orders.<br>Browse our latest phones and accessories.</div>
            <a href="/redwan-mobile-shop.html" style="display:inline-block;background:var(--red);color:white;border-radius:10px;padding:12px 28px;font-weight:700;font-size:14px;text-decoration:none;">🛒 Shop Now</a>
        </div>`;
        return;
    }

    list.innerHTML = orders.map((order, i) => {
        const statusClass = STATUS_CLASSES[order.status] || 'sp-pending';
        const statusLabel = STATUS_LABELS[order.status] || order.status;
        const date = new Date(order.created_at).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
        const payment = (order.payment_method || 'cod').replace(/_/g,' ').toUpperCase();
        const firstItem = order.items?.[0];
        const extraItems = (order.items?.length || 1) - 1;
        const addr = order.shipping_address || {};
        const estDelivery = order.estimated_delivery
            ? new Date(order.estimated_delivery).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
            : '—';

        // Mini track
        const trackStepIdx = TRACK_STEPS.indexOf(order.status);
        const trackHTML = TRACK_STEPS.map((step, idx) => {
            const isDone   = idx < trackStepIdx;
            const isActive = idx === trackStepIdx;
            const cls = isDone ? 'done' : (isActive ? 'active' : '');
            const dot = isDone ? '✓' : (isActive ? '●' : '');
            return `
                ${idx > 0 ? `<div class="track-line${isDone ? ' done' : ''}"></div>` : ''}
                <div class="track-step ${cls}">
                    <div class="track-dot">${dot}</div>
                    <div class="track-label">${step.charAt(0).toUpperCase() + step.slice(1)}</div>
                </div>`;
        }).join('');

        const canCancel = ['pending','confirmed'].includes(order.status);
        const isDelivered = order.status === 'delivered';
        const isCancelled = order.status === 'cancelled' || order.status === 'refunded';

        return `
        <div class="order-card" data-status="${order.status}" style="animation-delay:${i * 0.07}s">
            <div class="order-card-header">
                <div>
                    <div class="order-id">#${order.order_number}</div>
                    <div class="order-date">Placed on ${date} · ${payment}</div>
                </div>
                <div class="order-status"><span class="status-pill ${statusClass}">${statusLabel}</span></div>
            </div>
            <div class="order-card-body">
                <div class="order-items-row">
                    <div class="order-item-thumb">${firstItem?.image_url ? `<img src="${firstItem.image_url}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">` : '📱'}</div>
                    <div class="order-item-info">
                        <div class="order-item-name">${firstItem?.name || 'Order Items'}</div>
                        <div class="order-item-meta">Qty: ${firstItem?.quantity || 1}${extraItems > 0 ? ` + ${extraItems} more item${extraItems > 1 ? 's' : ''}` : ''}</div>
                        <div class="order-item-meta" style="margin-top:2px;">📍 ${addr.district || addr.city || 'Bangladesh'}</div>
                    </div>
                    <div class="order-total">
                        <div class="order-amount" ${isCancelled ? 'style="color:var(--muted);text-decoration:line-through;"' : ''}>৳${Number(order.total_amount).toLocaleString('en-BD')}</div>
                        <div class="order-items-count">${order.items?.length || 1} item${(order.items?.length || 1) > 1 ? 's' : ''}</div>
                        ${isCancelled ? '<div style="font-size:12px;color:var(--red);font-weight:600;">Refunded</div>' : ''}
                    </div>
                </div>
                ${!isCancelled ? `<div class="track-mini">${trackHTML}</div>` : ''}
            </div>
            <div class="order-card-footer">
                <div class="order-delivery">
                    ${isDelivered ? `Delivered · <strong>${addr.name || 'Customer'}</strong>`
                    : isCancelled ? `<span style="color:var(--red);">Cancelled · Refund in 3-5 business days</span>`
                    : `Est. delivery: <strong>${estDelivery}</strong> · ${order.courier_name || 'Standard'}`}
                </div>
                ${canCancel ? `<button class="btn-sm" style="color:var(--red);border-color:rgba(232,19,42,0.3);" onclick="cancelOrder('${order.id}','${order.order_number}')">✕ Cancel</button>` : ''}
                ${isDelivered ? `<button class="btn-sm primary" onclick="reorder('${order.id}')">🔁 Re-order</button>` : ''}
                ${isDelivered ? `<button class="btn-sm">⭐ Write Review</button>` : ''}
                <button class="btn-sm">📄 Invoice</button>
            </div>
        </div>`;
    }).join('');
}

// ── Filter ────────────────────────────────────────────────────
window.filterOrders = function(el, status) {
    activeStatus = status;
    document.querySelectorAll('.status-filter').forEach(f => f.classList.remove('active'));
    el.classList.add('active');
    const filtered = status === 'all' ? allOrders : allOrders.filter(o => {
        if (status === 'processing') return ['processing','confirmed','packed','pending'].includes(o.status);
        return o.status === status;
    });
    renderOrders(filtered);
};

// ── Update filter badge counts ────────────────────────────────
function updateFilterCounts() {
    const counts = { all: allOrders.length };
    allOrders.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });

    const filterMap = {
        all: 'all',
        processing: ['processing', 'confirmed', 'packed', 'pending'],
        shipped: ['shipped'],
        delivered: ['delivered'],
        cancelled: ['cancelled', 'refunded'],
    };

    document.querySelectorAll('.status-filter').forEach(el => {
        const s = el.dataset.filter;
        if (!s) return;
        const statuses = filterMap[s] || [s];
        const count = Array.isArray(statuses)
            ? allOrders.filter(o => statuses.includes(o.status)).length
            : (counts[s] || 0);
        const badge = el.querySelector('.count');
        if (badge) badge.textContent = count;
    });

    // Update sidebar badge
    const sideBadge = document.getElementById('ordersBadge');
    if (sideBadge) sideBadge.textContent = allOrders.length;
}

// ── Cancel order ──────────────────────────────────────────────
window.cancelOrder = async function(orderId, orderNumber) {
    if (!confirm(`Cancel order #${orderNumber}? This cannot be undone.`)) return;
    try {
        const result = await window.API.post(`/orders/${orderId}/cancel`, { reason: 'Cancelled by customer' });
        if (result.success) {
            await loadOrders(); // Refresh
        }
    } catch (e) {
        alert(e.message || 'Could not cancel order. Please contact support.');
    }
};

// ── Re-order (add items back to cart) ────────────────────────
window.reorder = async function(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;
    try {
        for (const item of (order.items || [])) {
            if (item.product_id || item.product_id) {
                await window.Cart?.addItem?.({ id: item.product_id }, 1);
            }
        }
        alert('Items added to cart!');
    } catch {
        alert('Could not re-order. Please add items manually.');
    }
};

// ── Search ────────────────────────────────────────────────────
window.searchOrders = function(query) {
    const q = query.toLowerCase();
    const filtered = !q ? allOrders : allOrders.filter(o =>
        o.order_number?.toLowerCase().includes(q) ||
        o.items?.some(i => i.name?.toLowerCase().includes(q))
    );
    renderOrders(filtered);
};
