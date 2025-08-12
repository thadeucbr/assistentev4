#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import 'dotenv/config';

// Importar wrappers seguros para as skills
import {
  safeGenerateImage,
  safeAnalyzeImage,
  safeGenerateAudio,
  safeCalendar,
  safeLotteryCheck,
  safeReminderManagement,
  safeSendMessage
} from './skill-wrappers.js';

class AssistenteMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'assistente-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  setupToolHandlers() {
    // Registrar handler para listar tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'send_message',
            description: 'Send a text message to the user - primary communication tool',
            inputSchema: {
              type: 'object',
              properties: {
                content: {
                  type: 'string',
                  description: 'Message content to send to the user'
                },
                to: {
                  type: 'string',
                  description: 'Recipient ID (chat ID or group ID). If not provided, will use context from current conversation'
                },
                from: {
                  type: 'string',
                  description: 'Sender context for reply. If not provided, will use context from current conversation'
                },
                quotedMsgId: {
                  type: 'string',
                  description: 'ID of message to quote/reply to. Used for group replies'
                }
              },
              required: ['content']
            }
          },
          {
            name: 'image_generation',
            description: 'Generate images based on text prompts using AI models',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description: 'Text prompt describing the image to generate'
                }
              },
              required: ['prompt']
            }
          },
          {
            name: 'image_analysis',
            description: 'Analyze images and extract information from them',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Image ID or base64 encoded image data'
                },
                prompt: {
                  type: 'string',
                  description: 'Analysis prompt to guide the image analysis'
                }
              },
              required: ['id']
            }
          },
          {
            name: 'audio_generation',
            description: 'Generate audio files from text using text-to-speech and optionally send via WhatsApp',
            inputSchema: {
              type: 'object',
              properties: {
                text: {
                  type: 'string',
                  description: 'Text to convert to speech'
                },
                voice: {
                  type: 'string',
                  description: 'Voice to use for synthesis (optional)'
                },
                speed: {
                  type: 'number',
                  description: 'Speech speed (optional)'
                },
                sendAudio: {
                  type: 'boolean',
                  description: 'Whether to automatically send the generated audio via WhatsApp (default: false)'
                },
                to: {
                  type: 'string',
                  description: 'Recipient ID for audio sending (required if sendAudio is true)'
                }
              },
              required: ['text']
            }
          },
          {
            name: 'calendar_management',
            description: 'Manage Google Calendar events - create, list, and modify calendar entries',
            inputSchema: {
              type: 'object',
              properties: {
                userId: {
                  type: 'string',
                  description: 'User ID for calendar operations'
                },
                query: {
                  type: 'string',
                  description: 'Calendar operation query (e.g., "create event tomorrow at 2pm", "list upcoming events")'
                }
              },
              required: ['userId', 'query']
            }
          },
          {
            name: 'lottery_check',
            description: 'Check lottery results for Brazilian lotteries (Mega-Sena, Quina, Lotofácil)',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Lottery query (e.g., "Mega-Sena latest results", "Quina numbers")'
                }
              },
              required: ['query']
            }
          },
          {
            name: 'reminder_management',
            description: 'Create and manage user reminders',
            inputSchema: {
              type: 'object',
              properties: {
                userId: {
                  type: 'string',
                  description: 'User ID for reminder operations'
                },
                query: {
                  type: 'string',
                  description: 'Reminder operation query'
                }
              },
              required: ['userId', 'query']
            }
          }
        ]
      };
    });

    // Registrar handler para executar tools
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'send_message':
            return await this.handleSendMessage(args);
            
          case 'image_generation':
            return await this.handleImageGeneration(args);
            
          case 'image_analysis':
            return await this.handleImageAnalysis(args);
            
          case 'audio_generation':
            return await this.handleAudioGeneration(args);
            
          case 'calendar_management':
            return await this.handleCalendarManagement(args);
            
          case 'lottery_check':
            return await this.handleLotteryCheck(args);
            
          case 'reminder_management':
            return await this.handleReminderManagement(args);
            
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing tool ${name}: ${error.message}`
        );
      }
    });
  }

  async handleSendMessage(args) {
    const result = await safeSendMessage(args);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  async handleImageGeneration(args) {
    const result = await safeGenerateImage(args);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  async handleImageAnalysis(args) {
    const result = await safeAnalyzeImage(args);
    
    return {
      content: [
        {
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  async handleAudioGeneration(args) {
    const result = await safeGenerateAudio(args);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  async handleCalendarManagement(args) {
    const result = await safeCalendar(args);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  async handleLotteryCheck(args) {
    const result = await safeLotteryCheck(args);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  async handleReminderManagement(args) {
    const result = await safeReminderManagement(args);
    
    return {
      content: [
        {
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Assistente MCP Server running on stdio');
  }
}

// Iniciar o servidor
const server = new AssistenteMCPServer();
server.start().catch(console.error);
