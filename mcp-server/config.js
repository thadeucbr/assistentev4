// Variáveis de ambiente para o MCP Server
export const MCP_CONFIG = {
  SERVER_NAME: 'assistente-mcp-server',
  SERVER_VERSION: '1.0.0',
  PORT: process.env.MCP_PORT || 3001,
  
  // Configurações específicas para tools
  WHATSAPP: {
    URL: process.env.WHATSAPP_URL,
    SECRET: process.env.WHATSAPP_SECRET
  },
  
  OPENAI: {
    API_KEY: process.env.OPENAI_API_KEY,
    MODEL: process.env.OPENAI_MODEL || 'gpt-4'
  },
  
  OLLAMA: {
    URL: process.env.OLLAMA_URL || 'http://localhost:11434',
    MODEL: process.env.OLLAMA_MODEL || 'llama3.1'
  },
  
  GOOGLE: {
    CREDENTIALS_PATH: process.env.GOOGLE_CREDENTIALS_PATH
  },
  
  // Configurações de logs
  LOGGING: {
    LEVEL: process.env.LOG_LEVEL || 'info',
    ENABLED: process.env.MCP_LOGGING !== 'false'
  }
};

export default MCP_CONFIG;
