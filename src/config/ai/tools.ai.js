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
          name: 'generate_audio',
          description: 'Gera um áudio a partir de um texto e envia para o usuário. Use para responder o usuário com áudio.',
          parameters: {
            type: 'object',
            properties: {
              textToSpeak: {
                type: 'string',
                description: 'O texto que será transformado em áudio.'
              }
            },
            required: ['textToSpeak']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'web_search',
          description: 'Performs a web search to find information or URLs. Use this when you need to find a website or information you don't know.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'The search query.' }
            },
            required: ['query']
          }
        }
      }
    ];