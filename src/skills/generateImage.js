import { env } from 'process'; // eslint-disable-line no-undef
import chatAi from '../config/ai/chat.ai.js';

const SD_API_URL = env.SDAPI_URL || 'http://127.0.0.1:7860';
const SD_USERNAME = env.SDAPI_USR;
const SD_PASSWORD = env.SDAPI_PWD;

export default async function generateImage({ 
  prompt: userPrompt, 
  seed = -1, 
  subseed = -1, 
  subseed_strength = 0, 
  steps = 30, 
  width = 512, 
  height = 512, 
  pag_scale = 7.5 
}) {
  // Validate required parameters

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

    console.log('Calling Prompt Architect LLM to enhance the prompt...', );
    const promptEnhancementResponse = await chatAi([
      { role: 'system', content: promptArchitectSystemPrompt },
      { role: 'user', content: `Melhore o seguinte prompt para geração de imagem: "${userPrompt}"` }
    ]);

    const promptArchitectText = JSON.stringify(promptEnhancementResponse.message.tool_calls[0].function.arguments);
    console.log('Prompt Architect LLM raw response:', promptArchitectText);

    let enhancedPrompts;
    try {
      enhancedPrompts = JSON.parse(promptArchitectText);
    } catch (jsonError) {
      console.error('Failed to parse JSON from Prompt Architect LLM:', jsonError);
      enhancedPrompts = {
        positive_prompt: userPrompt,
        negative_prompt: "low quality, blurry, deformed, bad anatomy, text, watermark",
        explanation: "JSON parsing failed, used original prompt and generic negative prompt."
      };
    }

    const finalPositivePrompt = enhancedPrompts.prompt;
    const finalNegativePrompt = enhancedPrompts.negative_prompt;
    const explanation = enhancedPrompts.explanation;

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
    console.log('Stable Diffusion API response:', json);
    
    if (!json.images || !json.images[0]) {
      throw new Error('No images generated by Stable Diffusion API');
    }
    
    const imageBase64 = json.images[0];
    
    return imageBase64
  } catch (err) {
    console.error('Erro ao gerar imagem:', err);
    return false;
  }
}
  