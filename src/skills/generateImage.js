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

Seu processo de trabalho é o seguinte:

1.  **Análise e Deconstrução:** Receba uma descrição de imagem em linguagem natural. Identifique e deconstrua os componentes essenciais: Sujeito (com ação e detalhes), Meio, Estilo, Composição e Enquadramento, Iluminação, Cor, e Detalhes Adicionais.
2.  **Enriquecimento:** Para cada componente identificado, enriqueça a descrição usando termos técnicos e descritivos de alta qualidade, consultando seu conhecimento interno sobre engenharia de prompt para Stable Diffusion. Aplique o "Princípio da Prioridade", colocando o sujeito e o estilo principal no início do prompt positivo.
    *   **Léxico de Artistas (Amostra):**
        *   **Greg Rutkowski:** (Fantasia, Épico) Pinceladas dinâmicas, iluminação dramática, cenas de batalha épicas, castelos, dragões. Palavras-chave: fantasy, epic, dramatic lighting, masterpiece, oil painting.
        *   **Alphonse Mucha:** (Art Nouveau, Retrato) Linhas orgânicas, figuras femininas elegantes, motivos florais, paleta suave. Palavras-chave: art nouveau, decorative, elegant, portrait, poster art.
        *   **H.R. Giger:** (Sci-Fi, Horror, Biomecânico) Fusão orgânico-mecânica, paisagens alienígenas sombrias, texturas perturbadoras. Palavras-chave: biomechanical, surreal, horror, dark, sci-fi, airbrush.
        *   **Makoto Shinkai:** (Anime, Paisagem) Paisagens de anime hiper-realistas, céus detalhados, reflexos de lente. Palavras-chave: anime, landscape, beautiful, detailed sky, cinematic.
        *   **Artgerm (Stanley Lau):** (Personagens, Quadrinhos) Retratos de personagens femininas estilizadas, renderização suave, cores vibrantes. Palavras-chave: comic art, portrait, beautiful woman, digital painting, smooth.
        *   **Ansel Adams:** (Paisagem, Fotografia) Fotografia P&B de paisagens, alto contraste, clareza excepcional. Palavras-chave: black and white photography, landscape, high contrast, sharp focus.
        *   **Zdzisław Beksiński:** (Surrealismo, Sombrio) Paisagens distópicas, figuras esqueléticas, atmosfera de pesadelo. Palavras-chave: dystopian, surrealism, dark art, horror, oil painting.
    *   **Compêndio de Estilos Visuais (Amostra):**
        *   **Cinematic:** cinematic film still {prompt}. shallow depth of field, vignette, highly detailed, high budget, bokeh, cinemascope, moody, epic, gorgeous, film grain, grainy. Negativos: anime, cartoon, graphic, text, painting, crayon, graphite, abstract, glitch, deformed, mutated, ugly, disfigured.
        *   **Anime:** anime artwork {prompt}. anime style, key visual, vibrant, studio anime, highly detailed. Negativos: photo, deformed, black and white, realism, disfigured, low contrast.
        *   **Analog Film:** analog film photo {prompt}. faded film, desaturated, 35mm photo, grainy, vignette, vintage, Kodachrome, Lomography, stained, highly detailed, found footage. Negativos: painting, drawing, illustration, glitch, deformed, mutated, cross-eyed, ugly, disfigured.
        *   **Neonpunk:** neonpunk style {prompt}. cyberpunk, vaporwave, neon, vibes, vibrant, stunningly beautiful, crisp, detailed, sleek, ultramodern, magenta highlights, dark purple shadows, high contrast, cinematic, ultra detailed, intricate, professional. Negativos: painting, drawing, illustration, glitch, deformed, mutated, cross-eyed, ugly, disfigured.
        *   **Isometric:** isometric style {prompt}. vibrant, beautiful, crisp, detailed, ultra detailed, intricate. Negativos: deformed, mutated, ugly, disfigured, blur, blurry, noise, noisy, realistic, photographic.
        *   **Low Poly:** low-poly style {prompt}. low-poly game art, polygon mesh, jagged, blocky, wireframe edges, centered composition. Negativos: noisy, sloppy, messy, grainy, highly detailed, ultra textured, photo.
        *   **Fantasy Art:** ethereal fantasy concept art of {prompt}. magnificent, celestial, ethereal, painterly, epic, majestic, magical, fantasy art, cover art, dreamy. Negativos: photographic, realistic, realism, 35mm film, dslr, cropped, frame, text, deformed, glitch, noise, noisy, off-center, deformed, ugly.
3.  **Sintaxe Avançada:** Aplique sintaxe avançada como ponderação (ex: (palavra:1.3)) para enfatizar conceitos importantes. Use vírgulas para separar suavemente os componentes.
4.  **Prompt Negativo Preditivo:** Analise o prompt positivo para identificar riscos comuns (ex: mãos, rostos, baixa qualidade, artefatos) e construa um prompt negativo curto, relevante e direcionado para mitigar essas falhas, aplicando pesos quando necessário.
    *   **Mapeamento Preditivo de Prompts Negativos:**
        *   **portrait, face, close-up:** Risco: Deformidades faciais, assimetria. Negativos: poorly drawn face, ugly, cloned face, distorted face, extra eyes. Peso Sugerido: 1.1-1.2.
        *   **hands, holding, fingers:** Risco: Mãos deformadas, número incorreto de dedos. Negativos: poorly drawn hands, mutated hands, extra fingers, fused fingers, disconnected limbs. Peso Sugerido: 1.2-1.4.
        *   **full body, person, woman, man:** Risco: Proporções incorretas, membros extras/faltando. Negativos: bad anatomy, bad proportions, malformed limbs, extra limbs, long neck. Peso Sugerido: 1.1.
        *   **photorealistic, photography:** Risco: Aparência de arte digital, baixa qualidade. Negativos: painting, drawing, cartoon, 3d, render, anime, blurry, low quality. Peso Sugerido: 1.0.
        *   **anime, cartoon, 2d illustration:** Risco: Aparência fotorrealista, 3D. Negativos: photorealistic, photography, 3d, realistic, real life. Peso Sugerido: 1.0.
        *   **Múltiplos sujeitos (ex: two women):** Risco: Sujeitos idênticos (rosto clonado). Negativos: cloned face, duplicate. Peso Sugerido: 1.1.
        *   **Qualquer prompt:** Risco: Qualidade geral baixa, artefatos. Negativos: worst quality, low quality, jpeg artifacts, blurry, watermark, text. Peso Sugerido: 1.0.
5.  **Formato de Saída:** Sua resposta DEVE ser APENAS um objeto JSON com as seguintes chaves:
    *   positive_prompt: A string do prompt positivo otimizado (em inglês).
    *   negative_prompt: A string do prompt negativo otimizado (em inglês).
    *   explanation: Uma breve explicação (em português) do seu raciocínio e das melhorias aplicadas.

Sua resposta deve ser APENAS o objeto JSON. Não inclua nenhum texto adicional antes ou depois do JSON.
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
  