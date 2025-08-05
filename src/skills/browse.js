import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { logError } from '../utils/logger.js';
puppeteer.use(StealthPlugin());

// Helper para encontrar o caminho do executável do Chrome
function getChromeExecutablePath() {
  // Adapte este caminho se o seu Chrome estiver instalado em um local diferente
  if (process.platform === 'win32') {
    return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  } else if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  } else {
    return '/usr/bin/google-chrome'; // Caminho comum para Linux
  }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function simulateHuman(page) {
  // Rola a página lentamente
  for (let i = 0; i < 3; i++) {
    await sleep(randomInt(500, 1200));
    await page.mouse.wheel({ deltaY: randomInt(200, 600) });
  }
  // Move o mouse para pontos aleatórios
  for (let i = 0; i < 3; i++) {
    await sleep(randomInt(300, 800));
    await page.mouse.move(randomInt(0, 800), randomInt(0, 600));
  }
}

// Função aprimorada para tentar burlar bloqueios do Google
export default async function browse({ url }) {
  const maxRetries = 3;
  let retries = 0;
  let browser = null;

  while (retries < maxRetries) {
    try {
      console.log(`Acessando URL: ${url} (Tentativa ${retries + 1}/${maxRetries})`);
      if (!url) throw new Error('URL é obrigatória');
      if (url.includes('google.com')) {
        throw new Error('Acesso ao Google não permitido, use o bing');
      }

      browser = await puppeteer.launch({ executablePath: getChromeExecutablePath(), headless: true, args: ['--no-sandbox'] });
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7' });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await simulateHuman(page);
      await sleep(1500);
      const bodyText = await page.$eval('body', el => el.innerText);
      await browser.close();
      return { url, body: bodyText };
    } catch (err) {
      if (browser) {
        await browser.close();
      }
      if (err.message.includes('net::ERR_NAME_NOT_RESOLVED') && retries < maxRetries - 1) {
        console.warn(`Erro de resolução de nome para ${url}. Tentando novamente em 2 segundos...`);
        retries++;
        await sleep(2000); // Espera 2 segundos antes de tentar novamente
      } else {
        logError(err, `browse - Failed to browse URL: ${url}`);
        return { url, error: err.message || 'Erro desconhecido', stack: err.stack || undefined };
      }
    }
  }
  return { url, error: `Falha ao acessar ${url} após ${maxRetries} tentativas devido a erro de resolução de nome.` };
}