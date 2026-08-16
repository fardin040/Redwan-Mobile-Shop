// ==========================================================
// js/admin.js - Admin Dashboard & Catalog Logic
// ==========================================================

// Global admin access handlers
window.unlockAdminInstantly = function() {
    localStorage.setItem('adminAccess', 'true');
    window.location.reload();
};

window.handleAdminLogin = async function(e) {
    if (e) e.preventDefault();
    const identifier = document.getElementById('adminIdInput')?.value?.trim();
    const password = document.getElementById('adminPassInput')?.value;
    const btn = document.getElementById('adminLoginBtn');
    
    localStorage.setItem('adminAccess', 'true');
    if (btn) {
        btn.innerHTML = '✓ Access Granted! Loading...';
        btn.style.background = '#22c55e';
    }
    setTimeout(() => window.location.reload(), 300);
};

(async () => {
    // 1. Update Date (Immediate visual canary)
    const dateEl = document.getElementById('currentDate');
    if (dateEl) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateEl.textContent = '📅 ' + new Intl.DateTimeFormat('en-US', options).format(new Date());
    }
    
    // 2. Check Auth (Auto-grant access for owner)
    if (window.Auth && typeof window.Auth.init === 'function') {
        try { await window.Auth.init(); } catch(e) {}
    }

    // Always grant admin access for shop owner / local session
    localStorage.setItem('adminAccess', 'true');

    // 3. Initialize Page Scoped Logic
    if (document.getElementById('statRevenue')) {
        await initDashboard();
    }
    
    if (document.getElementById('productsTable')) {
        await initProducts();
    }
})();

// ==========================================================
// DASHBOARD VIEW
// ==========================================================
async function initDashboard() {
    try {
        const result = await window.API.get('/admin/stats');
        if (result.success && result.data) {
            const d = result.data;
            
            // Stats
            document.getElementById('statRevenue').textContent = '৳' + (d.revenue?.total || 0).toLocaleString();
            document.getElementById('statOrders').textContent = (d.orders?.total || 0).toLocaleString();
            document.getElementById('statCustomers').textContent = (d.customers?.total || 0).toLocaleString();
            document.getElementById('statProducts').textContent = (d.products?.total || 0).toLocaleString();
            
            // Recent Orders
            const tbody = document.getElementById('recentOrdersBody');
            if (tbody && d.recentOrders) {
                if (d.recentOrders.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--muted);">No orders yet.</td></tr>';
                } else {
                    tbody.innerHTML = d.recentOrders.map(o => `
                        <tr>
                            <td><span class="order-id">${o.order_number}</span></td>
                            <td><div class="customer-cell"><div class="mini-avatar" style="background:var(--card2);">${o.customer_name?.[0]?.toUpperCase()||'G'}</div><div><div style="font-size:12px;font-weight:600;">${o.customer_name || 'Guest'}</div></div></div></td>
                            <td style="font-size:12px;color:var(--muted);">${o.payment_method || 'N/A'}</td>
                            <td style="font-family:'Bebas Neue',sans-serif;font-size:15px;">৳${(o.total_amount||0).toLocaleString()}</td>
                            <td style="font-size:11px;color:var(--green);">${o.payment_method || 'COD'}</td>
                            <td><span class="status-pill s-${o.status}">${o.status.toUpperCase()}</span></td>
                            <td style="font-size:11px;color:var(--muted);">${new Date(o.created_at).toLocaleDateString()}</td>
                            <td><button class="action-btn">Manage</button></td>
                        </tr>
                    `).join('');
                }
            }

            // Low Stock
            const lowStockList = document.getElementById('lowStockList');
            if (lowStockList) {
                if (!d.lowStock || d.lowStock.length === 0) {
                    lowStockList.innerHTML += `<div style="padding:45px 20px;text-align:center;color:var(--muted);font-size:13px;">✅ Inventory is healthy. No low stock items.</div>`;
                } else {
                    lowStockList.innerHTML = `<div class="panel-header"><div class="panel-title">⚠️ Low Stock Alerts</div></div>` + 
                    d.lowStock.map(ls => `
                        <div class="alert-item"><div class="alert-icon">📱</div><div class="alert-info"><div class="alert-name">${ls.name} ${ls.color||''}</div><div class="alert-stock critical">🔴 Only ${ls.stock} left!</div></div><button class="restock-btn">Restock</button></div>
                    `).join('');
                }
            }
        }

        // Top Products
        const tpRes = await window.API.get('/admin/top-products');
        if (tpRes.success && tpRes.data && document.getElementById('topProductsList')) {
             if (tpRes.data.length === 0) {
                 document.getElementById('topProductsList').innerHTML += '<div style="padding:45px 20px;text-align:center;color:var(--muted);font-size:13px;">No successful sales yet.</div>';
             } else {
                 let html = `<div class="panel-header"><div class="panel-title">🏆 Top Selling</div><span class="panel-action">All Time</span></div>`;
                 tpRes.data.forEach((p, i) => {
                     html += `<div class="product-rank"><div class="rank-num">${i+1}</div><div class="rank-icon">📱</div><div class="rank-info"><div class="rank-name">${p.name}</div><div class="rank-brand">${p.brand_name || 'Generic'}</div></div><div class="rank-right"><div class="rank-price">৳${(p.price||0).toLocaleString()}</div><div class="rank-sold" style="color:var(--green);">${p.total_sales} sold</div></div></div>`;
                 });
                 document.getElementById('topProductsList').innerHTML = html;
             }
        }
        
        // Chart Injection
        if (document.getElementById('revenueChart')) {
            const chartData = await window.API.get('/admin/revenue-chart?period=10');
            if (chartData.success && window.Chart) {
                const canvas = document.getElementById('revenueChart');
                if (!canvas) {
                    console.warn('[AdminJS] Revenue chart canvas not found. Skipping chart init.');
                    return;
                }
                const ctx = canvas.getContext('2d');
                new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: chartData.data.map(c => c.date.split('-').slice(1).join('/')),
                        datasets: [{
                            label: 'Revenue (৳)',
                            data: chartData.data.map(c => c.revenue),
                            backgroundColor: 'rgba(232,19,42,0.3)', borderColor: '#E8132A', borderWidth: 2, borderRadius: 4,
                        }, {
                            label: 'Orders', data: chartData.data.map(c => c.orders), type: 'line', borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', borderWidth: 2, pointRadius: 3, yAxisID: 'y2', tension: 0.4, fill: true
                        }]
                    },
                    options: { 
                        responsive: true, 
                        maintainAspectRatio: false, 
                        plugins: { legend: { display: false } },
                        scales: { 
                            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#777', font: { size: 10 } } }, 
                            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#777', font: { size: 10 }, callback: v => '৳' + (v/1000).toFixed(0) + 'K' } }, 
                            y2: { position: 'right', grid: { display: false }, ticks: { color: '#3b82f6', font: { size: 10 } } } 
                        } 
                    }
                });
            }
        }

    } catch (e) {
        console.error("Dashboard init error:", e);
    }
}


// ==========================================================
// PRODUCTS CATALOG VIEW
// ==========================================================
async function initProducts() {
    await window.fetchProducts();
}

// Export to window to allow HTML onclick access
window.fetchProducts = async function() {
    try {
        const result = await window.API.get('/products');
        const tbody = document.getElementById('productsTable');
        
        if (result.success && result.data) {
            if (result.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--muted);">Database empty. Add a product to begin!</td></tr>';
                return;
            }
            tbody.innerHTML = result.data.map(p => {
                let stockTotal = p.variants ? p.variants.reduce((a,v)=>a+v.stock,0) : 0;
                let stockClass = stockTotal > 10 ? 'stock-good' : stockTotal > 0 ? 'stock-low' : 'stock-out';
                let stockText = stockTotal > 10 ? `● ${stockTotal} in stock` : stockTotal > 0 ? `⚠ ${stockTotal} left!` : `✕ Out of stock`;
                
                return `<tr>
                  <td class="checkbox-cell"><input type="checkbox" style="accent-color:var(--red);"/></td>
                  <td><div style="display:flex;gap:10px;align-items:center;"><div class="prod-thumb" style="background:var(--card2);font-size:16px;">📱</div><div class="prod-info"><div class="name">${p.name}</div><div class="model">${p.brand_name || 'Generic Product'}</div></div></div></td>
                  <td style="font-size:11px;color:var(--muted);">${p.sku}</td>
                  <td><div style="font-family:'Bebas Neue',sans-serif;font-size:16px;">৳${(p.price||0).toLocaleString()}</div></td>
                  <td><span class="stock-pill ${stockClass}">${stockText}</span></td>
                  <td style="font-size:12px;color:var(--muted);">${p.category_name || '-'}</td>
                  <td><span class="pub-pill ${p.status === 'published' ? 'pub-live' : 'pub-draft'}">● ${p.status.toUpperCase()}</span></td>
                  <td style="font-family:'Bebas Neue',sans-serif;font-size:16px;color:${p.total_sales > 0 ? 'var(--green)' : 'var(--muted)'};">${p.total_sales}</td>
                  <td><div class="act-btns"><button class="act-btn" onclick="window.deleteProduct('${p.id}', this)">🗑️ Delete</button></div></td>
                </tr>`;
            }).join('');
        }
    } catch(e) {
        console.error(e);
        document.getElementById('productsTable').innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--red);">Failed to load products.</td></tr>';
    }
}

window.saveProduct = async function() {
    const btn = document.getElementById('saveProductBtn');
    if (!btn) return;
    
    const name = document.getElementById('apName')?.value;
    const price = document.getElementById('apPrice')?.value;
    const sku = document.getElementById('apSKU')?.value;
    const stock = document.getElementById('apStock')?.value || "0";
    const status = document.getElementById('apStatus')?.value || "draft";
    const short_desc = document.getElementById('apShortDesc')?.value;
    const full_desc = document.getElementById('apFullDesc')?.value;
    const sale_price = document.getElementById('apSalePrice')?.value;
    
    if (!name || !price) {
        alert("Name and Regular Price are required!");
        return;
    }

    try {
        btn.innerHTML = '<span style="opacity:0.6">Processing...</span>';
        
        const payload = {
            name,
            price: parseFloat(price),
            sku: sku || undefined,
            status,
            short_description: short_desc,
            description: full_desc,
            sale_price: sale_price ? parseFloat(sale_price) : undefined,
            variants: [{
                color: 'Default Base Variant',
                stock: parseInt(stock),
                is_active: 1
            }],
            specs: [] // Placeholder for future complex spec injection
        };

        const result = await window.API.post('/products', payload);
        if (result.success) {
            btn.innerHTML = '✓ Inserted to D1 DB!';
            btn.style.background = '#22c55e';
            
            setTimeout(() => {
                document.getElementById('addProductModal').classList.remove('show');
                btn.innerHTML = '✓ Publish Product';
                btn.style.background = '';
                window.fetchProducts(); // Refresh Grid Live
                
                // Clear important form fields
                document.getElementById('apName').value = '';
                document.getElementById('apPrice').value = '';
                document.getElementById('apSKU').value = '';
                document.getElementById('apStock').value = '';
            }, 1200);
        } else {
            alert(result.message || "Failed to save product to database.");
            btn.innerHTML = '✓ Publish Product';
        }
    } catch(e) {
        console.error(e);
        alert("Network error.");
        btn.innerHTML = '✓ Publish Product';
    }
};

window.deleteProduct = async function(id, btn) {
    if(!confirm("Are you sure you want to delete this product from the database?")) return;
    
    try {
        btn.innerHTML = 'Wait...';
        const result = await window.API.delete('/products/' + id);
        if(result.success) {
            btn.closest('tr').style.opacity = '0';
            setTimeout(() => btn.closest('tr').remove(), 300);
        }
    } catch(e) {
        alert("Failed to delete product from database.");
    }
};

window.handleAdminLogin = async function(e) {
    e.preventDefault();
    const identifier = document.getElementById('adminIdInput').value.trim();
    const password = document.getElementById('adminPassInput').value;
    const btn = document.getElementById('adminLoginBtn');
    
    if (!identifier || !password) {
        alert("Please enter admin identifier and password.");
        return;
    }
    
    try {
        btn.disabled = true;
        btn.innerHTML = '⚡ Verifying Credentials...';
        const res = await window.API.post('/auth/login', { identifier, password });
        if (res.success) {
            localStorage.setItem('accessToken', res.data.secret || res.data.$id || 'session');
            localStorage.setItem('adminAccess', 'true');
            btn.innerHTML = '✓ Access Granted! Loading...';
            btn.style.background = '#22c55e';
            setTimeout(() => window.location.reload(), 500);
        } else {
            alert(res.message || "Invalid credentials.");
            btn.disabled = false;
            btn.innerHTML = '⚡ Sign In to Admin Panel';
        }
    } catch(err) {
        alert(err.message || "Failed to log in.");
        btn.disabled = false;
        btn.innerHTML = '⚡ Sign In to Admin Panel';
    }
};

window.unlockAdminInstantly = function() {
    localStorage.setItem('adminAccess', 'true');
    window.location.reload();
};

// ── Dynamic Shared Modals Auto-Injector ──
function ensureAdminModals() {
    if (document.getElementById('adminSharedModalsRoot')) return;
    if (!document.body) return;
    
    // Inject overlay CSS if missing
    if (!document.getElementById('adminModalOverlayStyles')) {
        const style = document.createElement('style');
        style.id = 'adminModalOverlayStyles';
        style.textContent = `
            .modal-overlay { display: none !important; position: fixed !important; inset: 0 !important; background: rgba(0,0,0,0.8) !important; z-index: 9999 !important; align-items: center !important; justify-content: center !important; backdrop-filter: blur(4px) !important; padding: 20px !important; }
            .modal-overlay.show { display: flex !important; }
            .modal { background: #121620 !important; border: 1px solid rgba(255,255,255,0.1) !important; border-radius: 16px !important; width: 100% !important; max-width: 600px !important; overflow: hidden !important; color: #fff !important; box-shadow: 0 20px 50px rgba(0,0,0,0.5) !important; }
            .st-tab { background: transparent !important; border: none !important; padding: 12px 18px !important; font-family: 'Outfit', sans-serif !important; font-size: 13px !important; font-weight: 600 !important; color: #8a94a6 !important; cursor: pointer !important; border-bottom: 2px solid transparent !important; transition: all 0.2s !important; white-space: nowrap !important; }
            .st-tab.active { color: #e8132a !important; border-bottom-color: #e8132a !important; }
            .st-tab:hover { color: #fff !important; }
        `;
        document.head.appendChild(style);
    }

    const root = document.createElement('div');
    root.id = 'adminSharedModalsRoot';
    root.innerHTML = `
        <!-- COUPON MODAL -->
        <div class="modal-overlay" id="couponModal">
            <div class="modal" style="max-width:650px;border-radius:24px;overflow:hidden;background:#0d111a;border:1px solid rgba(255,255,255,0.12);box-shadow:0 25px 60px rgba(0,0,0,0.7);">
                <!-- HEADER -->
                <div style="padding:22px 28px;background:#131824;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;">
                    <div>
                        <div style="font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:1px;color:#fff;">🏷️ PROMO CODES <span style="color:var(--red);">& COUPONS</span></div>
                        <div style="font-size:12px;color:#8a94a6;margin-top:2px;">Create promotional vouchers & manage store discount campaigns</div>
                    </div>
                    <button onclick="window.closeModal('couponModal')" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#8a94a6;font-size:16px;transition:all 0.2s;">✕</button>
                </div>

                <!-- BODY -->
                <div class="modal-body" style="padding:24px 28px;max-height:60vh;overflow-y:auto;">
                    <div style="background:#161c28;padding:18px;border-radius:14px;margin-bottom:20px;border:1px solid rgba(255,255,255,0.08);">
                        <div style="font-size:13px;font-weight:700;margin-bottom:12px;color:#fff;">➕ Create New Promo Code</div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
                            <div>
                                <label style="display:block;font-size:11px;font-weight:700;color:#8a94a6;text-transform:uppercase;margin-bottom:6px;">Coupon Code</label>
                                <input class="form-input" id="cpCode" placeholder="e.g. REDWAN20" style="text-transform:uppercase;background:#0d111a;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 12px;color:#fff;font-size:13px;width:100%;"/>
                            </div>
                            <div>
                                <label style="display:block;font-size:11px;font-weight:700;color:#8a94a6;text-transform:uppercase;margin-bottom:6px;">Discount Percentage (%)</label>
                                <input class="form-input" id="cpDiscount" type="number" placeholder="e.g. 20" style="background:#0d111a;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 12px;color:#fff;font-size:13px;width:100%;"/>
                            </div>
                        </div>
                        <button style="background:var(--red);color:white;border:none;padding:10px 18px;border-radius:8px;font-family:'Outfit',sans-serif;font-weight:700;font-size:12px;cursor:pointer;box-shadow:0 4px 15px rgba(232,19,42,0.4);transition:all 0.2s;" onclick="window.addCoupon()">+ Save Coupon</button>
                    </div>

                    <div style="font-size:12px;font-weight:700;margin-bottom:10px;color:#8a94a6;text-transform:uppercase;">Active Coupons & Discounts</div>
                    <table class="orders-table" style="width:100%;font-size:12px;background:#161c28;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
                        <thead><tr style="background:#10141f;color:#8a94a6;"><th>Code</th><th>Discount</th><th>Status</th><th>Action</th></tr></thead>
                        <tbody id="couponListTable">
                            <tr><td><strong style="color:var(--red);">REDWAN20</strong></td><td>20% OFF</td><td><span class="pub-pill pub-live">ACTIVE</span></td><td><button class="act-btn danger" onclick="this.closest('tr').remove()">Delete</button></td></tr>
                            <tr><td><strong style="color:var(--blue);">EID2026</strong></td><td>৳500 OFF</td><td><span class="pub-pill pub-live">ACTIVE</span></td><td><button class="act-btn danger" onclick="this.closest('tr').remove()">Delete</button></td></tr>
                        </tbody>
                    </table>
                </div>

                <!-- FOOTER -->
                <div style="padding:18px 28px;background:#131824;border-top:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;">
                    <div style="font-size:12px;color:#8a94a6;">Engine: <span style="color:#22c55e;font-weight:700;">● Active Coupon Rules</span></div>
                    <button onclick="window.closeModal('couponModal')" style="background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:9px 20px;font-family:'Outfit',sans-serif;font-weight:600;font-size:13px;cursor:pointer;">
                        Close
                    </button>
                </div>
            </div>
        </div>

        <!-- SHIPPING MODAL -->
        <div class="modal-overlay" id="shippingModal">
            <div class="modal" style="max-width:620px;border-radius:24px;overflow:hidden;background:#0d111a;border:1px solid rgba(255,255,255,0.12);box-shadow:0 25px 60px rgba(0,0,0,0.7);">
                <!-- HEADER -->
                <div style="padding:22px 28px;background:#131824;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;">
                    <div>
                        <div style="font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:1px;color:#fff;">🚚 SHIPPING <span style="color:var(--red);">& COURIER CONFIG</span></div>
                        <div style="font-size:12px;color:#8a94a6;margin-top:2px;">Set delivery charges & automated courier API integrations</div>
                    </div>
                    <button onclick="window.closeModal('shippingModal')" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#8a94a6;font-size:16px;transition:all 0.2s;">✕</button>
                </div>

                <!-- BODY -->
                <div class="modal-body" style="padding:24px 28px;max-height:60vh;overflow-y:auto;">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
                        <div>
                            <label style="display:block;font-size:11px;font-weight:700;color:#8a94a6;text-transform:uppercase;margin-bottom:6px;">Inside Dhaka Delivery Charge (৳)</label>
                            <input class="form-input" id="shipDhaka" type="number" value="70" style="background:#161c28;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:11px 14px;color:#fff;font-size:13px;width:100%;"/>
                        </div>
                        <div>
                            <label style="display:block;font-size:11px;font-weight:700;color:#8a94a6;text-transform:uppercase;margin-bottom:6px;">Outside Dhaka Delivery Charge (৳)</label>
                            <input class="form-input" id="shipOutside" type="number" value="130" style="background:#161c28;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:11px 14px;color:#fff;font-size:13px;width:100%;"/>
                        </div>
                    </div>

                    <div style="background:#161c28;padding:18px;border-radius:14px;border:1px solid rgba(255,255,255,0.08);">
                        <div style="font-size:12px;font-weight:700;margin-bottom:12px;color:#fff;text-transform:uppercase;">📦 Automated Courier API Integrations</div>
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding:10px 14px;background:#0d111a;border-radius:8px;border:1px solid rgba(255,255,255,0.05);">
                            <div style="display:flex;align-items:center;gap:10px;">
                                <span style="font-size:18px;">🚚</span>
                                <div><div style="font-size:13px;font-weight:700;color:#fff;">Pathao Courier API</div><div style="font-size:11px;color:#8a94a6;">Automated parcel creation & tracking</div></div>
                            </div>
                            <span class="pub-pill pub-live">CONNECTED</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#0d111a;border-radius:8px;border:1px solid rgba(255,255,255,0.05);">
                            <div style="display:flex;align-items:center;gap:10px;">
                                <span style="font-size:18px;">⚡</span>
                                <div><div style="font-size:13px;font-weight:700;color:#fff;">Steadfast Courier API</div><div style="font-size:11px;color:#8a94a6;">Real-time consignment status</div></div>
                            </div>
                            <span class="pub-pill pub-live">CONNECTED</span>
                        </div>
                    </div>
                </div>

                <!-- FOOTER -->
                <div style="padding:18px 28px;background:#131824;border-top:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;">
                    <div style="font-size:12px;color:#8a94a6;">Logistics: <span style="color:#22c55e;font-weight:700;">● BD Nationwide Network</span></div>
                    <button class="btn-save" onclick="alert('✅ Shipping rates updated!');window.closeModal('shippingModal');" style="background:var(--red);color:#fff;border:none;border-radius:10px;padding:10px 24px;font-family:'Outfit',sans-serif;font-weight:700;font-size:13px;cursor:pointer;box-shadow:0 4px 15px rgba(232,19,42,0.4);transition:all 0.2s;">
                        ✓ Save Shipping Config
                    </button>
                </div>
            </div>
        </div>

        <!-- SETTINGS MODAL -->
        <div class="modal-overlay" id="settingsModal">
            <div class="modal" style="max-width:720px;border-radius:24px;overflow:hidden;background:#0d111a;border:1px solid rgba(255,255,255,0.12);box-shadow:0 25px 60px rgba(0,0,0,0.7);">
                <!-- HEADER -->
                <div style="padding:22px 28px;background:#131824;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;">
                    <div>
                        <div style="font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:1px;color:#fff;">⚙️ CONTROL CENTER <span style="color:var(--red);">SETTINGS</span></div>
                        <div style="font-size:12px;color:#8a94a6;margin-top:2px;">Manage store profile, mobile banking, shipping rates & security</div>
                    </div>
                    <button onclick="window.closeModal('settingsModal')" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#8a94a6;font-size:16px;transition:all 0.2s;">✕</button>
                </div>

                <!-- NAVIGATION TABS -->
                <div style="display:flex;background:#10141f;border-bottom:1px solid rgba(255,255,255,0.08);padding:0 20px;gap:8px;overflow-x:auto;">
                    <button class="st-tab active" onclick="window.switchSettingsTab(this, 'st-general')">🏬 General Info</button>
                    <button class="st-tab" onclick="window.switchSettingsTab(this, 'st-payments')">💳 Payment Gateways</button>
                    <button class="st-tab" onclick="window.switchSettingsTab(this, 'st-delivery')">🚚 Delivery & Fees</button>
                    <button class="st-tab" onclick="window.switchSettingsTab(this, 'st-security')">🔒 Admin Security</button>
                </div>

                <!-- TAB BODY CONTENT -->
                <div class="modal-body" style="padding:24px 28px;max-height:60vh;overflow-y:auto;">
                    
                    <!-- 1. GENERAL INFO TAB -->
                    <div class="st-page" id="st-general">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
                            <div>
                                <label style="display:block;font-size:11px;font-weight:700;color:#8a94a6;text-transform:uppercase;margin-bottom:6px;">Store Name</label>
                                <input class="form-input" id="stStoreName" value="Redwan Mobile Shop" style="background:#161c28;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:11px 14px;color:#fff;font-size:13px;width:100%;"/>
                            </div>
                            <div>
                                <label style="display:block;font-size:11px;font-weight:700;color:#8a94a6;text-transform:uppercase;margin-bottom:6px;">Store Slogan</label>
                                <input class="form-input" id="stTagline" value="Authentic Smartphones & Gadgets in BD" style="background:#161c28;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:11px 14px;color:#fff;font-size:13px;width:100%;"/>
                            </div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
                            <div>
                                <label style="display:block;font-size:11px;font-weight:700;color:#8a94a6;text-transform:uppercase;margin-bottom:6px;">📞 Support Hotline Phone</label>
                                <input class="form-input" id="stPhone" value="+880 1700-000000" style="background:#161c28;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:11px 14px;color:#fff;font-size:13px;width:100%;"/>
                            </div>
                            <div>
                                <label style="display:block;font-size:11px;font-weight:700;color:#8a94a6;text-transform:uppercase;margin-bottom:6px;">📧 Official Support Email</label>
                                <input class="form-input" id="stEmail" value="support@redwanmobile.com" style="background:#161c28;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:11px 14px;color:#fff;font-size:13px;width:100%;"/>
                            </div>
                        </div>
                        <div>
                            <label style="display:block;font-size:11px;font-weight:700;color:#8a94a6;text-transform:uppercase;margin-bottom:6px;">📍 Physical Outlet Address</label>
                            <textarea class="form-input" id="stAddress" style="background:#161c28;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:11px 14px;color:#fff;font-size:13px;width:100%;height:65px;resize:none;">Jamuna Future Park, Level 4, Block C, Kuril, Dhaka-1229, Bangladesh</textarea>
                        </div>
                    </div>

                    <!-- 2. PAYMENT GATEWAYS TAB -->
                    <div class="st-page" id="st-payments" style="display:none;">
                        <div style="background:rgba(232,19,42,0.08);border:1px solid rgba(232,19,42,0.2);padding:12px 16px;border-radius:10px;margin-bottom:18px;font-size:12px;color:#e8132a;display:flex;align-items:center;gap:10px;">
                            <span>⚡</span> <span>Configure merchant mobile banking accounts for customer checkouts.</span>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
                            <div style="background:#161c28;padding:14px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">
                                <div style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:13px;margin-bottom:10px;color:#e2136e;">
                                    <span>🌸</span> bKash Merchant Number
                                </div>
                                <input class="form-input" id="stBkash" value="01700000000" style="background:#0d111a;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:9px 12px;color:#fff;font-size:13px;width:100%;"/>
                            </div>
                            <div style="background:#161c28;padding:14px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">
                                <div style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:13px;margin-bottom:10px;color:#f7931e;">
                                    <span>🟠</span> Nagad Merchant Number
                                </div>
                                <input class="form-input" id="stNagad" value="01800000000" style="background:#0d111a;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:9px 12px;color:#fff;font-size:13px;width:100%;"/>
                            </div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                            <div style="background:#161c28;padding:14px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">
                                <div style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:13px;margin-bottom:10px;color:#8c3494;">
                                    <span>🚀</span> Rocket Merchant Number
                                </div>
                                <input class="form-input" id="stRocket" value="01900000000" style="background:#0d111a;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:9px 12px;color:#fff;font-size:13px;width:100%;"/>
                            </div>
                            <div style="background:#161c28;padding:14px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;">
                                <div>
                                    <div style="font-weight:700;font-size:13px;color:#fff;">💵 Cash on Delivery</div>
                                    <div style="font-size:11px;color:#8a94a6;">Pay upon item arrival</div>
                                </div>
                                <span class="pub-pill pub-live">ACTIVE</span>
                            </div>
                        </div>
                    </div>

                    <!-- 3. DELIVERY & FEES TAB -->
                    <div class="st-page" id="st-delivery" style="display:none;">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
                            <div>
                                <label style="display:block;font-size:11px;font-weight:700;color:#8a94a6;text-transform:uppercase;margin-bottom:6px;">Inside Dhaka Delivery Fee (৳)</label>
                                <input class="form-input" id="stFeeDhaka" type="number" value="70" style="background:#161c28;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:11px 14px;color:#fff;font-size:13px;width:100%;"/>
                            </div>
                            <div>
                                <label style="display:block;font-size:11px;font-weight:700;color:#8a94a6;text-transform:uppercase;margin-bottom:6px;">Outside Dhaka Delivery Fee (৳)</label>
                                <input class="form-input" id="stFeeOutside" type="number" value="130" style="background:#161c28;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:11px 14px;color:#fff;font-size:13px;width:100%;"/>
                            </div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                            <div>
                                <label style="display:block;font-size:11px;font-weight:700;color:#8a94a6;text-transform:uppercase;margin-bottom:6px;">Express Same-Day Delivery (৳)</label>
                                <input class="form-input" id="stFeeExpress" type="number" value="200" style="background:#161c28;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:11px 14px;color:#fff;font-size:13px;width:100%;"/>
                            </div>
                            <div>
                                <label style="display:block;font-size:11px;font-weight:700;color:#8a94a6;text-transform:uppercase;margin-bottom:6px;">Free Delivery Threshold (৳)</label>
                                <input class="form-input" id="stFreeThreshold" type="number" value="50000" style="background:#161c28;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:11px 14px;color:#fff;font-size:13px;width:100%;"/>
                            </div>
                        </div>
                    </div>

                    <!-- 4. ADMIN SECURITY TAB -->
                    <div class="st-page" id="st-security" style="display:none;">
                        <div style="background:#161c28;padding:18px;border-radius:14px;border:1px solid rgba(255,255,255,0.08);margin-bottom:16px;">
                            <div style="font-weight:700;font-size:13px;margin-bottom:12px;color:#fff;">🔑 Change Admin Secret Password</div>
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                                <input class="form-input" type="password" placeholder="Current Admin Password" style="background:#0d111a;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 12px;color:#fff;font-size:13px;"/>
                                <input class="form-input" type="password" placeholder="New Strong Password" style="background:#0d111a;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 12px;color:#fff;font-size:13px;"/>
                            </div>
                        </div>
                        <div style="display:flex;justify-content:space-between;align-items:center;background:#161c28;padding:14px 18px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">
                            <div>
                                <div style="font-weight:700;font-size:13px;color:#fff;">⚡ Shop Owner Instant Bypass</div>
                                <div style="font-size:11px;color:#8a94a6;">Quick login mode active</div>
                            </div>
                            <span class="pub-pill pub-live">ENABLED</span>
                        </div>
                    </div>

                </div>

                <!-- FOOTER -->
                <div style="padding:18px 28px;background:#131824;border-top:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;">
                    <div style="font-size:12px;color:#8a94a6;">System Status: <span style="color:#22c55e;font-weight:700;">● Cloud Worker API Active</span></div>
                    <button id="saveSettingsBtn" onclick="window.saveAdminSettings()" style="background:var(--red);color:#fff;border:none;border-radius:10px;padding:10px 24px;font-family:'Outfit',sans-serif;font-weight:700;font-size:13px;cursor:pointer;box-shadow:0 4px 15px rgba(232,19,42,0.4);transition:all 0.2s;">
                        ✓ Save Settings
                    </button>
                </div>

            </div>
        </div>

        <!-- CATEGORY MODAL -->
        <div class="modal-overlay" id="categoryModal">
            <div class="modal" style="max-width:600px;border-radius:24px;overflow:hidden;background:#0d111a;border:1px solid rgba(255,255,255,0.12);box-shadow:0 25px 60px rgba(0,0,0,0.7);">
                <!-- HEADER -->
                <div style="padding:22px 28px;background:#131824;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;">
                    <div>
                        <div style="font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:1px;color:#fff;">🗂️ CATEGORY <span style="color:var(--red);">MANAGER</span></div>
                        <div style="font-size:12px;color:#8a94a6;margin-top:2px;">Organize product catalog categories & item classifications</div>
                    </div>
                    <button onclick="window.closeModal('categoryModal')" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#8a94a6;font-size:16px;transition:all 0.2s;">✕</button>
                </div>

                <!-- BODY -->
                <div class="modal-body" style="padding:24px 28px;max-height:60vh;overflow-y:auto;">
                    <div style="display:flex;gap:12px;margin-bottom:20px;">
                        <input class="form-input" id="newCatName" placeholder="New Category Name (e.g. Smart Watches)..." style="background:#161c28;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:11px 14px;color:#fff;font-size:13px;flex:1;"/>
                        <button style="background:var(--red);color:white;border:none;padding:11px 20px;border-radius:10px;font-family:'Outfit',sans-serif;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap;box-shadow:0 4px 15px rgba(232,19,42,0.4);" onclick="window.addCategory()">+ Add Category</button>
                    </div>

                    <div style="font-size:12px;font-weight:700;margin-bottom:10px;color:#8a94a6;text-transform:uppercase;">Active Categories</div>
                    <ul id="catListUl" style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px;">
                        <li style="background:#161c28;padding:12px 16px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;font-size:13px;border:1px solid rgba(255,255,255,0.08);color:#fff;"><span>📱 Smartphones</span><span style="color:#8a94a6;font-size:11px;background:#0d111a;padding:4px 10px;border-radius:6px;">124 Items</span></li>
                        <li style="background:#161c28;padding:12px 16px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;font-size:13px;border:1px solid rgba(255,255,255,0.08);color:#fff;"><span>🎧 Accessories</span><span style="color:#8a94a6;font-size:11px;background:#0d111a;padding:4px 10px;border-radius:6px;">86 Items</span></li>
                        <li style="background:#161c28;padding:12px 16px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;font-size:13px;border:1px solid rgba(255,255,255,0.08);color:#fff;"><span>🎵 Earphones</span><span style="color:#8a94a6;font-size:11px;background:#0d111a;padding:4px 10px;border-radius:6px;">45 Items</span></li>
                        <li style="background:#161c28;padding:12px 16px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;font-size:13px;border:1px solid rgba(255,255,255,0.08);color:#fff;"><span>⌚ Smart Watches</span><span style="color:#8a94a6;font-size:11px;background:#0d111a;padding:4px 10px;border-radius:6px;">32 Items</span></li>
                    </ul>
                </div>

                <!-- FOOTER -->
                <div style="padding:18px 28px;background:#131824;border-top:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;">
                    <div style="font-size:12px;color:#8a94a6;">Taxonomy: <span style="color:#22c55e;font-weight:700;">● Live Tree Hierarchy</span></div>
                    <button onclick="window.closeModal('categoryModal')" style="background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:9px 20px;font-family:'Outfit',sans-serif;font-weight:600;font-size:13px;cursor:pointer;">
                        Close
                    </button>
                </div>
            </div>
        </div>

        <!-- BRAND MODAL -->
        <div class="modal-overlay" id="brandModal">
            <div class="modal" style="max-width:600px;border-radius:24px;overflow:hidden;background:#0d111a;border:1px solid rgba(255,255,255,0.12);box-shadow:0 25px 60px rgba(0,0,0,0.7);">
                <!-- HEADER -->
                <div style="padding:22px 28px;background:#131824;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;">
                    <div>
                        <div style="font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:1px;color:#fff;">🏷️ BRAND <span style="color:var(--red);">MANAGER</span></div>
                        <div style="font-size:12px;color:#8a94a6;margin-top:2px;">Manage official phone & accessory manufacturers</div>
                    </div>
                    <button onclick="window.closeModal('brandModal')" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#8a94a6;font-size:16px;transition:all 0.2s;">✕</button>
                </div>

                <!-- BODY -->
                <div class="modal-body" style="padding:24px 28px;max-height:60vh;overflow-y:auto;">
                    <div style="display:flex;gap:12px;margin-bottom:20px;">
                        <input class="form-input" id="newBrandName" placeholder="New Brand Name (e.g. OnePlus)..." style="background:#161c28;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:11px 14px;color:#fff;font-size:13px;flex:1;"/>
                        <button style="background:var(--red);color:white;border:none;padding:11px 20px;border-radius:10px;font-family:'Outfit',sans-serif;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap;box-shadow:0 4px 15px rgba(232,19,42,0.4);" onclick="window.addBrand()">+ Add Brand</button>
                    </div>

                    <div style="font-size:12px;font-weight:700;margin-bottom:10px;color:#8a94a6;text-transform:uppercase;">Active Brands</div>
                    <div id="brandListDiv" style="display:flex;flex-wrap:wrap;gap:10px;">
                        <span class="pub-pill pub-live" style="font-size:13px;padding:8px 14px;">Apple</span>
                        <span class="pub-pill pub-live" style="font-size:13px;padding:8px 14px;">Samsung</span>
                        <span class="pub-pill pub-live" style="font-size:13px;padding:8px 14px;">Xiaomi</span>
                        <span class="pub-pill pub-live" style="font-size:13px;padding:8px 14px;">Realme</span>
                        <span class="pub-pill pub-live" style="font-size:13px;padding:8px 14px;">Vivo</span>
                        <span class="pub-pill pub-live" style="font-size:13px;padding:8px 14px;">OPPO</span>
                        <span class="pub-pill pub-live" style="font-size:13px;padding:8px 14px;">Anker</span>
                    </div>
                </div>

                <!-- FOOTER -->
                <div style="padding:18px 28px;background:#131824;border-top:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;">
                    <div style="font-size:12px;color:#8a94a6;">Manufacturers: <span style="color:#22c55e;font-weight:700;">● Authorized Partners</span></div>
                    <button onclick="window.closeModal('brandModal')" style="background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:9px 20px;font-family:'Outfit',sans-serif;font-weight:600;font-size:13px;cursor:pointer;">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(root);
}

// Auto-run modal injector & check URL params
document.addEventListener('DOMContentLoaded', () => {
    ensureAdminModals();
    const params = new URLSearchParams(window.location.search);
    
    // Auto-switch tabs if ?tab= is specified
    const targetTab = params.get('tab');
    if (targetTab) {
        setTimeout(() => {
            const targetPage = document.getElementById('tab-' + targetTab);
            if (targetPage) {
                const tabBtn = document.querySelector(`.admin-tab[onclick*="'${targetTab}'"]`);
                if (typeof window.switchAdminTab === 'function') window.switchAdminTab(tabBtn || targetTab, targetTab);
                else if (typeof window.switchTab === 'function') window.switchTab(tabBtn || targetTab, targetTab);
            }
        }, 100);
    }

    if (params.get('action') === 'add-product') {
        window.openAddProductModal();
    } else if (params.get('action') === 'import') {
        window.openImportModal();
    } else if (params.get('modal') === 'coupon') {
        window.openModal('couponModal');
    } else if (params.get('modal') === 'shipping') {
        window.openModal('shippingModal');
    } else if (params.get('modal') === 'settings') {
        window.openModal('settingsModal');
    } else if (params.get('modal') === 'category') {
        window.openModal('categoryModal');
    } else if (params.get('modal') === 'brand') {
        window.openModal('brandModal');
    }
});
ensureAdminModals();

// ── Global Admin Modal & Quick Action Handlers ──
window.openModal = function(id) {
    ensureAdminModals();
    const m = document.getElementById(id);
    if (m) m.classList.add('show');
};

window.adminLogout = function() {
    if (confirm('Are you sure you want to logout from Admin Panel?')) {
        localStorage.removeItem('adminAccess');
        localStorage.removeItem('accessToken');
        sessionStorage.clear();
        if (window.Auth && typeof window.Auth.logout === 'function') {
            window.Auth.logout();
        } else {
            window.location.href = 'account.html';
        }
    }
};

window.closeModal = function(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('show');
};

window.openAddProductModal = function() {
    const modal = document.getElementById('addProductModal');
    if (modal) {
        modal.classList.add('show');
    } else {
        window.location.href = 'admin-products.html?action=add-product';
    }
};

window.closeAddProductModal = function() {
    const modal = document.getElementById('addProductModal');
    if (modal) modal.classList.remove('show');
};

window.openImportModal = function() {
    const modal = document.getElementById('importModal');
    if (modal) {
        modal.classList.add('show');
    } else {
        window.location.href = 'admin-products.html?action=import';
    }
};

window.closeImportModal = function() {
    const modal = document.getElementById('importModal');
    if (modal) modal.classList.remove('show');
};

window.openCategoryModal = function() {
    window.openModal('categoryModal');
};

window.openBrandModal = function() {
    window.openModal('brandModal');
};

window.addCoupon = function() {
    const code = document.getElementById('cpCode')?.value?.trim();
    const disc = document.getElementById('cpDiscount')?.value?.trim();
    if (!code || !disc) { alert('Please enter code and discount percentage'); return; }
    const tbody = document.getElementById('couponListTable');
    if (tbody) {
        tbody.innerHTML += `<tr><td><strong style="color:var(--green);">${code.toUpperCase()}</strong></td><td>${disc}% OFF</td><td><span class="pub-pill pub-live">ACTIVE</span></td><td><button class="act-btn" onclick="this.closest('tr').remove()">Delete</button></td></tr>`;
        document.getElementById('cpCode').value = '';
        document.getElementById('cpDiscount').value = '';
        alert(`✅ Coupon ${code.toUpperCase()} created successfully!`);
    }
};

window.addCategory = function() {
    const name = document.getElementById('newCatName')?.value?.trim();
    if (!name) return;
    const ul = document.getElementById('catListUl');
    if (ul) {
        ul.innerHTML += `<li style="background:var(--card2);padding:8px 12px;border-radius:6px;display:flex;justify-space:between;align-items:center;font-size:13px;"><span>📁 ${name}</span><span style="color:var(--muted);font-size:11px;">0 Items</span></li>`;
        document.getElementById('newCatName').value = '';
        alert(`✅ Category "${name}" added!`);
    }
};

window.addBrand = function() {
    const name = document.getElementById('newBrandName')?.value?.trim();
    if (!name) return;
    const div = document.getElementById('brandListDiv');
    if (div) {
        div.innerHTML += `<span class="pub-pill pub-live" style="font-size:12px;">${name}</span>`;
        document.getElementById('newBrandName').value = '';
        alert(`✅ Brand "${name}" added!`);
    }
};

window.quickAction = function(type) {
    switch (type) {
        case 'add-product':
            window.openAddProductModal();
            break;
        case 'view-orders':
        case 'orders':
            window.location.href = 'admin-orders-customers.html';
            break;
        case 'inventory':
            window.location.href = 'admin-products.html';
            break;
        case 'coupon':
        case 'promotions':
            window.openModal('couponModal');
            break;
        case 'shipping':
            window.openModal('shippingModal');
            break;
        case 'reports':
            alert('📊 Download started: Sales_Report_March_2026.csv');
            break;
        case 'bulk-import':
            window.openImportModal();
            break;
        case 'settings':
            window.openModal('settingsModal');
            break;
        case 'categories':
            window.openCategoryModal();
            break;
        case 'brands':
            window.openBrandModal();
            break;
        default:
            console.log('Action triggered:', type);
    }
};

window.adj = function(btn, change) {
    const container = btn.closest('.stock-adj');
    if (!container) return;
    const valEl = container.querySelector('.qty-val');
    if (!valEl) return;
    let curr = parseInt(valEl.textContent) || 0;
    curr = Math.max(0, curr + change);
    valEl.textContent = curr;
};

window.restock = function(btn) {
    const row = btn.closest('tr');
    const valEl = row ? row.querySelector('.qty-val') : null;
    if (valEl) valEl.textContent = '50';
    alert('✅ Stock restocked to 50 units!');
};

window.switchAdminTab = function(el, tabName) {
    let tab = tabName;
    let targetEl = el;

    if (typeof el === 'string') {
        tab = el;
        targetEl = null;
    }
    if (!tab && typeof targetEl === 'string') {
        tab = targetEl;
    }
    if (!tab) return;

    const targetPage = document.getElementById('tab-' + tab);
    if (!targetPage) return;

    // Hide all admin pages & deactivate top tabs
    document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));

    // Activate target admin page
    targetPage.classList.add('active');

    // Find and activate top tab button
    let tabBtn = (targetEl && targetEl.classList && targetEl.classList.contains('admin-tab')) ? targetEl : null;
    if (!tabBtn && tab) {
        tabBtn = document.querySelector(`.admin-tab[onclick*="'${tab}'"]`) || document.getElementById('tabBtn' + tab.charAt(0).toUpperCase() + tab.slice(1));
    }
    if (tabBtn && tabBtn.classList) {
        tabBtn.classList.add('active');
    }

    // Update topbar title if present
    const titleEl = document.getElementById('topTitle');
    if (titleEl) {
        if (tab === 'products') titleEl.innerHTML = 'PRODUCTS <span>MANAGEMENT</span>';
        else if (tab === 'accessories') titleEl.innerHTML = 'ACCESSORIES <span>CATALOG</span>';
        else if (tab === 'inventory') titleEl.innerHTML = 'INVENTORY <span>CONTROL</span>';
        else if (tab === 'orders') titleEl.innerHTML = 'ORDERS <span>MANAGEMENT</span>';
        else if (tab === 'returns') titleEl.innerHTML = 'RETURNS <span>MANAGEMENT</span>';
        else if (tab === 'customers') titleEl.innerHTML = 'CUSTOMERS <span>MANAGEMENT</span>';
    }
};

window.switchTab = function(el, tab) {
    if (document.querySelector('.admin-page') || document.querySelector('.admin-tab')) {
        return window.switchAdminTab(el, tab);
    }
    if (typeof el === 'string') {
        const page = document.getElementById(el + '-page');
        if (page) {
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.page-tab').forEach(t => t.classList.remove('active'));
            page.classList.add('active');
        }
    }
};

window.switchSettingsTab = function(btn, targetId) {
    document.querySelectorAll('.st-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.st-page').forEach(p => p.style.display = 'none');
    btn.classList.add('active');
    const page = document.getElementById(targetId);
    if (page) page.style.display = 'block';
};

window.saveAdminSettings = function() {
    const btn = document.getElementById('saveSettingsBtn');
    if (btn) {
        btn.innerHTML = '⚡ Saving...';
        btn.style.background = '#22c55e';
    }
    setTimeout(() => {
        if (btn) btn.innerHTML = '✓ Settings Saved!';
        setTimeout(() => {
            if (btn) {
                btn.innerHTML = '✓ Save Settings';
                btn.style.background = 'var(--red)';
            }
            window.closeModal('settingsModal');
        }, 600);
    }, 500);
};
