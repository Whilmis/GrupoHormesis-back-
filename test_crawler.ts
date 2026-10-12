import { CrawlerService } from './src/services/crawler.service';
import dotenv from 'dotenv';

dotenv.config();

async function runTest() {
  console.log('Probando el crawler...');
  try {
    const result = await CrawlerService.analyzeWebsiteAndCapture('https://example.com');
    console.log('=========================');
    console.log('RESULTADO DEL CRAWLER:');
    console.log(JSON.stringify(result, null, 2));
    console.log('=========================');
  } catch(e) {
    console.error('Falló la prueba:', e);
  }
}

runTest();
