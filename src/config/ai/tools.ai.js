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
          description: 'An agent specialized in web browsing and searching. Use this tool when you need to find information on the web, browse a specific URL, or perform a web search. It handles retries and fallbacks internally.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: `The user's original query or a concise search term for the information needed.` }
            },
            required: ['query']
          }
        }
      }
    ];