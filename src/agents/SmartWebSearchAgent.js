import { chromium } from 'playwright';
import chatAi from '../config/ai/chat.ai.js';
import logger from '../utils/logger.js';

const SEARCH_AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'analyze_page',
      description: 'Analisa a página atual e retorna informações sobre seus elementos e conteúdo.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'click_element',
      description: 'Clica em um elemento da página baseado em seletor CSS ou texto.',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'Seletor CSS do elemento' },
          text: { type: 'string', description: 'Texto do elemento a clicar (alternativa ao seletor)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'type_text',
      description: 'Digita texto em um campo de entrada.',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'Seletor CSS do campo de entrada' },
          text: { type: 'string', description: 'Texto a digitar' },
          clear: { type: 'boolean', description: 'Se deve limpar o campo antes de digitar', default: true },
          pressEnter: { type: 'boolean', description: 'Se deve pressionar Enter após digitar', default: false }
        },
        required: ['selector', 'text']
      }
    }
  },
  {
    type: 'function',
    function: 'scroll_page',
    description: 'Rola a página para cima ou para baixo.',
    parameters: {
      type: 'object',
      properties: {
        direction: { type: 'string', enum: ['up', 'down'], description: 'Direção do scroll' },
        amount: { type: 'number', description: 'Quantidade de pixels para rolar', default: 500 }
      },
      required: ['direction']
    }
  },
  {
    type: 'function',
    function: {
      name: 'wait_for_element',
      description: 'Aguarda um elemento aparecer na página.',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'Seletor CSS do elemento' },
          timeout: { type: 'number', description: 'Timeout em milissegundos', default: 10000 }
        },
        required: ['selector']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'extract_content',
      description: 'Extrai conteúdo específico da página.',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'Seletor CSS para extrair conteúdo específico' },
          attribute: { type: 'string', description: 'Atributo específico a extrair (ex: href, src)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'navigate_to',
      description: 'Navega para uma nova URL.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL para navegar' }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_current_info',
      description: 'Obtém informações sobre a página atual (URL, título, texto visível).',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'complete_search',
      description: 'Marca a busca como completa e retorna o resultado final.',
      parameters: {
        type: 'object',
        properties: {
          result: { type: 'string', description: 'Resultado final da busca' },
          sources: { type: 'array', items: { type: 'string' }, description: 'URLs das fontes consultadas' }
        },
        required: ['result']
      }
    }
  }
];

const SYSTEM_PROMPT = {
  role: 'system',
  content: `Você é um agente especializado em busca web inteligente. Você tem controle total sobre um navegador e pode:

1. **Analisar páginas**: Use analyze_page para entender o layout da página atual
2. **Navegar**: Use navigate_to para ir para URLs específicas  
3. **Interagir**: Use click_element, type_text para interagir com elementos
4. **Extrair dados**: Use extract_content para obter informações específicas
5. **Controlar navegação**: Use scroll_page, wait_for_element para navegação fluida

**ESTRATÉGIA DE BUSCA:**
1. Comece navegando para um mecanismo de busca (Google, Bing, DuckDuckGo)
2. Analise a página e localize o campo de busca
3. Digite a query do usuário
4. Analise os resultados e identifique os links mais relevantes
5. Visite os links mais promissores
6. Extraia informações relevantes de cada página
7. Se necessário, refine a busca com termos mais específicos
8. Compile as informações encontradas em uma resposta útil

**REGRAS IMPORTANTES:**
- SEMPRE analise a página antes de interagir com ela
- Se encontrar erros (404, bloqueios), tente estratégias alternativas
- Priorize fontes confiáveis (sites oficiais, notícias, documentação)
- Extraia informações atualizadas e relevantes
- Use complete_search quando tiver informações suficientes para responder
- Se uma busca não produzir resultados, tente termos alternativos

**FOCO NA QUALIDADE:**
- Busque informações recentes e precisas
- Cite as fontes das informações encontradas
- Se encontrar datas, inclua-as na resposta
- Priorize sites em português quando apropriado

Sempre termine com complete_search quando tiver coletado informações suficientes para responder à query do usuário.`
};

class SmartWebSearchAgent {
  constructor() {
    this.browser = null;
    this.page = null;
    this.context = null;
  }

  async initialize() {
    try {
      logger.debug('SmartWebSearchAgent', 'Inicializando navegador...');
      
      // Verificar se o Playwright está disponível
      try {
        await chromium.executablePath();
      } catch (playwrightError) {
        logger.error('SmartWebSearchAgent', 'Playwright não está configurado corretamente:', playwrightError.message);
        return false;
      }
      
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });

      this.context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo'
      });

      this.page = await this.context.newPage();
      
      // Adicionar event listeners para debug
      this.page.on('console', msg => {
        if (msg.type() === 'error') {
          logger.debug('SmartWebSearchAgent', `Console error: ${msg.text()}`);
        }
      });

      logger.debug('SmartWebSearchAgent', 'Navegador inicializado com sucesso');
      return true;
    } catch (error) {
      logger.error('SmartWebSearchAgent', 'Erro ao inicializar navegador:', error);
      return false;
    }
  }

  async cleanup() {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
        this.context = null;
        logger.debug('SmartWebSearchAgent', 'Navegador fechado');
      }
    } catch (error) {
      logger.error('SmartWebSearchAgent', 'Erro ao fechar navegador:', error);
    }
  }

  async analyzePage() {
    try {
      const url = this.page.url();
      const title = await this.page.title();
      
      // Obter informações sobre elementos interativos
      const pageInfo = await this.page.evaluate(() => {
        const searchInputs = Array.from(document.querySelectorAll('input[type="text"], input[type="search"], input[name*="search"], input[name*="q"], textarea[name*="search"]'))
          .map((el, index) => ({
            selector: el.id ? `#${el.id}` : 
                     el.name ? `input[name="${el.name}"]` : 
                     el.className ? `input.${el.className.split(' ').join('.')}` :
                     `input:nth-of-type(${index + 1})`,
            placeholder: el.placeholder,
            name: el.name,
            type: el.type
          }));

        const links = Array.from(document.querySelectorAll('a[href]'))
          .filter(el => el.href && !el.href.includes('javascript:') && el.textContent.trim())
          .slice(0, 15) // Mais links para melhor análise
          .map(el => ({
            text: el.textContent.trim().substring(0, 150),
            href: el.href,
            selector: el.id ? `#${el.id}` : `a[href="${el.href}"]`
          }));

        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'))
          .filter(el => el.textContent?.trim() || el.value?.trim())
          .map((el, index) => ({
            text: el.textContent?.trim() || el.value?.trim() || '',
            selector: el.id ? `#${el.id}` : 
                     el.name ? `button[name="${el.name}"]` :
                     el.className ? `button.${el.className.split(' ').join('.')}` :
                     `button:nth-of-type(${index + 1})`,
            type: el.type
          }));

        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4'))
          .slice(0, 8)
          .map(el => ({
            tag: el.tagName.toLowerCase(),
            text: el.textContent.trim().substring(0, 150)
          }));

        return {
          searchInputs,
          links,
          buttons,
          headings,
          textContent: document.body.innerText.substring(0, 3000),
          currentDomain: window.location.hostname
        };
      });

      return {
        url,
        title,
        ...pageInfo
      };
    } catch (error) {
      logger.error('SmartWebSearchAgent', 'Erro ao analisar página:', error);
      return { error: error.message };
    }
  }

  async clickElement(selector, text) {
    try {
      let element;
      
      if (selector) {
        element = this.page.locator(selector).first();
      } else if (text) {
        element = this.page.getByText(text, { exact: false }).first();
      } else {
        throw new Error('Selector ou text deve ser fornecido');
      }

      await element.click();
      await this.page.waitForTimeout(1000); // Aguarda 1s após click
      
      return { success: true };
    } catch (error) {
      logger.error('SmartWebSearchAgent', 'Erro ao clicar elemento:', error);
      return { error: error.message };
    }
  }

  async typeText(selector, text, clear = true, pressEnter = false) {
    try {
      const element = this.page.locator(selector).first();
      
      if (clear) {
        await element.clear();
      }
      
      await element.fill(text);
      await this.page.waitForTimeout(500);
      
      if (pressEnter) {
        await element.press('Enter');
        await this.page.waitForTimeout(2000); // Aguardar carregamento após Enter
      }
      
      return { success: true };
    } catch (error) {
      logger.error('SmartWebSearchAgent', 'Erro ao digitar texto:', error);
      return { error: error.message };
    }
  }

  async scrollPage(direction, amount = 500) {
    try {
      const scrollAmount = direction === 'down' ? amount : -amount;
      await this.page.mouse.wheel(0, scrollAmount);
      await this.page.waitForTimeout(500);
      
      return { success: true };
    } catch (error) {
      logger.error('SmartWebSearchAgent', 'Erro ao rolar página:', error);
      return { error: error.message };
    }
  }

  async waitForElement(selector, timeout = 10000) {
    try {
      await this.page.waitForSelector(selector, { timeout });
      return { success: true };
    } catch (error) {
      logger.error('SmartWebSearchAgent', 'Erro ao aguardar elemento:', error);
      return { error: error.message };
    }
  }

  async extractContent(selector, attribute) {
    try {
      const elements = await this.page.locator(selector);
      const count = await elements.count();
      
      const results = [];
      for (let i = 0; i < Math.min(count, 10); i++) {
        const element = elements.nth(i);
        
        if (attribute) {
          const value = await element.getAttribute(attribute);
          if (value) results.push(value);
        } else {
          const text = await element.textContent();
          if (text && text.trim()) results.push(text.trim());
        }
      }
      
      return { results };
    } catch (error) {
      logger.error('SmartWebSearchAgent', 'Erro ao extrair conteúdo:', error);
      return { error: error.message };
    }
  }

  async navigateTo(url) {
    try {
      await this.page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      await this.page.waitForTimeout(2000);
      
      return { success: true, url: this.page.url() };
    } catch (error) {
      logger.error('SmartWebSearchAgent', 'Erro ao navegar:', error);
      return { error: error.message };
    }
  }

  async getCurrentInfo() {
    try {
      const url = this.page.url();
      const title = await this.page.title();
      const text = await this.page.evaluate(() => 
        document.body.innerText.substring(0, 3000)
      );
      
      return { url, title, text };
    } catch (error) {
      logger.error('SmartWebSearchAgent', 'Erro ao obter informações:', error);
      return { error: error.message };
    }
  }

  async execute(userQuery) {
    const startTime = Date.now();
    logger.info('SmartWebSearchAgent', `Iniciando busca inteligente para: "${userQuery}"`);
    
    if (!await this.initialize()) {
      return { error: 'Falha ao inicializar navegador' };
    }

    try {
      let messages = [
        SYSTEM_PROMPT,
        { 
          role: 'user', 
          content: `Realize uma busca web inteligente para: "${userQuery}". 

ESTRATÉGIA INICIAL SUGERIDA:
1. Navegue para https://www.google.com
2. Analise a página e localize o campo de busca
3. Digite "${userQuery}" no campo de busca
4. Pressione Enter ou clique no botão de busca
5. Analise os resultados e visite os links mais relevantes
6. Extraia informações úteis das páginas visitadas

Execute uma estratégia de busca completa para encontrar informações relevantes e atualizadas sobre esta consulta.` 
        }
      ];

      let maxIterations = 15; // Limite para evitar loops infinitos
      let iterationCount = 0;
      let finalResult = null;
      const visitedUrls = new Set();

      while (iterationCount < maxIterations && !finalResult) {
        iterationCount++;
        logger.debug('SmartWebSearchAgent', `Iteração ${iterationCount}/${maxIterations}`);

        try {
          const response = await chatAi(messages, SEARCH_AGENT_TOOLS);
          
          if (!response?.message?.tool_calls || response.message.tool_calls.length === 0) {
            logger.warn('SmartWebSearchAgent', 'Resposta sem tool_calls, finalizando');
            break;
          }

          // Adicionar mensagem do assistente primeiro
          messages.push(response.message);

          // Processar tool calls
          for (const toolCall of response.message.tool_calls) {
            const { name, arguments: args } = toolCall.function;
            let toolResult;

            logger.debug('SmartWebSearchAgent', `Executando: ${name}`, args);

            switch (name) {
              case 'analyze_page':
                toolResult = await this.analyzePage();
                break;

              case 'click_element':
                toolResult = await this.clickElement(args.selector, args.text);
                break;

              case 'type_text':
                toolResult = await this.typeText(args.selector, args.text, args.clear, args.pressEnter);
                break;

              case 'scroll_page':
                toolResult = await this.scrollPage(args.direction, args.amount);
                break;

              case 'wait_for_element':
                toolResult = await this.waitForElement(args.selector, args.timeout);
                break;

              case 'extract_content':
                toolResult = await this.extractContent(args.selector, args.attribute);
                break;

              case 'navigate_to':
                if (!visitedUrls.has(args.url)) {
                  visitedUrls.add(args.url);
                  toolResult = await this.navigateTo(args.url);
                } else {
                  toolResult = { skipped: true, reason: 'URL já visitada' };
                }
                break;

              case 'get_current_info':
                toolResult = await this.getCurrentInfo();
                break;

              case 'complete_search':
                finalResult = {
                  result: args.result,
                  sources: args.sources || Array.from(visitedUrls),
                  query: userQuery
                };
                toolResult = { completed: true };
                break;

              default:
                toolResult = { error: `Ferramenta desconhecida: ${name}` };
            }

            // Adicionar resposta da ferramenta às mensagens
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(toolResult)
            });
          }

        } catch (error) {
          logger.error('SmartWebSearchAgent', `Erro na iteração ${iterationCount}:`, error);
          // Se falhou nas primeiras 3 iterações, encerrar mais cedo
          if (iterationCount <= 3) {
            logger.warn('SmartWebSearchAgent', 'Falhando cedo - provavelmente problema de configuração');
            break;
          }
          break;
        }
      }

      logger.timing('SmartWebSearchAgent', `Busca concluída em ${Date.now() - startTime}ms após ${iterationCount} iterações`);

      return finalResult || { 
        error: 'Busca não foi completada dentro do limite de iterações',
        partialResults: Array.from(visitedUrls)
      };

    } finally {
      await this.cleanup();
    }
  }
}

// Função principal para ser chamada externamente
export default async function smartWebSearch(query) {
  const agent = new SmartWebSearchAgent();
  return await agent.execute(query);
}
