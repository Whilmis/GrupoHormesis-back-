const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

function decrypt(text, ivHex) {
  const secretKey = process.env.ENCRYPTION_KEY || 'hormesis-secret-key-32-bytes-long';
  let iv = Buffer.from(ivHex, 'hex');
  let encryptedText = Buffer.from(text, 'hex');
  let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(secretKey.padEnd(32, '0')), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

async function run() {
  const cred = await prisma.credential.findFirst({ where: { type: 'groq_api_key' } });
  if (!cred) { console.log('No groq key in db'); return; }
  
  const apiKey = decrypt(cred.encrypted, cred.iv);
  console.log('Got API key, fetching models...');
  
  const response = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { 'Authorization': 'Bearer ' + apiKey }
  });
  const data = await response.json();
  
  if (data.data) {
    console.log('Available models:');
    data.data.forEach(m => console.log(m.id));
  } else {
    console.log(data);
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
