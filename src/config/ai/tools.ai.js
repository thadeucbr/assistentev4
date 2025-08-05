export default [
      {
        type: 'function',
        function: {
          name: 'image_generation_agent',
          description: 'An agent specialized in generating images based on a text prompt. Use this tool when the user asks to create or generate an image.',
          parameters: {
            type: 'object',
            properties: {
              prompt: { type: 'string', description: 'The user\'s request or a concise description of the image to generate.' }
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
          name: 'image_analysis_agent',
          description: 'An agent specialized in analyzing images. Use this tool when the user provides an image and asks for its analysis.',
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
          name: 'reminder_agent',
          description: 'An agent specialized in managing user reminders. Use this tool when the user asks to create or list reminders.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'The user\'s request regarding reminders (e.g., "create a reminder to call mom tomorrow", "list my reminders").' }
            },
            required: ['query']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'lottery_check_agent',
          description: 'An agent specialized in checking lottery results. Use this tool when the user asks for lottery results.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'The user\'s query regarding lottery results (e.g., "Mega-Sena results", "Quina latest draw").' }
            },
            required: ['query']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'audio_generation_agent',
          description: 'An agent specialized in generating audio from text. Use this tool when the user asks to generate audio or respond with audio.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'The text to be converted into audio.' }
            },
            required: ['query']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'information_retrieval_agent',
          description: 'Agente especializado em busca web inteligente. Este agente possui controle total sobre um navegador e pode: navegar por sites, interagir com páginas web, clicar em elementos, preencher formulários, analisar conteúdo, e extrair informações relevantes. Ele busca automaticamente informações atualizadas usando estratégias inteligentes de navegação. Use esta ferramenta sempre que precisar de informações em tempo real, dados atualizados, ou quando o conhecimento interno não for suficiente.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: `A consulta ou pergunta do usuário para a qual você precisa buscar informações atualizadas na web. Seja específico e claro sobre o que está procurando.` }
            },
            required: ['query']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'calendar_agent',
          description: 'Agente especializado em gerenciamento de eventos do Google Calendar. Pode criar eventos na agenda, listar próximos compromissos e gerar arquivos iCal para que o usuário possa importar em seu próprio calendário. Use esta ferramenta quando o usuário quiser agendar reuniões, criar compromissos, marcar eventos ou gerenciar sua agenda.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'A solicitação do usuário relacionada ao calendário (ex: "agendar reunião amanhã às 14h", "listar meus próximos eventos", "criar evento para sexta-feira").' }
            },
            required: ['query']
          }
        }
      }
    ];