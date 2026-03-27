import bcrypt from 'bcryptjs';

async function hash() {
  const h = await bcrypt.hash('admin123', 12);
  console.log(h);
}
hash();
