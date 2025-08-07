# Análise de Imagens - Processamento Local vs Remoto

Este documento descreve a nova funcionalidade de análise de imagens que permite escolher entre processamento local (Ollama) e processamento remoto (OpenAI Vision).

## Visão Geral

A skill `analyzeImage` foi expandida para suportar dois provedores:

- **Ollama (Local)**: Processamento usando modelos multimodais locais (ex: LLaVA)
- **OpenAI Vision (Remoto)**: Processamento usando a API OpenAI Vision (GPT-4 Vision)

## Configuração

### Variável de Controle Principal

```bash
# Escolha o provedor para análise de imagem
IMAGE_ANALYSIS_PROVIDER=ollama  # ou "openai"
```

### Configurações do Ollama (Processamento Local)

```bash
# URL do servidor Ollama
OLLAMA_ANALYZE_URL=http://localhost:11434/api/generate

# Modelo multimodal para análise de imagens
OLLAMA_IMAGE_ANALYZE_MODEL=llava
```

### Configurações do OpenAI Vision (Processamento Remoto)

```bash
# Chave da API OpenAI (obrigatória)
OPENAI_API_KEY=sk-...

# Modelo de visão da OpenAI
OPENAI_VISION_MODEL=gpt-4o-mini

# Máximo de tokens para resposta
OPENAI_VISION_MAX_TOKENS=500

# Nível de detalhamento da análise
OPENAI_VISION_DETAIL=auto  # low, high, auto
```

## Comparação entre Provedores

| Aspecto | Ollama (Local) | OpenAI Vision (Remoto) |
|---------|----------------|------------------------|
| **Privacidade** | ✅ Total - dados não saem do servidor | ❌ Dados enviados para OpenAI |
| **Custo** | ✅ Gratuito após setup inicial | ❌ Pago por token/requisição |
| **Velocidade** | ⚡ Depende do hardware local | ⚡ Depende da conexão de rede |
| **Qualidade** | 📊 Boa com modelos adequados | 📊 Excelente com GPT-4 Vision |
| **Setup** | 🔧 Requer instalação local | 🔧 Apenas chave API |
| **Recursos** | 💾 Usa recursos do servidor | ☁️ Não usa recursos locais |
| **Disponibilidade** | 🌐 Independente de internet | 🌐 Requer internet estável |

## Como Usar

### 1. Configuração no .env

Copie as configurações do `.env.example` para seu `.env` e ajuste conforme necessário:

```bash
# Para processamento local
IMAGE_ANALYSIS_PROVIDER=ollama
OLLAMA_IMAGE_ANALYZE_MODEL=llava

# Para processamento remoto
IMAGE_ANALYSIS_PROVIDER=openai
OPENAI_API_KEY=sua_chave_aqui
OPENAI_VISION_MODEL=gpt-4o-mini
```

### 2. Teste da Configuração

Execute o script de teste para verificar se tudo está funcionando:

```bash
node test-image-analysis.js
```

### 3. Uso via WhatsApp

Envie uma imagem para o bot e ele automaticamente usará o provedor configurado para análise.

## Arquivos Modificados

### Novos Arquivos
- `src/services/OpenAIVisionService.js` - Serviço robusto para OpenAI Vision
- `test-image-analysis.js` - Script de teste dos provedores
- `docs/IMAGE_ANALYSIS_FEATURE.md` - Esta documentação

### Arquivos Modificados
- `src/skills/analyzeImage.js` - Atualizado com novo sistema de provedores
- `.env.example` - Adicionadas novas configurações

## Fallback e Tolerância a Falhas

O sistema possui fallback automático:

1. Se `IMAGE_ANALYSIS_PROVIDER` não estiver definida, usa `AI_PROVIDER`
2. Se nenhuma estiver definida, usa Ollama por padrão
3. Em caso de erro, retorna informações detalhadas do erro

## API do OpenAI Vision Service

### Função Principal
```javascript
import { analyzeImageWithOpenAIVision } from '../services/OpenAIVisionService.js';

const result = await analyzeImageWithOpenAIVision(base64Image, prompt);
```

### Função para Múltiplas Imagens
```javascript
import { analyzeMultipleImagesWithOpenAIVision } from '../services/OpenAIVisionService.js';

const result = await analyzeMultipleImagesWithOpenAIVision([image1, image2], prompt);
```

### Função de Teste
```javascript
import { testOpenAIVision } from '../services/OpenAIVisionService.js';

const testResult = await testOpenAIVision();
```

## Monitoramento e Logs

O sistema inclui logs detalhados para debug:

- Provedor selecionado
- Parâmetros utilizados
- Tempo de resposta
- Uso de tokens (OpenAI)
- Erros e exceções

## Considerações de Segurança

### Ollama (Local)
- ✅ Dados não deixam o servidor
- ✅ Sem custos por uso
- ⚠️ Requer recursos computacionais locais

### OpenAI (Remoto)
- ⚠️ Imagens são enviadas para OpenAI
- ⚠️ Custos por uso
- ✅ Não requer recursos locais
- ✅ Qualidade superior

## Migração

Para migrar de configuração existente:

1. **Se você usava apenas Ollama**: adicione `IMAGE_ANALYSIS_PROVIDER=ollama`
2. **Se você usava apenas OpenAI**: adicione `IMAGE_ANALYSIS_PROVIDER=openai`
3. **Para alternar dinamicamente**: altere a variável e reinicie o serviço

## Troubleshooting

### Problemas Comuns

1. **OpenAI retorna erro 401**: Verificar OPENAI_API_KEY
2. **Ollama não responde**: Verificar se o servidor está rodando
3. **Modelo não encontrado**: Verificar se o modelo está baixado (Ollama)
4. **Limite de tokens**: Aumentar OPENAI_VISION_MAX_TOKENS

### Debug

Use o script de teste para diagnosticar problemas:

```bash
node test-image-analysis.js
```

O script mostra todas as configurações atuais e testa cada provedor disponível.
