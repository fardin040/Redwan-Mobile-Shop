// ==========================================================
// js/admin.js - Admin Dashboard & Catalog Logic
// ==========================================================

(async () => {
    // 1. Update Date (Immediate visual canary)
    const dateEl = document.getElementById('currentDate');
    if (dateEl) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateEl.textContent = '📅 ' + new Intl.DateTimeFormat('en-US', options).format(new Date());
    }
    
    // 2. Check Auth (Requires Admin)
    if (window.Auth && typeof window.Auth.init === 'function') {
        await window.Auth.init();
    }

    if (!window.Auth || !window.Auth.user || window.Auth.user.role !== 'admin') {
        console.warn('[AdminJS] Access Denied: User not admin or not logged in.');
        document.body.innerHTML = `
            <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;background:#09090b;color:white;font-family:'Outfit',sans-serif;">
                <div style="font-size:48px;margin-bottom:20px;">🔒</div>
                <h2 style="font-family:'Bebas Neue',sans-serif;font-size:32px;letter-spacing:1px;margin-bottom:10px;">ACCESS <span style="color:#E8132A;">DENIED</span></h2>
                <p style="color:#777;margin-bottom:30px;font-size:14px;">You must have Administrator privileges to view this area.</p>
                <a href="/account.html" style="background:#E8132A;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Return to Account</a>
            </div>
        `;
        return;
    }

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
