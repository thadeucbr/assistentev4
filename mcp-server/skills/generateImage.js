import { env } from 'process'; // eslint-disable-line no-undef
import chatAi from '../config/ai/chat.ai.js';
import { retryAiJsonCall } from '../utils/aiResponseUtils.js';
import { logError } from '../utils/logger.js';
import { generateImageWithDallE } from '../services/OpenAIDalleService.js';
import { generateImageWithGPT5Nano } from '../services/GPT5NanoImageService.js';
import { generateImageWithOpenAITool } from '../services/OpenAIImageToolService.js';

const SD_API_URL = env.SDAPI_URL || 'http://127.0.0.1:7860';
const SD_USERNAME = env.SDAPI_USR;
const SD_PASSWORD = env.SDAPI_PWD;

/**
 * Gera imagem usando Stable Diffusion
 * @param {Object} params - Parâmetros para Stable Diffusion
 * @returns {Promise<string>} Base64 da imagem
 */
async function generateImageWithStableDiffusion({
  prompt: userPrompt,
  seed = -1,
  subseed = -1,
  subseed_strength = 0,
  steps = 30,
  width = 512,
  height = 512,
  pag_scale = 7.5
}) {
  try {
    const promptArchitectSystemPrompt = `
Você é o 'Prompt Architect', um engenheiro de prompt especialista para o modelo de geração de imagem Stable Diffusion. Sua missão é colaborar com os usuários para transformar suas ideias, mesmo que vagas, em prompts perfeitamente estruturados e detalhados que gerem imagens de alta qualidade.

PRINCÍPIOS FUNDAMENTAIS:

1. **Princípio da Prioridade**: Os tokens no início do prompt exercem maior influência. Sempre posicione o sujeito principal e estilo dominante primeiro.

2. **Estrutura Hierárquica**: Organize o prompt em blocos funcionais:
   - Sujeito e Ação (o "quê" da imagem)
   - Meio e Estilo (técnica artística)
   - Composição e Enquadramento
   - Iluminação e Atmosfera
   - Cor e Detalhes Adicionais
   - Artista (quando apropriado)

3. **Modelo Híbrido**: Use frases descritivas curtas separadas por vírgulas, combinando clareza semântica com controle técnico preciso.

TÉCNICAS AVANÇADAS:
- **Ponderação**: Use (palavra:peso) para enfatizar conceitos importantes. Exemplo: (olhos azuis:1.3)
- **De-ênfase**: Use [palavra] ou (palavra:0.7) para reduzir atenção
- **Separação**: Use vírgulas para separação suave, BREAK para isolamento completo

LÉXICO DE ARTISTAS (use quando apropriado):
- **Greg Rutkowski**: fantasia épica, iluminação dramática, batalhas
- **Alphonse Mucha**: Art Nouveau, figuras femininas elegantes, decorativo
- **H.R. Giger**: biomecânico, sci-fi horror, surrealismo sombrio
- **Makoto Shinkai**: anime, paisagens hiper-realistas, céus detalhados
- **Artgerm**: retratos estilizados, cores vibrantes, digital art
- **Ansel Adams**: fotografia P&B, paisagens, alto contraste
- **Zdzisław Beksiński**: surrealismo sombrio, distópico

ESTILOS VISUAIS PRINCIPAIS:
- **Cinematic**: "cinematic film still, shallow depth of field, vignette, highly detailed, high budget, bokeh, moody, epic, film grain"
- **Anime**: "anime artwork, anime style, key visual, vibrant, studio anime, highly detailed"
- **Photorealistic**: "photorealistic, hyperrealistic, 8k photo, professional photography, sharp focus"
- **Fantasy Art**: "ethereal fantasy concept art, magnificent, celestial, painterly, epic, magical"
- **Cyberpunk/Neonpunk**: "neonpunk style, cyberpunk, neon, ultramodern, high contrast, cinematic"

MAPEAMENTO PREDITIVO DE PROMPTS NEGATIVOS:

Analise o prompt positivo para identificar riscos e construa negativos direcionados:
- **portrait, face, close-up** → (poorly drawn face:1.2), ugly, cloned face, distorted face, extra eyes
- **hands, holding, fingers** → (poorly drawn hands:1.3), mutated hands, extra fingers, fused fingers, disconnected limbs
- **full body, person** → bad anatomy, bad proportions, malformed limbs, extra limbs, long neck
- **photorealistic, photography** → painting, drawing, cartoon, 3d, render, anime, blurry
- **anime, cartoon** → photorealistic, photography, 3d, realistic, real life
- **multiple subjects** → cloned face, duplicate
- **qualquer prompt** → worst quality, low quality, jpeg artifacts, blurry, watermark, text

PROCESSO DE ANÁLISE:

1. **Deconstrução**: Identifique sujeito, ação, estilo, composição, iluminação
2. **Enriquecimento**: Adicione termos técnicos específicos e detalhes visuais
3. **Hierarquização**: Organize componentes por importância (Princípio da Prioridade)
4. **Otimização**: Aplique ponderação e sintaxe avançada quando necessário
5. **Predição de Riscos**: Construa prompt negativo baseado nos elementos do prompt positivo

FORMATO DE RESPOSTA:

Retorne APENAS um objeto JSON válido com as seguintes chaves:
{
  "positive_prompt": "prompt positivo otimizado em inglês, seguindo todas as diretrizes",
  "negative_prompt": "prompt negativo preditivo e direcionado em inglês",
  "explanation": "explicação detalhada em português do raciocínio, técnicas aplicadas e melhorias implementadas"
}

IMPORTANTE: Sua resposta deve ser APENAS o objeto JSON. Não inclua texto antes ou depois do JSON.
`;

    console.log('Calling Prompt Architect LLM to enhance the prompt...');
    
    // Função que faz a chamada de IA, recebendo o número da tentativa
    const makeAiCall = async (attemptNumber) => {
      let currentMessages = [
        { role: 'system', content: promptArchitectSystemPrompt },
        { role: 'user', content: `Melhore o seguinte prompt para geração de imagem: "${userPrompt}"` }
      ];

      // Para retries, adiciona instrução específica sobre o formato JSON
      if (attemptNumber > 0) {
        currentMessages.push({
          role: 'user',
          content: 'Por favor, responda APENAS com um objeto JSON válido, sem nenhum texto adicional antes ou depois. Certifique-se de que é um JSON bem formado.'
        });
      }

      return await chatAi(currentMessages, []);
    };

    // Usar a função de retry com JSON
    const result = await retryAiJsonCall(makeAiCall, 3, 1000);
    
    let enhancedPrompts = {};
    
    if (result.success) {
      enhancedPrompts = result.data;
      console.log('JSON do Prompt Architect parseado com sucesso:', enhancedPrompts);
    } else {
      console.warn('Todas as tentativas de obter JSON válido do Prompt Architect falharam. Usando fallback.');
      enhancedPrompts = {
        positive_prompt: userPrompt,
        negative_prompt: "low quality, blurry, deformed, bad anatomy, text, watermark",
        explanation: "JSON parsing failed, used original prompt and generic negative prompt."
      };
    }

    const finalPositivePrompt = enhancedPrompts.positive_prompt || userPrompt;
    const finalNegativePrompt = enhancedPrompts.negative_prompt || "low quality, blurry, deformed, bad anatomy, text, watermark";

    console.log('Final Positive Prompt:', finalPositivePrompt);
    console.log('Final Negative Prompt:', finalNegativePrompt);

    const method = 'POST';
    const headers = new Headers();
    const body = JSON.stringify({
      "prompt": finalPositivePrompt,
      "negative_prompt": finalNegativePrompt,
      "seed": seed,
      "subseed": subseed,
      "subseed_strength": subseed_strength,
      "batch_size": 1,
      "steps": steps,
      "width": width,
      "height": height,
      "pag_scale": pag_scale,
    });

    headers.set('Content-Type', 'application/json');
    if (SD_USERNAME && SD_PASSWORD) {
      headers.set('Authorization', `Basic ${btoa(`${SD_USERNAME}:${SD_PASSWORD}`)}`);
    }

    const res = await fetch(`${SD_API_URL}/sdapi/v1/txt2img`, { method, headers, body });
    if (!res.ok) {
      throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    console.log('Stable Diffusion API response received');
    
    if (!json.images || !json.images[0]) {
      throw new Error('No images generated by Stable Diffusion API');
    }
    
    return json.images[0];

  } catch (err) {
    logError(err, 'generateImageWithStableDiffusion - Failed to generate image');
    console.error('Erro ao gerar imagem com Stable Diffusion:', err);
    throw err;
  }
}

export default async function generateImage({ 
  prompt: userPrompt, 
  seed = -1, 
  subseed = -1, 
  subseed_strength = 0, 
  steps = 30, 
  width = 512, 
  height = 512, 
  pag_scale = 7.5,
  from = null // Parâmetro para identificar o destinatário (contexto MCP)
}) {
  // Obter o provedor de imagem das variáveis de ambiente (fora do try para estar disponível no catch)
  const imageProvider = env.IMAGE_PROVIDER || 'stable-diffusion';
  
  try {
    console.log('Iniciando geração de imagem...');
    console.log('Prompt do usuário:', userPrompt);
    console.log('Provedor de imagem:', imageProvider);

    let imageResult;
    let generationDetails = {};

    if (imageProvider === 'openai-native-tool') {
      console.log('Usando ferramenta nativa de geração de imagem da OpenAI');
      
      const toolResult = await generateImageWithOpenAITool(userPrompt);
      
      if (!toolResult.success) {
        throw new Error(`OpenAI native tool falhou: ${toolResult.error}`);
      }
      
      imageResult = toolResult.imageBase64;
      generationDetails = {
        method: 'OpenAI Native Tool',
        model: toolResult.model || 'gpt-5-nano-2025-08-07',
        revisedPrompt: toolResult.revisedPrompt
      };
      console.log('Imagem gerada com sucesso usando ferramenta nativa da OpenAI');
      
    } else if (imageProvider === 'openai-dalle') {
      console.log('Usando OpenAI DALL-E para geração de imagem');
      
      const dalleResult = await generateImageWithDallE({
        prompt: userPrompt
      });

      if (!dalleResult.success) {
        throw new Error(`DALL-E falhou: ${dalleResult.error}`);
      }

      imageResult = dalleResult.imageBase64;
      generationDetails = {
        method: 'OpenAI DALL-E',
        model: dalleResult.model || 'dall-e-3',
        revisedPrompt: dalleResult.revisedPrompt,
        quality: dalleResult.quality,
        size: dalleResult.size
      };
      console.log('Imagem gerada com sucesso usando DALL-E');
      
    } else if (imageProvider === 'openai-gpt5-nano') {
      console.log('Usando GPT-5-nano para geração de imagem');
      
      const gpt5Result = await generateImageWithGPT5Nano(userPrompt);
      
      if (!gpt5Result.success) {
        throw new Error(`GPT-5-nano falhou: ${gpt5Result.error}`);
      }
      
      imageResult = gpt5Result.imageBase64;
      generationDetails = {
        method: 'GPT-5-nano Direct',
        model: 'gpt-5-nano-2025-08-07'
      };
      console.log('Imagem gerada com sucesso usando GPT-5-nano diretamente');
      
    } else {
      // Default para Stable Diffusion
      console.log('Usando Stable Diffusion para geração de imagem');
      
      imageResult = await generateImageWithStableDiffusion({
        prompt: userPrompt,
        seed,
        subseed,
        subseed_strength,
        steps,
        width,
        height,
        pag_scale
      });
      
      generationDetails = {
        method: 'Stable Diffusion',
        model: 'Local SD',
        settings: { steps, width, height, seed, pag_scale }
      };
      console.log('Imagem gerada com sucesso usando Stable Diffusion');
    }

    // SEMPRE enviar a imagem via WhatsApp se temos resultado
    if (imageResult) {
      console.log('Enviando imagem gerada via WhatsApp...');
      
      try {
        // Importar a função de envio de imagem
        const { default: sendImage } = await import('../whatsapp/sendImage.js');
        
        // Determinar o destinatário
        const recipient = from || process.env.DEFAULT_WHATSAPP_RECIPIENT || '5511971704940@c.us';
        
        // Preparar caption com detalhes da geração
        let caption = `🎨 *Imagem Gerada*\n\n`;
        caption += `📝 *Prompt:* ${userPrompt}\n`;
        caption += `🤖 *Método:* ${generationDetails.method}\n`;
        if (generationDetails.model) {
          caption += `⚙️ *Modelo:* ${generationDetails.model}\n`;
        }
        if (generationDetails.revisedPrompt && generationDetails.revisedPrompt !== userPrompt) {
          caption += `✨ *Prompt otimizado:* ${generationDetails.revisedPrompt}\n`;
        }
        
        // Enviar a imagem
        const sendResult = await sendImage(recipient, imageResult, caption);
        
        if (sendResult) {
          console.log('Imagem enviada com sucesso via WhatsApp');
          return {
            success: true,
            sent: true,
            recipient: recipient,
            description: `✅ Imagem gerada e enviada com sucesso! A imagem foi criada usando ${generationDetails.method} e enviada para ${recipient}. Não é necessário tentar gerar novamente.`,
            prompt: userPrompt,
            generationDetails: generationDetails,
            provider: imageProvider,
            // NÃO retornar imageBase64 para evitar buffer overflow
            note: 'Imagem enviada via WhatsApp - base64 não retornado para evitar overflow',
            // Sinal para o sistema parar de tentar
            completed: true,
            action_completed: true
          };
        } else {
          throw new Error('Falha no envio via WhatsApp');
        }
        
      } catch (sendError) {
        logError(sendError, 'generateImage - Failed to send image via WhatsApp');
        console.error('Erro ao enviar imagem via WhatsApp:', sendError);
        return {
          success: false,
          sent: false,
          error: `Imagem gerada mas falha no envio: ${sendError.message}`,
          description: `Imagem foi gerada usando ${generationDetails.method}, mas não foi possível enviar`,
          prompt: userPrompt,
          generationDetails: generationDetails,
          provider: imageProvider
        };
      }
    } else {
      throw new Error('Nenhuma imagem foi gerada');
    }

  } catch (err) {
    logError(err, 'generateImage - Failed to generate image');
    console.error('Erro ao gerar imagem:', err);
    return {
      success: false,
      sent: false,
      error: err.message,
      description: `Falha na geração de imagem usando ${imageProvider}: ${err.message}`,
      prompt: userPrompt,
      provider: imageProvider || 'unknown'
    };
  }
}
