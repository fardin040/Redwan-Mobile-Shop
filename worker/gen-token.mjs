import { SignJWT } from 'jose';

async function generate() {
  const secret = new TextEncoder().encode('my-super-secret-jwt-key'); // This MUST match the worker environment secret
  const token = await new SignJWT({ id: '4fc4a475-482f-47bb-bf65-aa4df307ac42' }) // admin_final@redwan.com
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1d')
    .sign(secret);
  console.log(token);
}
generate();
