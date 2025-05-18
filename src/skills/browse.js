import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());

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
  try {
    if (!url) throw new Error('URL é obrigatória');
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    // User-Agent de navegador real
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
    // Aceita cookies
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7' });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await simulateHuman(page);
    // Pequeno delay para simular humano
    await sleep(1500);
    const bodyText = await page.$eval('body', el => el.innerText);
    await browser.close();
    return { url, body: bodyText };
  } catch (err) {
    return { url, error: err.message || 'Erro desconhecido', stack: err.stack || undefined };
  }
}