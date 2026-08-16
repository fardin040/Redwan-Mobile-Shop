// ==========================================================
// js/appwrite-client.js — Appwrite SDK Client & Integration
// Redwan Mobile Shop
// ==========================================================

const APPWRITE_CONFIG = {
    ENDPOINT: 'https://cloud.appwrite.io/v1',
    PROJECT_ID: 'YOUR_PROJECT_ID', // Replace with your Appwrite Project ID
    DATABASE_ID: 'redwan_shop',
    COLLECTIONS: {
        PRODUCTS: 'products',
        VARIANTS: 'product_variants',
        CATEGORIES: 'categories',
        BRANDS: 'brands',
        ORDERS: 'orders',
        ORDER_ITEMS: 'order_items',
        REVIEWS: 'reviews',
        WISHLIST: 'wishlist',
        COUPONS: 'coupons',
        BANNERS: 'banners'
    },
    BUCKETS: {
        PRODUCT_IMAGES: 'product-images',
        BANNERS: 'banners',
        AVATARS: 'avatars'
    }
};

// Initialize Appwrite Client if SDK is loaded
let client, account, databases, storage, functions;

if (typeof Appwrite !== 'undefined') {
    client = new Appwrite.Client()
        .setEndpoint(APPWRITE_CONFIG.ENDPOINT)
        .setProject(APPWRITE_CONFIG.PROJECT_ID);

    account = new Appwrite.Account(client);
    databases = new Appwrite.Databases(client);
    storage = new Appwrite.Storage(client);
    functions = new Appwrite.Functions(client);
} else {
    console.warn("⚠️ Appwrite Web SDK script not loaded. Include https://cdn.jsdelivr.net/npm/appwrite@14.0.1 in HTML.");
}

// ----------------------------------------------------
// Appwrite API Wrapper Object
// ----------------------------------------------------
window.AppwriteService = {
    // ── Authentication Methods ─────────────────────────
    async register(email, password, name, phone) {
        const user = await account.create(Appwrite.ID.unique(), email, password, name);
        await account.createEmailPasswordSession(email, password);
        return user;
    },

    async login(email, password) {
        return await account.createEmailPasswordSession(email, password);
    },

    async sendSMSOTP(phone) {
        return await account.createPhoneToken(Appwrite.ID.unique(), phone);
    },

    async verifySMSOTP(userId, secret) {
        return await account.createSession(userId, secret);
    },

    async getCurrentUser() {
        try {
            return await account.get();
        } catch {
            return null;
        }
    },

    async logout() {
        return await account.deleteSession('current');
    },

    // ── Product Methods ────────────────────────────────
    async getProducts(queries = []) {
        return await databases.listDocuments(
            APPWRITE_CONFIG.DATABASE_ID,
            APPWRITE_CONFIG.COLLECTIONS.PRODUCTS,
            queries
        );
    },

    async getProductById(productId) {
        return await databases.getDocument(
            APPWRITE_CONFIG.DATABASE_ID,
            APPWRITE_CONFIG.COLLECTIONS.PRODUCTS,
            productId
        );
    },

    async getBanners() {
        return await databases.listDocuments(
            APPWRITE_CONFIG.DATABASE_ID,
            APPWRITE_CONFIG.COLLECTIONS.BANNERS,
            [Appwrite.Query.equal('is_active', true)]
        );
    },

    // ── Orders & Checkout ──────────────────────────────
    async createOrder(orderData, items) {
        const order = await databases.createDocument(
            APPWRITE_CONFIG.DATABASE_ID,
            APPWRITE_CONFIG.COLLECTIONS.ORDERS,
            Appwrite.ID.unique(),
            orderData
        );

        for (const item of items) {
            await databases.createDocument(
                APPWRITE_CONFIG.DATABASE_ID,
                APPWRITE_CONFIG.COLLECTIONS.ORDER_ITEMS,
                Appwrite.ID.unique(),
                { ...item, order_id: order.$id }
            );
        }

        return order;
    },

    // ── File Storage Helper ────────────────────────────
    getFilePreview(bucketId, fileId) {
        return `${APPWRITE_CONFIG.ENDPOINT}/storage/buckets/${bucketId}/files/${fileId}/view?project=${APPWRITE_CONFIG.PROJECT_ID}`;
    },

    async uploadImage(bucketId, file) {
        return await storage.createFile(bucketId, Appwrite.ID.unique(), file);
    },

    // ── Serverless Functions (Payments) ────────────────
    async initiatePayment(gateway, orderId, amount, customerInfo) {
        const response = await functions.createExecution(
            'payment-handler',
            JSON.stringify({ gateway, orderId, amount, customerInfo })
        );
        return JSON.parse(response.responseBody);
    }
};
