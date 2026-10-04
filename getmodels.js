const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
require('ts-node').register();
const { CredentialService } = require('./src/services/credential.service.ts');

const prisma = new PrismaClient();

async function run() {
  const cred = await prisma.credential.findFirst({ where: { type: 'groq_api_key' } });
  if (!cred) { console.log('No groq key in db'); return; }
  
  const apiKey = CredentialService.decrypt(cred.encrypted, cred.iv);
  console.log('Got API key:', apiKey.substring(0, 8) + '...');
  
  const response = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { 'Authorization': 'Bearer ' + apiKey }
  });
  const data = await response.json();
  
  if (data.data) {
    console.log('Available models:');
    data.data.forEach(m => console.log(m.id));
  } else {
    console.log('Error from Groq:', data);
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
