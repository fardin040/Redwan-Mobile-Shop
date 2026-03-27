// ============================================================
// worker/src/routes/upload.js — Cloudinary via REST API
// Replaces: multer + cloudinary SDK (not Workers-compatible)
// ============================================================
import { Hono } from 'hono';
import { query } from '../db.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const upload = new Hono();

// Sign a Cloudinary upload — frontend uploads directly to Cloudinary
// This avoids sending the file through the Worker (memory limits)
upload.get('/sign', authenticate, async (c) => {
  const timestamp  = Math.round(Date.now() / 1000);
  const folder     = c.req.query('folder') || 'redwan/products';
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}${c.env.CLOUDINARY_API_SECRET}`;

  // SHA-1 sign using Web Crypto
  const msgBuffer  = new TextEncoder().encode(paramsToSign);
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  const signature  = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return c.json({
    success: true,
    data: {
      signature,
      timestamp,
      cloudName: c.env.CLOUDINARY_NAME,
      apiKey:    c.env.CLOUDINARY_API_KEY,
      folder,
    },
  });
});

// Upload product image via Worker (small files only, <4MB due to Worker limits)
upload.post('/product-image', ...isAdmin, async (c) => {
  try {
    const formData = await c.req.formData();
    const file     = formData.get('image');
    if (!file) return c.json({ success: false, message: 'No image provided' }, 400);

    const buffer      = await file.arrayBuffer();
    const base64      = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    const dataURI     = `data:${file.type};base64,${base64}`;
    const timestamp   = Math.round(Date.now() / 1000);
    const folder      = 'redwan/products';
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}${c.env.CLOUDINARY_API_SECRET}`;

    const msgBuffer   = new TextEncoder().encode(paramsToSign);
    const hashBuffer  = await crypto.subtle.digest('SHA-1', msgBuffer);
    const signature   = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0')).join('');

    const uploadForm = new FormData();
    uploadForm.append('file',      dataURI);
    uploadForm.append('api_key',   c.env.CLOUDINARY_API_KEY);
    uploadForm.append('timestamp', String(timestamp));
    uploadForm.append('signature', signature);
    uploadForm.append('folder',    folder);

    const res  = await fetch(`https://api.cloudinary.com/v1_1/${c.env.CLOUDINARY_NAME}/image/upload`, {
      method: 'POST', body: uploadForm,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Cloudinary upload failed');
    return c.json({ success: true, data: { url: data.secure_url, public_id: data.public_id } });
  } catch (e) {
    return c.json({ success: false, message: e.message }, 500);
  }
});

// Delete image from Cloudinary (admin)
upload.delete('/:publicId', ...isAdmin, async (c) => {
  try {
    const publicId    = decodeURIComponent(c.req.param('publicId'));
    const timestamp   = Math.round(Date.now() / 1000);
    const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}${c.env.CLOUDINARY_API_SECRET}`;
    const msgBuffer   = new TextEncoder().encode(paramsToSign);
    const hashBuffer  = await crypto.subtle.digest('SHA-1', msgBuffer);
    const signature   = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0')).join('');

    const form = new FormData();
    form.append('public_id', publicId);
    form.append('api_key',   c.env.CLOUDINARY_API_KEY);
    form.append('timestamp', String(timestamp));
    form.append('signature', signature);

    await fetch(`https://api.cloudinary.com/v1_1/${c.env.CLOUDINARY_NAME}/image/destroy`, {
      method: 'POST', body: form,
    });
    return c.json({ success: true, message: 'Image deleted' });
  } catch (e) {
    return c.json({ success: false, message: e.message }, 500);
  }
});

export default upload;
