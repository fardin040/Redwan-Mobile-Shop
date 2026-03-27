import { SignJWT } from 'jose';
import fs from 'fs';

async function test() {
  const secretKey = new TextEncoder().encode('my-super-secret-jwt-key'); // fallback local secret

  const token = await new SignJWT({ id: 'dummy', role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(secretKey);

  console.log("Token:", token);

  const res = await fetch('https://redwan-mobile-shop-api.fardinahamed178.workers.dev/api/admin/stats', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  console.log("Status:", res.status);
  const json = await res.json();
  console.log("Response:", JSON.stringify(json, null, 2));
}

test();
