import { PrismaClient } from '@prisma/client';
import { CredentialService } from './src/services/credential.service';
import https from 'https';

const prisma = new PrismaClient();

async function main() {
  const creds = await prisma.credential.findMany({ where: { type: 'groq_api_key' } });
  if (creds.length === 0) { console.log('NO GROQ CREDS IN DB'); return; }
  
  for (const cred of creds) {
    const apiKey = CredentialService.decrypt(cred.encrypted, cred.iv);
    console.log('Testing Cred ID:', cred.id);
    
    await new Promise((resolve) => {
      const req = https.request({
        hostname: 'api.groq.com',
        path: '/openai/v1/models',
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + apiKey }
      }, (res) => {
        let data = '';
        res.on('data', (c) => data += c);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.data) {
              console.log('Available models:', parsed.data.map((m: any) => m.id));
            } else {
              console.log('Error:', data);
            }
          } catch(e) {
            console.log('Parse error:', e, data);
          }
          resolve(null);
        });
      });
      req.end();
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
