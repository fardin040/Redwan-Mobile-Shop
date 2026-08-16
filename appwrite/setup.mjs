import { Client, Databases, Storage, Permission, Role } from 'node-appwrite';
import dotenv from 'dotenv';

dotenv.config();

const ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;

if (!PROJECT_ID || !API_KEY) {
    console.error('❌ Error: APPWRITE_PROJECT_ID and APPWRITE_API_KEY must be set in environment variables or .env file.');
    process.exit(1);
}

const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

const databases = new Databases(client);
const storage = new Storage(client);

const DB_ID = 'redwan_shop';

async function initSchema() {
    console.log('🚀 Starting Appwrite Database & Collections Setup for Redwan Mobile Shop...');

    // 1. Create Database
    try {
        await databases.get(DB_ID);
        console.log(`✅ Database "${DB_ID}" already exists.`);
    } catch (e) {
        await databases.create(DB_ID, 'Redwan Mobile Shop Database');
        console.log(`✅ Created Database "${DB_ID}".`);
    }

    // Helper to create collection if it doesn't exist
    async function ensureCollection(id, name, permissions = []) {
        try {
            await databases.getCollection(DB_ID, id);
            console.log(`  🔹 Collection "${id}" already exists.`);
        } catch (e) {
            await databases.createCollection(DB_ID, id, name, permissions);
            console.log(`  ✨ Created Collection "${name}" (${id}).`);
        }
    }

    // 2. Define Collections
    console.log('\n📦 Setting up Collections...');
    
    // Brands
    await ensureCollection('brands', 'Brands', [
        Permission.read(Role.any()),
        Permission.create(Role.label('admin')),
        Permission.update(Role.label('admin')),
        Permission.delete(Role.label('admin')),
    ]);

    // Categories
    await ensureCollection('categories', 'Categories', [
        Permission.read(Role.any()),
        Permission.create(Role.label('admin')),
        Permission.update(Role.label('admin')),
        Permission.delete(Role.label('admin')),
    ]);

    // Products
    await ensureCollection('products', 'Products', [
        Permission.read(Role.any()),
        Permission.create(Role.label('admin')),
        Permission.update(Role.label('admin')),
        Permission.delete(Role.label('admin')),
    ]);

    // Product Variants
    await ensureCollection('product_variants', 'Product Variants', [
        Permission.read(Role.any()),
        Permission.create(Role.label('admin')),
        Permission.update(Role.label('admin')),
        Permission.delete(Role.label('admin')),
    ]);

    // Product Specs
    await ensureCollection('product_specs', 'Product Specs', [
        Permission.read(Role.any()),
        Permission.create(Role.label('admin')),
        Permission.update(Role.label('admin')),
        Permission.delete(Role.label('admin')),
    ]);

    // Orders
    await ensureCollection('orders', 'Orders', [
        Permission.create(Role.users()),
        Permission.read(Role.users()),
        Permission.update(Role.label('admin')),
    ]);

    // Order Items
    await ensureCollection('order_items', 'Order Items', [
        Permission.create(Role.users()),
        Permission.read(Role.users()),
    ]);

    // Reviews
    await ensureCollection('reviews', 'Reviews', [
        Permission.read(Role.any()),
        Permission.create(Role.users()),
        Permission.update(Role.label('admin')),
    ]);

    // Wishlist
    await ensureCollection('wishlist', 'Wishlist', [
        Permission.read(Role.users()),
        Permission.create(Role.users()),
        Permission.delete(Role.users()),
    ]);

    // Coupons
    await ensureCollection('coupons', 'Coupons', [
        Permission.read(Role.any()),
        Permission.create(Role.label('admin')),
        Permission.update(Role.label('admin')),
    ]);

    // Banners
    await ensureCollection('banners', 'Banners', [
        Permission.read(Role.any()),
        Permission.create(Role.label('admin')),
        Permission.update(Role.label('admin')),
    ]);

    // 3. Create Storage Buckets
    console.log('\n🗄️ Setting up Storage Buckets...');
    const buckets = [
        { id: 'product-images', name: 'Product Images' },
        { id: 'banners', name: 'Banners' },
        { id: 'avatars', name: 'User Avatars' }
    ];

    for (const b of buckets) {
        try {
            await storage.getBucket(b.id);
            console.log(`  🔹 Bucket "${b.id}" already exists.`);
        } catch (e) {
            await storage.createBucket(
                b.id,
                b.name,
                [Permission.read(Role.any()), Permission.create(Role.users())],
                false,
                true,
                undefined,
                ['jpg', 'jpeg', 'png', 'webp', 'svg']
            );
            console.log(`  ✨ Created Storage Bucket "${b.name}" (${b.id}).`);
        }
    }

    console.log('\n🎉 Appwrite Cloud Schema Setup Completed Successfully!');
}

initSchema().catch(err => {
    console.error('❌ Setup failed:', err);
});
