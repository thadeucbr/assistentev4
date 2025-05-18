export default [
  {
    type: 'function',
    function: {
      name: 'generate_image',
      description: 'Generate an image using the Stable Diffusion API based on a text prompt. The default output size is 512x512 pixels. The prompt MUST be in English.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Text prompt for image generation. Must be in English.' },
          seed: { type: 'number', description: 'Seed for reproducibility. Use -1 for a random seed.' },
          subseed: { type: 'number', description: 'Subseed for additional variation. Use -1 to disable.' },
          subseed_strength: { type: 'number', description: 'Strength of subseed effect (0 to 1).' },
          steps: { type: 'integer', description: 'Diffusion steps. Higher improves quality but increases time.' },
          width: { type: 'integer', default: 512, description: 'Output width in pixels. Minimum 512.' },
          height: { type: 'integer', default: 512, description: 'Output height in pixels. Minimum 512.' },
          pag_scale: { type: 'number', default: 7.5, description: 'Attention guidance scale. Default 7.5.' },
          negative_prompt: { type: 'string', description: 'Negative prompt to exclude unwanted elements.' }
        },
        required: ['prompt']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'send_message',
      description: 'Send a text message to the user.',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'Message content to send.' }
        },
        required: ['content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'analyze_image',
      description: 'Analyze an image using a provided prompt to describe its contents.',
      parameters: {
        type: 'object',
        properties: {
          image: { type: 'string', description: 'Base64 encoded image to analyze.' },
          prompt: { type: 'string', description: 'Prompt guiding the analysis. Must be in English.' }
        },
        required: ['image']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'reminder',
      description: 'Gerencia os lembretes do usuário: "create" para criar e "list" para listar.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', description: 'Ação a ser executada: "create" ou "list".' },
          message: { type: 'string', description: 'Mensagem do lembrete (necessário para criação).' },
          scheduledTime: { type: 'string', description: 'Horário agendado (ISO 8601 ou "now + PT..." ).' }
        },
        required: ['action']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'lottery_check',
      description: 'Verifica resultados de loteria para uma modalidade e sorteio opcionais usando a API da Caixa.',
      parameters: {
        type: 'object',
        properties: {
          modalidade: { type: 'string', description: 'Modalidade da loteria: megasena, lotofacil, quina, lotomania, timemania, duplasena, supersete, loteca, diadesorte.' },
          sorteio: { type: 'string', description: 'Número do concurso. Se omitido, retorna o último resultado.' }
        },
        required: ['modalidade']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browse',
      description: 'Realiza navegação web genérica: abre a URL fornecida, aguarda o carregamento do body e retorna o texto limpo da página. Para buscas na web, utilize sempre o Bing (https://www.bing.com/search?q=...).',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Endereço da página a ser acessada pelo navegador. Para buscas, use https://www.bing.com/search?q=SEU_TERMO' }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'curl',
      description: 'Faz uma requisição HTTP flexível (GET, POST, etc) para uma URL, podendo enviar headers e corpo customizados. Use para acessar APIs públicas ou endpoints que retornam dados estruturados, como JSON. Não retorna HTML ou XML bruto.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL do endpoint a ser acessado.' },
          method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], default: 'GET', description: 'Método HTTP.' },
          headers: { type: 'object', description: 'Headers HTTP opcionais.' },
          body: { type: 'string', description: 'Corpo da requisição (para POST, PUT, PATCH). Pode ser JSON ou texto.' }
        },
        required: ['url']
      }
    }
  }
];