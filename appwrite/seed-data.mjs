import { Client, Databases } from 'node-appwrite';
import dotenv from 'dotenv';

dotenv.config();

const ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1';
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const db = new Databases(client);
const DB_ID = 'redwan_shop';

async function seedData() {
    console.log('🌱 Seeding Appwrite Cloud Database with Mobile Shop Sample Data...\n');

    // 1. BRANDS
    console.log('📦 Seeding Brands...');
    const brands = [
        { id: 'b_samsung', name: 'Samsung', slug: 'samsung', is_active: true },
        { id: 'b_apple', name: 'Apple', slug: 'apple', is_active: true },
        { id: 'b_xiaomi', name: 'Xiaomi', slug: 'xiaomi', is_active: true },
        { id: 'b_realme', name: 'Realme', slug: 'realme', is_active: true },
        { id: 'b_oneplus', name: 'OnePlus', slug: 'oneplus', is_active: true }
    ];

    for (const b of brands) {
        try {
            await db.createDocument(DB_ID, 'brands', b.id, b);
            console.log(`  ✨ Added Brand: ${b.name}`);
        } catch (e) {
            console.log(`  🔹 Brand "${b.name}" already exists.`);
        }
    }

    // 2. CATEGORIES
    console.log('\n📁 Seeding Categories...');
    const categories = [
        { id: 'c_flagship', name: 'Flagship Smartphones', slug: 'flagship', icon: '📱', is_active: true },
        { id: 'c_midrange', name: 'Mid-Range Phones', slug: 'midrange', icon: '📲', is_active: true },
        { id: 'c_budget', name: 'Budget Phones', slug: 'budget', icon: '📞', is_active: true },
        { id: 'c_accessories', name: 'Accessories', slug: 'accessories', icon: '🎧', is_active: true }
    ];

    for (const c of categories) {
        try {
            await db.createDocument(DB_ID, 'categories', c.id, c);
            console.log(`  ✨ Added Category: ${c.name}`);
        } catch (e) {
            console.log(`  🔹 Category "${c.name}" already exists.`);
        }
    }

    // 3. BANNERS
    console.log('\n🎨 Seeding Banners...');
    const banners = [
        {
            id: 'banner_hero_1',
            title: 'Samsung Galaxy S25 Ultra Launch',
            image_url: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=1200&q=80',
            position: 'hero',
            is_active: true
        },
        {
            id: 'banner_flash_1',
            title: 'Flash Sale Up to 30% Off',
            image_url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=1200&q=80',
            position: 'flash_sale',
            is_active: true
        }
    ];

    for (const ban of banners) {
        try {
            await db.createDocument(DB_ID, 'banners', ban.id, ban);
            console.log(`  ✨ Added Banner: ${ban.title}`);
        } catch (e) {
            console.log(`  🔹 Banner "${ban.title}" already exists.`);
        }
    }

    // 4. PRODUCTS
    console.log('\n📱 Seeding Products...');
    const products = [
        {
            id: 'prod_s25_ultra',
            name: 'Samsung Galaxy S25 Ultra 5G',
            slug: 'samsung-galaxy-s25-ultra-5g',
            sku: 'SAM-S25U-256',
            brand_id: 'b_samsung',
            category_id: 'c_flagship',
            short_description: '6.9" Dynamic AMOLED 2X, Snapdragon 8 Elite, 200MP Camera, 5000mAh',
            description: 'The ultimate flagship smartphone from Samsung featuring Snapdragon 8 Elite, S-Pen support, 200MP camera with 100x Space Zoom, and titanium frame.',
            price: 139999,
            sale_price: 129999,
            status: 'published',
            is_featured: true,
            avg_rating: 4.9,
            review_count: 32
        },
        {
            id: 'prod_iphone16_pro',
            name: 'Apple iPhone 16 Pro Max',
            slug: 'apple-iphone-16-pro-max',
            sku: 'APL-IP16PM-256',
            brand_id: 'b_apple',
            category_id: 'c_flagship',
            short_description: '6.9" Super Retina XDR, A18 Pro Bionic, 48MP Fusion Camera, Titanium Design',
            description: 'Apple iPhone 16 Pro Max with A18 Pro chip, 4K 120fps Dolby Vision, Camera Control button, and groundbreaking battery life.',
            price: 175000,
            sale_price: 168000,
            status: 'published',
            is_featured: true,
            avg_rating: 5.0,
            review_count: 48
        },
        {
            id: 'prod_a55_5g',
            name: 'Samsung Galaxy A55 5G',
            slug: 'samsung-galaxy-a55-5g',
            sku: 'SAM-A55-128',
            brand_id: 'b_samsung',
            category_id: 'c_midrange',
            short_description: '6.6" Super AMOLED 120Hz, Exynos 1480, 50MP OIS, 5000mAh',
            description: 'Premium glass design, IP67 dust/water resistance, Knox Vault security, and 4 years of OS updates.',
            price: 49999,
            sale_price: 37499,
            status: 'published',
            is_featured: true,
            avg_rating: 4.7,
            review_count: 24
        },
        {
            id: 'prod_redmi_note13',
            name: 'Xiaomi Redmi Note 13 Pro+ 5G',
            slug: 'xiaomi-redmi-note-13-pro-plus-5g',
            sku: 'XIA-RN13PP-256',
            brand_id: 'b_xiaomi',
            category_id: 'c_midrange',
            short_description: '6.67" 1.5K Curved AMOLED, Dimensity 7200-Ultra, 200MP OIS, 120W Charging',
            description: 'Iconic curved display design, 120W HyperCharge (0-100% in 19 mins), IP68 water resistance, and 200MP ultra-clear camera.',
            price: 42999,
            sale_price: 34999,
            status: 'published',
            is_featured: true,
            avg_rating: 4.8,
            review_count: 19
        }
    ];

    for (const p of products) {
        try {
            await db.createDocument(DB_ID, 'products', p.id, p);
            console.log(`  ✨ Added Product: ${p.name}`);
        } catch (e) {
            console.log(`  🔹 Product "${p.name}" already exists.`);
        }
    }

    console.log('\n🎉 Appwrite Cloud Database Successfully Seeded with Live Data!');
}

seedData().catch(err => console.error('❌ Seeding failed:', err));
