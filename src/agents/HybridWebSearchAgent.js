import { chromium } from 'playwright';
import fallbackWebSearch from './FallbackWebSearchAgent.js';
import logger from '../utils/logger.js';

/**
 * Agente web search simplificado que tenta usar Playwright primeiro,
 * mas falha rapidamente para o FallbackWebSearchAgent se houver problemas
 */
export default async function hybridWebSearch(query) {
  logger.info('HybridWebSearch', `Iniciando busca híbrida para: "${query}"`);
  
  // Tentar verificar se Playwright está disponível rapidamente
  let playwrightAvailable = false;
  try {
    const executablePath = await chromium.executablePath();
    playwrightAvailable = !!executablePath;
    logger.debug('HybridWebSearch', 'Playwright disponível:', playwrightAvailable);
  } catch (error) {
    logger.warn('HybridWebSearch', 'Playwright não disponível, usando fallback:', error.message);
    playwrightAvailable = false;
  }

  // Se Playwright não estiver disponível, usar fallback imediatamente
  if (!playwrightAvailable) {
    logger.info('HybridWebSearch', 'Usando fallback diretamente');
    const result = await fallbackWebSearch(query);
    if (result && !result.error) {
      return {
        ...result,
        method: 'fallback-direct'
      };
    }
    return result;
  }

  // Tentar busca simplificada com Playwright (máximo 30 segundos)
  try {
    logger.debug('HybridWebSearch', 'Tentando busca simplificada com Playwright...');
    
    const playwrightResult = await Promise.race([
      simplifiedPlaywrightSearch(query),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout Playwright')), 30000)
      )
    ]);

    if (playwrightResult && !playwrightResult.error) {
      logger.info('HybridWebSearch', 'Busca Playwright bem-sucedida');
      return {
        ...playwrightResult,
        method: 'simplified-playwright'
      };
    }
  } catch (error) {
    logger.warn('HybridWebSearch', 'Playwright falhou, usando fallback:', error.message);
  }

  // Se chegou aqui, usar fallback
  logger.info('HybridWebSearch', 'Usando fallback após falha do Playwright');
  const result = await fallbackWebSearch(query);
  return {
    ...result,
    method: 'fallback-after-failure'
  };
}

/**
 * Busca simplificada usando Playwright - apenas navegar para Google e buscar
 */
async function simplifiedPlaywrightSearch(query) {
  let browser = null;
  let context = null;
  let page = null;
  
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      viewport: { width: 1920, height: 1080 }
    });
    
    page = await context.newPage();
    
    // Navegar para Google
    await page.goto('https://www.google.com', { timeout: 10000 });
    
    // Buscar pelo campo de pesquisa
    const searchInput = page.locator('input[name="q"]').first();
    await searchInput.fill(query);
    await searchInput.press('Enter');
    
    // Aguardar resultados
    await page.waitForSelector('.g', { timeout: 10000 });
    
    // Extrair alguns resultados
    const results = await page.evaluate(() => {
      const searchResults = [];
      const resultElements = document.querySelectorAll('.g');
      
      for (let i = 0; i < Math.min(resultElements.length, 5); i++) {
        const element = resultElements[i];
        const linkEl = element.querySelector('a[href]');
        const titleEl = element.querySelector('h3');
        const snippetEl = element.querySelector('.VwiC3b, .s3v9rd');
        
        if (linkEl && titleEl) {
          searchResults.push({
            title: titleEl.textContent.trim(),
            url: linkEl.href,
            snippet: snippetEl ? snippetEl.textContent.trim() : ''
          });
        }
      }
      
      return searchResults;
    });
    
    if (results.length === 0) {
      return { error: 'Nenhum resultado encontrado' };
    }
    
    // Tentar acessar a primeira URL para obter conteúdo
    let content = '';
    let contentUrl = '';
    
    for (const result of results.slice(0, 3)) {
      try {
        await page.goto(result.url, { timeout: 8000 });
        const pageContent = await page.evaluate(() => {
          // Remover elementos desnecessários
          const elementsToRemove = document.querySelectorAll('script, style, nav, header, footer');
          elementsToRemove.forEach(el => el.remove());
          
          const main = document.querySelector('main') || 
                      document.querySelector('article') || 
                      document.querySelector('.content') ||
                      document.body;
          
          return main.innerText.substring(0, 1500);
        });
        
        if (pageContent && pageContent.length > 200) {
          content = pageContent;
          contentUrl = result.url;
          break;
        }
      } catch (error) {
        logger.debug('HybridWebSearch', `Falha ao acessar ${result.url}:`, error.message);
        continue;
      }
    }
    
    // Compilar resultado
    const compiledResult = content ? 
      `Informações sobre "${query}":

${content}

Fonte: ${contentUrl}

Busca realizada com Playwright via Google.` :
      `Resultados encontrados para "${query}":

${results.map((r, i) => `${i+1}. ${r.title}\n${r.snippet}\nURL: ${r.url}`).join('\n\n')}

Busca realizada com Playwright via Google.`;

    return {
      success: true,
      result: compiledResult,
      sources: contentUrl ? [contentUrl] : results.map(r => r.url),
      query
    };
    
  } catch (error) {
    logger.error('HybridWebSearch', 'Erro na busca Playwright simplificada:', error);
    return { error: error.message };
  } finally {
    try {
      if (page) await page.close();
      if (context) await context.close();
      if (browser) await browser.close();
    } catch (closeError) {
      logger.debug('HybridWebSearch', 'Erro ao fechar navegador:', closeError.message);
    }
  }
}
