import { chromium } from 'playwright';

async function testPlaywright() {
  console.log('🎭 Testando Playwright...');
  
  let browser = null;
  try {
    browser = await chromium.launch({ headless: true });
    console.log('✅ Navegador inicializado');
    
    const page = await browser.newPage();
    console.log('✅ Página criada');
    
    await page.goto('https://www.google.com', { timeout: 10000 });
    console.log('✅ Página carregada');
    
    const title = await page.title();
    console.log('📄 Título:', title);
    
    await browser.close();
    console.log('✅ Navegador fechado');
    
    console.log('\n🎉 Playwright funcionando perfeitamente!');
  } catch (error) {
    console.log('❌ Erro:', error.message);
    if (browser) {
      await browser.close();
    }
  }
}

testPlaywright();
