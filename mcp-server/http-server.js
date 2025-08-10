import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';

// Importar os wrappers seguros
import {
  safeAnalyzeSentiment,
  safeInferInteractionStyle,
  safeCurl,
  safeGenerateImage,
  safeAnalyzeImage,
  safeGenerateAudio,
  safeCalendar,
  safeLotteryCheck,
  safeReminderManagement,
  safeUserProfileUpdate
} from './skill-wrappers.js';

const app = express();
const port = process.env.MCP_HTTP_PORT || 3001;

// Métricas básicas
let metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  toolUsage: {},
  startTime: new Date().toISOString()
};

// Middlewares de segurança
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limite de 100 requests por IP
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' }
});

app.use('/tools', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));

// Middleware de autenticação (opcional)
const authenticateApiKey = (req, res, next) => {
  if (!process.env.MCP_API_KEY) {
    return next(); // Pular autenticação se não configurada
  }

  const apiKey = req.headers['authorization']?.replace('Bearer ', '');
  
  if (!apiKey || apiKey !== process.env.MCP_API_KEY) {
    metrics.failedRequests++;
    return res.status(401).json({ error: 'API Key inválida ou ausente' });
  }
  
  next();
};

// Middleware de métricas
app.use((req, res, next) => {
  metrics.totalRequests++;
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    server: 'Assistente MCP HTTP Server',
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// Métricas endpoint
app.get('/metrics', (req, res) => {
  res.json({
    ...metrics,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage()
  });
});

// Listar tools disponíveis
app.get('/tools', authenticateApiKey, async (req, res) => {
  try {
    const tools = [
      {
        name: 'image_generation',
        description: 'Generate images based on text prompts using AI models',
        parameters: ['prompt', 'model?']
      },
      {
        name: 'image_analysis',
        description: 'Analyze images and extract information from them',
        parameters: ['id', 'prompt?']
      },
      {
        name: 'audio_generation',
        description: 'Generate audio files from text using text-to-speech',
        parameters: ['text', 'voice?', 'speed?']
      },
      {
        name: 'calendar_management',
        description: 'Manage Google Calendar events',
        parameters: ['userId', 'query']
      },
      {
        name: 'lottery_check',
        description: 'Check lottery results for Brazilian lotteries',
        parameters: ['query']
      },
      {
        name: 'reminder_management',
        description: 'Create and manage user reminders',
        parameters: ['userId', 'query']
      },
      {
        name: 'sentiment_analysis',
        description: 'Analyze the sentiment of text messages',
        parameters: ['text']
      },
      {
        name: 'interaction_style_inference',
        description: 'Infer user interaction style from their messages',
        parameters: ['message']
      },
      {
        name: 'user_profile_update',
        description: 'Update user profile summary based on conversation history',
        parameters: ['userId', 'conversationHistory']
      },
      {
        name: 'http_request',
        description: 'Make HTTP requests to external APIs',
        parameters: ['url', 'method?', 'headers?', 'body?']
      }
    ];
    
    metrics.successfulRequests++;
    res.json({ tools, count: tools.length });
  } catch (error) {
    metrics.failedRequests++;
    res.status(500).json({ error: error.message });
  }
});

// Executar tool específica
app.post('/tools/:toolName', authenticateApiKey, async (req, res) => {
  const { toolName } = req.params;
  const args = req.body;
  
  // Atualizar métricas de uso
  if (!metrics.toolUsage[toolName]) {
    metrics.toolUsage[toolName] = 0;
  }
  metrics.toolUsage[toolName]++;
  
  try {
    let result;
    
    switch (toolName) {
      case 'image_generation':
        result = await safeGenerateImage(args);
        break;
        
      case 'image_analysis':
        result = await safeAnalyzeImage(args);
        break;
        
      case 'audio_generation':
        result = await safeGenerateAudio(args);
        break;
        
      case 'calendar_management':
        result = await safeCalendar(args);
        break;
        
      case 'lottery_check':
        result = await safeLotteryCheck(args);
        break;
        
      case 'reminder_management':
        result = await safeReminderManagement(args);
        break;
        
      case 'sentiment_analysis':
        result = await safeAnalyzeSentiment(args.text);
        break;
        
      case 'interaction_style_inference':
        result = await safeInferInteractionStyle(args.message);
        break;
        
      case 'user_profile_update':
        result = await safeUserProfileUpdate(args);
        break;
        
      case 'http_request':
        result = await safeCurl(args);
        break;
        
      default:
        metrics.failedRequests++;
        return res.status(404).json({ 
          error: `Tool '${toolName}' não encontrada`,
          availableTools: Object.keys(metrics.toolUsage)
        });
    }
    
    metrics.successfulRequests++;
    res.json({ 
      success: true,
      tool: toolName,
      result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    metrics.failedRequests++;
    console.error(`Erro executando tool ${toolName}:`, error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      tool: toolName,
      timestamp: new Date().toISOString()
    });
  }
});

// Middleware de erro global
app.use((error, req, res, next) => {
  metrics.failedRequests++;
  console.error('Erro global:', error);
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: error.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint não encontrado',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: [
      'GET /health',
      'GET /metrics', 
      'GET /tools',
      'POST /tools/:toolName'
    ]
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Recebido SIGTERM, encerrando servidor graciosamente...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Recebido SIGINT, encerrando servidor graciosamente...');
  process.exit(0);
});

// Iniciar servidor
app.listen(port, '0.0.0.0', () => {
  console.log(`🌐 Servidor HTTP MCP rodando em http://0.0.0.0:${port}`);
  console.log(`🔒 Autenticação API Key: ${process.env.MCP_API_KEY ? 'Habilitada' : 'Desabilitada'}`);
  console.log(`🌍 CORS Origins: ${process.env.ALLOWED_ORIGINS || 'Todas'}`);
  console.log(`📊 Métricas disponíveis em: http://0.0.0.0:${port}/metrics`);
  console.log(`🏥 Health check em: http://0.0.0.0:${port}/health`);
});

export default app;
