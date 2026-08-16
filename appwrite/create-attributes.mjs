import { Client, Databases } from 'node-appwrite';
import dotenv from 'dotenv';

dotenv.config();

const ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1';
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const db = new Databases(client);
const DB_ID = 'redwan_shop';

async function createAttributes() {
    console.log('⚡ Adding Document Attributes to Appwrite Collections...\n');

    async function addAttr(col, fn) {
        try {
            await fn();
        } catch (e) {
            if (e.code === 409) {
                // Already exists
            } else {
                console.log(`  ⚠️ Notice for ${col}: ${e.message}`);
            }
        }
    }

    // BRANDS
    console.log('📌 Configuring Brands attributes...');
    await addAttr('brands', () => db.createStringAttribute(DB_ID, 'brands', 'name', 100, true));
    await addAttr('brands', () => db.createStringAttribute(DB_ID, 'brands', 'slug', 120, true));
    await addAttr('brands', () => db.createUrlAttribute(DB_ID, 'brands', 'logo_url', false));
    await addAttr('brands', () => db.createBooleanAttribute(DB_ID, 'brands', 'is_active', true, true));

    // CATEGORIES
    console.log('📌 Configuring Categories attributes...');
    await addAttr('categories', () => db.createStringAttribute(DB_ID, 'categories', 'name', 100, true));
    await addAttr('categories', () => db.createStringAttribute(DB_ID, 'categories', 'slug', 120, true));
    await addAttr('categories', () => db.createStringAttribute(DB_ID, 'categories', 'icon', 50, false));
    await addAttr('categories', () => db.createUrlAttribute(DB_ID, 'categories', 'image_url', false));

    // PRODUCTS
    console.log('📌 Configuring Products attributes...');
    await addAttr('products', () => db.createStringAttribute(DB_ID, 'products', 'name', 255, true));
    await addAttr('products', () => db.createStringAttribute(DB_ID, 'products', 'slug', 300, true));
    await addAttr('products', () => db.createStringAttribute(DB_ID, 'products', 'sku', 100, true));
    await addAttr('products', () => db.createStringAttribute(DB_ID, 'products', 'brand_id', 50, false));
    await addAttr('products', () => db.createStringAttribute(DB_ID, 'products', 'category_id', 50, false));
    await addAttr('products', () => db.createStringAttribute(DB_ID, 'products', 'short_description', 1000, false));
    await addAttr('products', () => db.createStringAttribute(DB_ID, 'products', 'description', 5000, false));
    await addAttr('products', () => db.createFloatAttribute(DB_ID, 'products', 'price', true));
    await addAttr('products', () => db.createFloatAttribute(DB_ID, 'products', 'sale_price', false));
    await addAttr('products', () => db.createStringAttribute(DB_ID, 'products', 'status', 20, true, 'published'));
    await addAttr('products', () => db.createBooleanAttribute(DB_ID, 'products', 'is_featured', true, false));
    await addAttr('products', () => db.createStringAttribute(DB_ID, 'products', 'images', 2000, false, undefined, true));
    await addAttr('products', () => db.createFloatAttribute(DB_ID, 'products', 'avg_rating', false, 0));
    await addAttr('products', () => db.createIntegerAttribute(DB_ID, 'products', 'review_count', false, 0));

    // PRODUCT VARIANTS
    console.log('📌 Configuring Product Variants attributes...');
    await addAttr('product_variants', () => db.createStringAttribute(DB_ID, 'product_variants', 'product_id', 50, true));
    await addAttr('product_variants', () => db.createStringAttribute(DB_ID, 'product_variants', 'color', 80, false));
    await addAttr('product_variants', () => db.createStringAttribute(DB_ID, 'product_variants', 'storage', 30, false));
    await addAttr('product_variants', () => db.createStringAttribute(DB_ID, 'product_variants', 'ram', 20, false));
    await addAttr('product_variants', () => db.createFloatAttribute(DB_ID, 'product_variants', 'extra_price', false, 0));
    await addAttr('product_variants', () => db.createIntegerAttribute(DB_ID, 'product_variants', 'stock', true, 0));

    // PRODUCT SPECS
    console.log('📌 Configuring Product Specs attributes...');
    await addAttr('product_specs', () => db.createStringAttribute(DB_ID, 'product_specs', 'product_id', 50, true));
    await addAttr('product_specs', () => db.createStringAttribute(DB_ID, 'product_specs', 'group_name', 80, true));
    await addAttr('product_specs', () => db.createStringAttribute(DB_ID, 'product_specs', 'spec_key', 100, true));
    await addAttr('product_specs', () => db.createStringAttribute(DB_ID, 'product_specs', 'spec_value', 500, true));

    // ORDERS
    console.log('📌 Configuring Orders attributes...');
    await addAttr('orders', () => db.createStringAttribute(DB_ID, 'orders', 'order_number', 50, true));
    await addAttr('orders', () => db.createStringAttribute(DB_ID, 'orders', 'user_id', 50, false));
    await addAttr('orders', () => db.createStringAttribute(DB_ID, 'orders', 'guest_name', 120, false));
    await addAttr('orders', () => db.createStringAttribute(DB_ID, 'orders', 'guest_phone', 20, false));
    await addAttr('orders', () => db.createStringAttribute(DB_ID, 'orders', 'status', 30, true, 'pending'));
    await addAttr('orders', () => db.createFloatAttribute(DB_ID, 'orders', 'total_amount', true));
    await addAttr('orders', () => db.createStringAttribute(DB_ID, 'orders', 'shipping_address', 2000, true));
    await addAttr('orders', () => db.createStringAttribute(DB_ID, 'orders', 'payment_method', 30, true));
    await addAttr('orders', () => db.createStringAttribute(DB_ID, 'orders', 'payment_status', 20, true, 'pending'));
    await addAttr('orders', () => db.createStringAttribute(DB_ID, 'orders', 'tracking_id', 100, false));

    // ORDER ITEMS
    console.log('📌 Configuring Order Items attributes...');
    await addAttr('order_items', () => db.createStringAttribute(DB_ID, 'order_items', 'order_id', 50, true));
    await addAttr('order_items', () => db.createStringAttribute(DB_ID, 'order_items', 'product_id', 50, true));
    await addAttr('order_items', () => db.createStringAttribute(DB_ID, 'order_items', 'name', 255, true));
    await addAttr('order_items', () => db.createIntegerAttribute(DB_ID, 'order_items', 'quantity', true));
    await addAttr('order_items', () => db.createFloatAttribute(DB_ID, 'order_items', 'unit_price', true));
    await addAttr('order_items', () => db.createFloatAttribute(DB_ID, 'order_items', 'total_price', true));

    // BANNERS
    console.log('📌 Configuring Banners attributes...');
    await addAttr('banners', () => db.createStringAttribute(DB_ID, 'banners', 'title', 200, false));
    await addAttr('banners', () => db.createUrlAttribute(DB_ID, 'banners', 'image_url', true));
    await addAttr('banners', () => db.createUrlAttribute(DB_ID, 'banners', 'link_url', false));
    await addAttr('banners', () => db.createStringAttribute(DB_ID, 'banners', 'position', 30, true, 'hero'));
    await addAttr('banners', () => db.createBooleanAttribute(DB_ID, 'banners', 'is_active', true, true));

    console.log('\n🎉 Attributes configured on Appwrite Cloud!');
}

createAttributes().catch(err => console.error('❌ Attribute creation error:', err));
