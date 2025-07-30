import { chromium } from 'playwright';
import logger from '../utils/logger.js';

/**
 * Fallback simplificado para busca web quando o SmartWebSearchAgent falha
 * Usa uma abordagem mais direta e robusta
 */
export default async function fallbackWebSearch(query) {
  logger.info('FallbackWebSearch', `Executando busca simplificada para: "${query}"`);
  
  let browser = null;
  let context = null;
  let page = null;
  
  try {
    // Inicializar navegador com configurações robustas
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    });

    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo'
    });

    page = await context.newPage();
    
    // Estratégia 1: Tentar Google primeiro
    const searchEngines = [
      { name: 'Google', url: 'https://www.google.com/search?q=', selector: '.g .yuRUbf a' },
      { name: 'Bing', url: 'https://www.bing.com/search?q=', selector: '.b_algo h2 a' },
      { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=', selector: '.result__a' }
    ];

    let searchResults = [];
    let usedEngine = null;

    for (const engine of searchEngines) {
      try {
        logger.debug('FallbackWebSearch', `Tentando busca no ${engine.name}...`);
        
        const searchUrl = engine.url + encodeURIComponent(query);
        await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 15000 });
        
        // Aguardar carregamento dos resultados
        await page.waitForTimeout(2000);
        
        // Extrair links dos resultados
        const links = await page.evaluate((selector) => {
          const elements = document.querySelectorAll(selector);
          const results = [];
          
          for (let i = 0; i < Math.min(elements.length, 5); i++) {
            const element = elements[i];
            const href = element.href;
            const title = element.textContent?.trim();
            
            if (href && title && !href.includes('google.com') && !href.includes('bing.com') && !href.includes('duckduckgo.com')) {
              results.push({ title, url: href });
            }
          }
          
          return results;
        }, engine.selector);
        
        if (links.length > 0) {
          searchResults = links;
          usedEngine = engine.name;
          logger.debug('FallbackWebSearch', `Encontrados ${links.length} resultados no ${engine.name}`);
          break;
        }
        
      } catch (error) {
        logger.warn('FallbackWebSearch', `Falha no ${engine.name}:`, error.message);
        continue;
      }
    }

    if (searchResults.length === 0) {
      return { 
        error: 'Nenhum resultado encontrado em nenhum mecanismo de busca',
        query 
      };
    }

    // Tentar acessar os primeiros resultados e extrair conteúdo
    const extractedContent = [];
    const visitedUrls = [];

    for (let i = 0; i < Math.min(searchResults.length, 3); i++) {
      const result = searchResults[i];
      
      try {
        logger.debug('FallbackWebSearch', `Acessando: ${result.url}`);
        
        await page.goto(result.url, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.waitForTimeout(1500);
        
        // Extrair conteúdo da página
        const content = await page.evaluate(() => {
          // Remover scripts, estilos e elementos desnecessários
          const elementsToRemove = document.querySelectorAll('script, style, nav, header, footer, aside, .ad, .advertisement');
          elementsToRemove.forEach(el => el.remove());
          
          // Tentar encontrar o conteúdo principal
          const mainContent = document.querySelector('main') || 
                             document.querySelector('article') || 
                             document.querySelector('.content') || 
                             document.querySelector('#content') || 
                             document.body;
          
          const text = mainContent?.innerText || document.body.innerText || '';
          return text.substring(0, 2000); // Limitar tamanho
        });
        
        if (content && content.trim().length > 100) {
          extractedContent.push({
            title: result.title,
            url: result.url,
            content: content.trim()
          });
          visitedUrls.push(result.url);
        }
        
      } catch (error) {
        logger.warn('FallbackWebSearch', `Erro ao acessar ${result.url}:`, error.message);
        continue;
      }
    }

    if (extractedContent.length === 0) {
      return {
        error: 'Não foi possível extrair conteúdo útil dos resultados encontrados',
        searchResults,
        usedEngine,
        query
      };
    }

    // Compilar resultado final
    const compiledResult = `Informações encontradas sobre "${query}":

${extractedContent.map((item, index) => 
  `${index + 1}. ${item.title}
${item.content.substring(0, 400)}...
Fonte: ${item.url}
`).join('\n')}

Busca realizada usando ${usedEngine}. Resultados obtidos de ${extractedContent.length} fonte(s).`;

    return {
      success: true,
      result: compiledResult,
      sources: visitedUrls,
      query,
      usedEngine,
      extractedContent
    };

  } catch (error) {
    logger.error('FallbackWebSearch', 'Erro crítico na busca fallback:', error);
    return { 
      error: 'Falha crítica no sistema de busca fallback', 
      details: error.message,
      query 
    };
  } finally {
    try {
      if (page) await page.close();
      if (context) await context.close();
      if (browser) await browser.close();
    } catch (error) {
      logger.error('FallbackWebSearch', 'Erro ao fechar navegador:', error);
    }
  }
}
