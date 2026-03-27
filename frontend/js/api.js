// ==========================================================
// js/api.js - Core API Fetch Wrapper for Redwan Mobile Shop
// ==========================================================

const API_BASE = "https://redwan-mobile-shop-api.fardinahamed178.workers.dev/api";

/**
 * Core generalized fetch wrapper
 */
async function apiFetch(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    
    // Set headers
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    // Attach JWT Token if valid
    const token = localStorage.getItem('accessToken');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(url, { ...options, headers });
        const text = await response.text();
        
        let data;
        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            data = { message: text };
        }

        if (!response.ok) {
            // Very simplistic auto-refresh for production
            if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/refresh') {
                console.warn("Token expired, trying to refresh...");
                return await tryRefreshAndRetry(endpoint, options);
            }
            throw new Error(data.message || `API Error: ${response.status}`);
        }
        
        return data;
    } catch (error) {
        console.error(`[API Error] ${endpoint}:`, error.message);
        throw error;
    }
}

/**
 * Attempts to automatically refresh JWT if expired, and replay request
 */
async function tryRefreshAndRetry(endpoint, options) {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
        if(window.logoutUser) window.logoutUser();
        throw new Error("Authentication required");
    }
    
    try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: refreshToken })
        });
        
        if (!res.ok) throw new Error("Refresh failed");
        
        const data = await res.json();
        localStorage.setItem('accessToken', data.accessToken);
        
        // Retry original request (relying on new accessToken in apiFetch)
        return await apiFetch(endpoint, options);
    } catch (e) {
        console.error("Session expired.");
        if(window.logoutUser) window.logoutUser();
        throw e;
    }
}

// ----------------------------------------------------
// Convenience Methods
// ----------------------------------------------------

window.API = {
    get: (endpoint) => apiFetch(endpoint, { method: 'GET' }),
    post: (endpoint, body) => apiFetch(endpoint, { method: 'POST', body: JSON.stringify(body) }),
    put: (endpoint, body) => apiFetch(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
    del: (endpoint) => apiFetch(endpoint, { method: 'DELETE' }),
    upload: async (endpoint, formData) => {
        // Form Data needs to let browser set boundary context
        const token = localStorage.getItem('accessToken');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await fetch(`${API_BASE}${endpoint}`, { method: 'POST', headers, body: formData });
        const json = await res.json();
        if(!res.ok) throw new Error(json.message);
        return json;
    }
};
