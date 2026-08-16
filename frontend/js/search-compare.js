// ==========================================================
// js/search-compare.js - Global Search & Product Comparison Engine
// Redwan Mobile Shop
// ==========================================================

const MasterCatalog = [
    { id: 'prod_s25u', name: 'Galaxy S25 Ultra', brand: 'Samsung', price: 119999, oldPrice: 129999, display: '6.9" QHD+ Dynamic AMOLED 120Hz', processor: 'Snapdragon 8 Elite (3nm)', camera: '200MP Quad Camera + S Pen', battery: '5000mAh (45W Fast Charging)', ram: '12GB', storage: '256GB', network: '5G', icon: '📱' },
    { id: 'prod_ip16', name: 'iPhone 16 Pro Max', brand: 'Apple', price: 174999, oldPrice: 189999, display: '6.9" Super Retina XDR OLED', processor: 'Apple A18 Pro (3nm)', camera: '48MP Triple Fusion Camera', battery: '4685mAh (MagSafe Fast Charge)', ram: '8GB', storage: '256GB', network: '5G', icon: '📱' },
    { id: 'prod_a55', name: 'Galaxy A55 5G', brand: 'Samsung', price: 37499, oldPrice: 49999, display: '6.6" FHD+ Super AMOLED 120Hz', processor: 'Exynos 1480 (4nm)', camera: '50MP OIS Triple Camera', battery: '5000mAh (25W Charging)', ram: '8GB', storage: '128GB', network: '5G', icon: '📱' },
    { id: 'prod_note13', name: 'Redmi Note 13 Pro+', brand: 'Xiaomi', price: 34999, oldPrice: 39999, display: '6.67" 1.5K Curved AMOLED 120Hz', processor: 'MediaTek Dimensity 7200 Ultra', camera: '200MP OIS Camera', battery: '5000mAh (120W HyperCharge)', ram: '12GB', storage: '256GB', network: '5G', icon: '📱' },
    { id: 'prod_rm12', name: 'Realme 12 Pro+', brand: 'Realme', price: 28999, oldPrice: 35499, display: '6.7" FHD+ Curved OLED 120Hz', processor: 'Snapdragon 7s Gen 2', camera: '50MP Sony IMX890 + Periscope', battery: '5000mAh (67W SUPERVOOC)', ram: '8GB', storage: '256GB', network: '5G', icon: '📱' },
    { id: 'prod_oppo12', name: 'Reno 12 Pro 5G', brand: 'OPPO', price: 44999, oldPrice: 49999, display: '6.7" Quad-Curved AMOLED 120Hz', processor: 'MediaTek Dimensity 7300-Energy', camera: '50MP AI Portrait Camera', battery: '5000mAh (80W SUPERVOOC)', ram: '12GB', storage: '256GB', network: '5G', icon: '📱' },
    { id: 'prod_op13', name: 'OnePlus 13', brand: 'OnePlus', price: 74999, oldPrice: 82999, display: '6.82" 2K 120Hz LTPO AMOLED', processor: 'Snapdragon 8 Elite', camera: '50MP Hasselblad Triple Camera', battery: '6000mAh (100W SUPERVOOC)', ram: '16GB', storage: '512GB', network: '5G', icon: '📱' },
    { id: 'prod_v40', name: 'Vivo V40 Pro', brand: 'Vivo', price: 49999, oldPrice: 54999, display: '6.78" 1.5K 3D Curved AMOLED', processor: 'MediaTek Dimensity 9200+', camera: '50MP ZEISS Multifocal Portrait', battery: '5500mAh (80W FlashCharge)', ram: '12GB', storage: '512GB', network: '5G', icon: '📱' }
];

window.MasterCatalog = MasterCatalog;

// ================= =========================================
// SEARCH ENGINE LOGIC
// ==========================================================

window.initSearch = function() {
    const searchInputs = document.querySelectorAll('.search-bar input, #searchInput, .big-search-input, .search-input');
    
    searchInputs.forEach(input => {
        if (input.dataset.searchBound) return;
        input.dataset.searchBound = "true";

        // Create Dropdown Container if needed for header search
        const parent = input.closest('.search-bar') || input.parentElement;
        let dropdown = parent.querySelector('.search-live-dropdown');
        if (!dropdown && (parent.classList.contains('search-bar') || parent.classList.contains('big-search'))) {
            dropdown = document.createElement('div');
            dropdown.className = 'search-live-dropdown';
            dropdown.style.cssText = `
                display: none; position: absolute; top: calc(100% + 8px); left: 0; right: 0;
                background: #141822; border: 1px solid rgba(255,255,255,0.12); border-radius: 12px;
                box-shadow: 0 15px 35px rgba(0,0,0,0.6); z-index: 9999; max-height: 350px; overflow-y: auto;
                padding: 8px; font-family: 'Outfit', sans-serif;
            `;
            parent.style.position = 'relative';
            parent.appendChild(dropdown);
        }

        // Handle typing event
        input.addEventListener('input', (e) => {
            const query = e.target.value.trim().toLowerCase();
            
            // If on wishlist-search page, filter page live
            if (document.getElementById('resultsGrid') && input.id === 'searchInput') {
                window.executeFilterSearch(query);
                return;
            }

            if (!dropdown) return;

            if (query.length < 2) {
                dropdown.style.display = 'none';
                return;
            }

            const matches = MasterCatalog.filter(p => 
                p.name.toLowerCase().includes(query) || 
                p.brand.toLowerCase().includes(query) ||
                p.network.toLowerCase().includes(query)
            );

            if (matches.length === 0) {
                dropdown.innerHTML = `<div style="padding:14px;text-align:center;color:#8a94a6;font-size:12px;">No products found for "${query}"</div>`;
            } else {
                dropdown.innerHTML = matches.slice(0, 5).map(p => `
                    <div class="search-drop-item" onclick="window.location.href='product-detail.html?id=${p.id}'" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:8px;cursor:pointer;transition:background 0.2s;margin-bottom:2px;" onmouseover="this.style.background='rgba(255,255,255,0.06)'" onmouseout="this.style.background='transparent'">
                        <div style="font-size:24px;">${p.icon}</div>
                        <div style="flex:1;">
                            <div style="font-size:13px;font-weight:600;color:#fff;">${p.name}</div>
                            <div style="font-size:11px;color:var(--red,#e8132a);">${p.brand} · ${p.network}</div>
                        </div>
                        <div style="font-family:'Bebas Neue',sans-serif;font-size:16px;color:#fff;">৳${p.price.toLocaleString()}</div>
                    </div>
                `).join('') + `
                    <div style="border-top:1px solid rgba(255,255,255,0.08);margin-top:6px;padding-top:6px;text-align:center;">
                        <a href="wishlist-search.html?tab=search&q=${encodeURIComponent(query)}" style="font-size:12px;color:var(--red,#e8132a);font-weight:700;text-decoration:none;">View all search results →</a>
                    </div>
                `;
            }
            dropdown.style.display = 'block';
        });

        // Submit search on Enter key
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const q = input.value.trim();
                if (q) {
                    window.location.href = `wishlist-search.html?tab=search&q=${encodeURIComponent(q)}`;
                }
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (dropdown && !parent.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    });
};

window.executeFilterSearch = function(queryStr) {
    const grid = document.getElementById('resultsGrid');
    if (!grid) return;

    const q = queryStr !== undefined ? queryStr.toLowerCase() : (document.getElementById('searchInput')?.value || '').toLowerCase();
    
    // Check checked brand filters
    const checkedBrands = Array.from(document.querySelectorAll('.filter-section input[type="checkbox"]:checked'))
        .map(cb => cb.nextElementSibling?.textContent?.split(' ')[0]?.trim())
        .filter(Boolean);

    const filtered = MasterCatalog.filter(p => {
        const matchesQuery = !q || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q);
        const matchesBrand = checkedBrands.length === 0 || checkedBrands.some(b => p.brand.toLowerCase().includes(b.toLowerCase()));
        return matchesQuery && matchesBrand;
    });

    // Update Query Text
    const qEl = document.querySelector('.search-query');
    if (qEl) qEl.innerHTML = `Results for <strong>"${q || 'All Products'}"</strong>`;
    
    const countEl = document.querySelector('.result-count');
    if (countEl) countEl.textContent = `${filtered.length} products found`;

    if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1;padding:60px 20px;text-align:center;color:#8a94a6;font-size:14px;">No products matching your search filters. <br/><a href="javascript:void(0)" onclick="window.clearFilters()" style="color:var(--red,#e8132a);font-weight:700;display:inline-block;margin-top:10px;">Clear All Filters</a></div>`;
        return;
    }

    grid.innerHTML = filtered.map(p => `
        <div class="result-card" onclick="window.location.href='product-detail.html?id=${p.id}'">
            <span class="rc-badge rc-badge-new">New</span>
            <button class="rc-wishlist" onclick="event.stopPropagation(); window.toggleWishlist('${p.id}', this)">♡</button>
            <div class="rc-img">${p.icon}</div>
            <div class="rc-body">
                <div class="rc-brand">${p.brand}</div>
                <div class="rc-name">${p.name}</div>
                <div class="rc-specs">
                    <span class="spec-tag">${p.network}</span>
                    <span class="spec-tag">${p.ram}</span>
                    <span class="spec-tag">${p.storage}</span>
                </div>
                <div><span class="rc-price">৳${p.price.toLocaleString()}</span>${p.oldPrice ? `<span class="rc-old">৳${p.oldPrice.toLocaleString()}</span>` : ''}</div>
            </div>
            <div class="rc-actions" style="display:flex;gap:6px;">
                <button class="rc-btn-cart" style="flex:1;" onclick="event.stopPropagation(); window.addToCart('${p.name}')">🛒 Add to Cart</button>
                <button class="btn-compare" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:6px;padding:6px 10px;font-size:11px;cursor:pointer;" onclick="event.stopPropagation(); window.toggleCompare('${p.id}', this)">⚖️ Compare</button>
            </div>
        </div>
    `).join('');
};

// Global doSearch wrapper for buttons
window.doSearch = function() {
    const q = document.getElementById('searchInput')?.value?.trim();
    if (q) {
        if (window.location.href.includes('wishlist-search.html')) {
            window.executeFilterSearch(q);
        } else {
            window.location.href = `wishlist-search.html?tab=search&q=${encodeURIComponent(q)}`;
        }
    }
};

// ==========================================================
// PRODUCT COMPARISON ENGINE LOGIC
// ==========================================================

window.getCompareItems = function() {
    try {
        return JSON.parse(localStorage.getItem('appwrite_compare_items') || '[]');
    } catch(e) {
        return [];
    }
};

window.saveCompareItems = function(items) {
    localStorage.setItem('appwrite_compare_items', JSON.stringify(items));
    window.renderCompareDock();
    window.renderCompareTable();
};

window.toggleCompare = function(productIdOrObj, btn) {
    let items = window.getCompareItems();
    let prod = typeof productIdOrObj === 'object' ? productIdOrObj : MasterCatalog.find(p => p.id === productIdOrObj);
    
    if (!prod && typeof productIdOrObj === 'string') {
        prod = { id: productIdOrObj, name: productIdOrObj, brand: 'Mobile', price: 0, display: 'HD Display', processor: 'Octa-Core', camera: '50MP', battery: '5000mAh', ram: '8GB', storage: '128GB', network: '5G', icon: '📱' };
    }

    if (!prod) return;

    const existsIndex = items.findIndex(i => i.id === prod.id || i.name === prod.name);

    if (existsIndex > -1) {
        items.splice(existsIndex, 1);
        if (btn) {
            btn.textContent = '⚖️ Compare';
            btn.style.background = '';
            btn.style.color = '';
        }
    } else {
        if (items.length >= 3) {
            alert('⚖️ Comparison list full! You can compare up to 3 products at a time.');
            return;
        }
        items.push(prod);
        if (btn) {
            btn.textContent = '✓ Comparing';
            btn.style.background = '#22c55e';
            btn.style.color = '#fff';
        }
    }

    window.saveCompareItems(items);
};

// Floating Compare Dock Widget
window.renderCompareDock = function() {
    const items = window.getCompareItems();
    let dock = document.getElementById('globalCompareDock');

    if (items.length === 0) {
        if (dock) dock.style.display = 'none';
        return;
    }

    if (!dock) {
        dock = document.createElement('div');
        dock.id = 'globalCompareDock';
        dock.style.cssText = `
            position: fixed; bottom: 24px; right: 24px; z-index: 9990;
            background: #111520; border: 1px solid rgba(232,19,42,0.4); border-radius: 16px;
            padding: 14px 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.8);
            display: flex; align-items: center; gap: 16px; backdrop-filter: blur(10px);
            font-family: 'Outfit', sans-serif; color: #fff;
        `;
        document.body.appendChild(dock);
    }

    dock.style.display = 'flex';
    dock.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:20px;">⚖️</span>
            <div>
                <div style="font-size:13px;font-weight:700;line-height:1.2;">Compare (${items.length}/3)</div>
                <div style="font-size:11px;color:#8a94a6;white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis;">
                    ${items.map(i => i.name).join(', ')}
                </div>
            </div>
        </div>
        <button onclick="window.goToComparison()" style="background:var(--red,#e8132a);color:white;border:none;border-radius:10px;padding:8px 16px;font-family:'Outfit',sans-serif;font-weight:700;font-size:12px;cursor:pointer;box-shadow:0 4px 15px rgba(232,19,42,0.4);transition:transform 0.2s;">
            Compare Now →
        </button>
        <button onclick="window.saveCompareItems([])" style="background:transparent;border:none;color:#8a94a6;font-size:14px;cursor:pointer;padding:4px;" title="Clear comparison list">✕</button>
    `;
};

window.goToComparison = function() {
    if (document.getElementById('compare')) {
        document.getElementById('compare').scrollIntoView({ behavior: 'smooth' });
    } else {
        window.location.href = 'index.html#compare';
    }
};

// Render Dynamic Specs Table into any #compare or #tab-compare container
window.renderCompareTable = function() {
    const items = window.getCompareItems();
    const compareContainers = [
        document.getElementById('compareTableContainer'),
        document.querySelector('#compare table')?.parentElement,
        document.getElementById('tab-compare')
    ].filter(Boolean);

    if (compareContainers.length === 0) return;

    // Use default products if list is empty
    const displayItems = items.length > 0 ? items : [MasterCatalog[0], MasterCatalog[1]];

    const tableHtml = `
        <div style="overflow-x:auto;width:100%;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;color:#fff;">
                <thead>
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.02);">
                        <th style="text-align:left;padding:14px 16px;color:#8a94a6;font-weight:600;min-width:120px;">Specification</th>
                        ${displayItems.map(item => `
                            <th style="padding:14px 16px;color:var(--red,#e8132a);font-weight:700;text-align:center;min-width:180px;">
                                <div style="font-size:28px;margin-bottom:6px;">${item.icon || '📱'}</div>
                                <div style="font-size:14px;color:#fff;">${item.name}</div>
                                <div style="font-size:11px;color:#8a94a6;font-weight:400;margin-top:2px;">${item.brand}</div>
                                <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:var(--red,#e8132a);margin-top:4px;">৳${(item.price||0).toLocaleString()}</div>
                                <button onclick="window.toggleCompare('${item.id}')" style="background:rgba(232,19,42,0.15);color:var(--red,#e8132a);border:1px solid rgba(232,19,42,0.3);border-radius:6px;padding:3px 10px;font-size:10px;margin-top:6px;cursor:pointer;">Remove</button>
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody>
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
                        <td style="padding:12px 16px;color:#8a94a6;font-weight:600;">Display</td>
                        ${displayItems.map(i => `<td style="padding:12px 16px;text-align:center;color:#fff;">${i.display || 'Full HD+ Display'}</td>`).join('')}
                    </tr>
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
                        <td style="padding:12px 16px;color:#8a94a6;font-weight:600;">Processor</td>
                        ${displayItems.map(i => `<td style="padding:12px 16px;text-align:center;color:#fff;">${i.processor || 'Octa-Core'}</td>`).join('')}
                    </tr>
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
                        <td style="padding:12px 16px;color:#8a94a6;font-weight:600;">Camera</td>
                        ${displayItems.map(i => `<td style="padding:12px 16px;text-align:center;color:#fff;">${i.camera || 'High Resolution'}</td>`).join('')}
                    </tr>
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
                        <td style="padding:12px 16px;color:#8a94a6;font-weight:600;">Battery & Charge</td>
                        ${displayItems.map(i => `<td style="padding:12px 16px;text-align:center;color:#fff;">${i.battery || '5000mAh'}</td>`).join('')}
                    </tr>
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
                        <td style="padding:12px 16px;color:#8a94a6;font-weight:600;">RAM / Storage</td>
                        ${displayItems.map(i => `<td style="padding:12px 16px;text-align:center;color:#fff;">${i.ram || '8GB'} / ${i.storage || '128GB'}</td>`).join('')}
                    </tr>
                    <tr>
                        <td style="padding:12px 16px;color:#8a94a6;font-weight:600;">Network</td>
                        ${displayItems.map(i => `<td style="padding:12px 16px;text-align:center;color:#22c55e;font-weight:700;">${i.network || '5G'} Ready</td>`).join('')}
                    </tr>
                    <tr>
                        <td style="padding:16px;"></td>
                        ${displayItems.map(i => `
                            <td style="padding:16px;text-align:center;">
                                <button onclick="window.addToCart('${i.name}')" style="background:var(--red,#e8132a);color:#fff;border:none;border-radius:8px;padding:8px 16px;font-weight:700;font-size:12px;cursor:pointer;">🛒 Buy Now</button>
                            </td>
                        `).join('')}
                    </tr>
                </tbody>
            </table>
        </div>
    `;

    compareContainers.forEach(container => {
        container.innerHTML = tableHtml;
    });
};

// Auto Initialize on DOM Load
document.addEventListener('DOMContentLoaded', () => {
    window.initSearch();
    window.renderCompareDock();
    window.renderCompareTable();

    // Bind compare buttons on existing static cards
    document.querySelectorAll('.btn-compare, .btn-outline').forEach((btn, index) => {
        if (btn.textContent.includes('Compare')) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = btn.closest('.product-card') || btn.closest('.result-card');
                const name = card?.querySelector('.card-name, .rc-name')?.textContent || MasterCatalog[index % MasterCatalog.length].name;
                const match = MasterCatalog.find(m => m.name.toLowerCase().includes(name.toLowerCase())) || MasterCatalog[index % MasterCatalog.length];
                window.toggleCompare(match, btn);
            });
        }
    });

    // Check URL parameters for search query
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) {
        const searchInp = document.getElementById('searchInput');
        if (searchInp) searchInp.value = q;
        window.executeFilterSearch(q);
    }
});
