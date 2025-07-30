import puppeteer from 'puppeteer-core';
import logError from '../utils/logger.js';

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

export default async function webSearch(query) {
  console.log(`Performing web search on Bing for: "${query}"`);
  let browser = null;
  try {
    browser = await puppeteer.launch({
      executablePath: getChromeExecutablePath(),
      headless: true, // Roda sem abrir uma janela do navegador
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Constrói a URL de busca do Bing
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
    await page.goto(searchUrl);

    // Espera os resultados da busca do Bing serem carregados
    await page.waitForSelector('#b_results');

    // Extrai os resultados da página do Bing
    // Estes seletores são específicos para o layout do Bing
    const searchResults = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('li.b_algo').forEach(result => {
        const titleElement = result.querySelector('h2 a');
        const linkElement = result.querySelector('h2 a');
        const snippetElement = result.querySelector('.b_caption p');

        // Log to debug if elements are found
        console.log('Title element:', titleElement);
        console.log('Link element:', linkElement);
        console.log('Snippet element:', snippetElement);

        if (titleElement && linkElement) { // Snippet is optional
          results.push({
            title: titleElement.innerText.trim(),
            link: linkElement.href,
            snippet: snippetElement ? snippetElement.innerText.trim() : ''
          });
        }
      });
      return results.slice(0, 5); // Retorna os 5 primeiros resultados
    });

    return { results: searchResults };

  } catch (error) {
    logError(error, `webSearch - Failed to perform web search for query: "${query}"`);
    console.error('Error during Bing web search:', error);
    return { error: 'Failed to perform web search.', details: error.message };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}