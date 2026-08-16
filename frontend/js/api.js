// ==========================================================
// js/api.js - Core Appwrite Cloud API Gateway
// Redwan Mobile Shop
// ==========================================================

/**
 * Direct Appwrite Cloud Bridge for Redwan Mobile Shop
 */
window.API = {
    get: async (endpoint) => {
        if (window.AppwriteService) {
            try {
                if (endpoint.startsWith('/promotions/flash-sale') || endpoint.startsWith('/search') || endpoint.startsWith('/products')) {
                    const res = await window.AppwriteService.getProducts();
                    if (res && res.documents) return { success: true, data: res.documents };
                } else if (endpoint.startsWith('/categories')) {
                    const res = await window.AppwriteService.getCategories();
                    if (res && res.documents) return { success: true, data: res.documents };
                } else if (endpoint.startsWith('/brands')) {
                    const res = await window.AppwriteService.getBrands();
                    if (res && res.documents) return { success: true, data: res.documents };
                } else if (endpoint.startsWith('/banners')) {
                    const res = await window.AppwriteService.getBanners();
                    if (res && res.documents) return { success: true, data: res.documents };
                } else if (endpoint.startsWith('/auth/me')) {
                    const user = await window.AppwriteService.getCurrentUser();
                    if (user) return { success: true, data: user };
                } else if (endpoint.startsWith('/orders')) {
                    const user = await window.AppwriteService.getCurrentUser();
                    if (user) {
                        const res = await window.AppwriteService.getUserOrders(user.$id);
                        if (res && res.documents) return { success: true, data: res.documents };
                    }
                } else if (endpoint.startsWith('/wishlist')) {
                    const user = await window.AppwriteService.getCurrentUser();
                    if (user) {
                        const res = await window.AppwriteService.getUserWishlist(user.$id);
                        if (res && res.documents) return { success: true, data: res.documents };
                    }
                } else if (endpoint.startsWith('/cart')) {
                    const localCart = JSON.parse(localStorage.getItem('appwrite_cart') || '{"items":[],"subtotal":0}');
                    return { success: true, data: localCart };
                }
            } catch (e) {
                console.warn('Appwrite fetch notice:', e.message);
            }
        }
        return { success: true, data: [] };
    },

    post: async (endpoint, body = {}) => {
        if (window.AppwriteService) {
            try {
                if (endpoint === '/auth/login') {
                    const session = await window.AppwriteService.login(body.email || body.phone || body.identifier, body.password);
                    return { success: true, data: session };
                } else if (endpoint === '/auth/register') {
                    const user = await window.AppwriteService.register(body.email, body.password, body.name, body.phone);
                    return { success: true, data: user };
                } else if (endpoint === '/orders') {
                    const order = await window.AppwriteService.createOrder(body.orderData || body, body.items || []);
                    return { success: true, data: order };
                } else if (endpoint === '/wishlist') {
                    const user = await window.AppwriteService.getCurrentUser();
                    if (user) {
                        const item = await window.AppwriteService.addToWishlist(user.$id, body.product_id);
                        return { success: true, data: item };
                    }
                } else if (endpoint === '/cart') {
                    localStorage.setItem('appwrite_cart', JSON.stringify(body));
                    return { success: true, data: body };
                } else if (endpoint.startsWith('/payment/initiate')) {
                    const res = await window.AppwriteService.initiatePayment(body.gateway, body.orderId, body.amount, body.customerInfo);
                    return { success: true, data: res };
                }
            } catch (e) {
                console.warn('Appwrite post notice:', e.message);
                throw e;
            }
        }
        return { success: true, data: body };
    },

    put: async (endpoint, body = {}) => {
        if (endpoint.startsWith('/cart')) {
            localStorage.setItem('appwrite_cart', JSON.stringify(body));
        }
        return { success: true, data: body };
    },

    del: async (endpoint) => {
        if (window.AppwriteService && endpoint.startsWith('/wishlist/')) {
            const docId = endpoint.split('/')[2];
            if (docId) {
                await window.AppwriteService.removeFromWishlist(docId);
            }
        }
        return { success: true };
    },

    upload: async (bucketId, file) => {
        if (window.AppwriteService) {
            return await window.AppwriteService.uploadImage(bucketId || 'product-images', file);
        }
        throw new Error("Appwrite Storage Service unavailable");
    }
};
