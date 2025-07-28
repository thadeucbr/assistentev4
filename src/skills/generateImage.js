import { env } from 'process'; // eslint-disable-line no-undef
import { getGenerativeModel } from '../config/ai/gemini';
import { sendImage } from '../whatsapp/sendImage';

const sd_url = env.SDAPI_URL || 'http://127.0.0.1:7860';
const sd_username = env.SDAPI_USR;
const sd_password = env.SDAPI_PWD;

export default async function generateImage({ prompt: userPrompt, remoteJid, seed = -1, subseed = -1, subseed_strength = 0, steps = 30, width = 512, height = 512, pag_scale = 7.5 }) {
  try {
    const generativeModel = getGenerativeModel();

    const promptArchitectSystemPrompt = `
Você é o 'Prompt Architect', um engenheiro de prompt especialista para o modelo de geração de imagem Stable Diffusion. Sua missão é transformar ideias, mesmo que vagas, em prompts perfeitamente estruturados e detalhados que gerem imagens de alta qualidade.

Seu processo de trabalho é o seguinte:

1.  **Análise e Deconstrução:** Receba uma descrição de imagem em linguagem natural. Identifique e deconstrua os componentes essenciais: Sujeito (com ação e detalhes), Meio, Estilo, Composição e Enquadramento, Iluminação, Cor, e Detalhes Adicionais.
2.  **Enriquecimento:** Para cada componente identificado, enriqueça a descrição usando termos técnicos e descritivos de alta qualidade, consultando seu conhecimento interno sobre engenharia de prompt para Stable Diffusion (equivalente às Tabelas 1.1, 4.1 e 4.2 do GEMINI.md). Aplique o "Princípio da Prioridade", colocando o sujeito e o estilo principal no início do prompt positivo.
3.  **Sintaxe Avançada:** Aplique sintaxe avançada como ponderação (ex: \`(palavra:1.3)\`) para enfatizar conceitos importantes. Use vírgulas para separar suavemente os componentes.
4.  **Prompt Negativo Preditivo:** Analise o prompt positivo para identificar riscos comuns (ex: mãos, rostos, baixa qualidade, artefatos) e construa um prompt negativo curto, relevante e direcionado para mitigar essas falhas, aplicando pesos quando necessário (equivalente à Tabela 3.1 do GEMINI.md).
5.  **Formato de Saída:** Sua saída DEVE ser um objeto JSON com as seguintes chaves:
    *   \`positive_prompt\`: A string do prompt positivo otimizado.
    *   \`negative_prompt\`: A string do prompt negativo otimizado.
    *   \`explanation\`: Uma breve explicação (em português) do seu raciocínio e das melhorias aplicadas.

Sua resposta deve ser APENAS o objeto JSON. Não inclua nenhum texto adicional antes ou depois do JSON.
`;

    console.log('Calling Prompt Architect LLM to enhance the prompt...');
    const promptEnhancementResponse = await generativeModel.generateContent([
      { text: promptArchitectSystemPrompt },
      { text: `Melhore o seguinte prompt para geração de imagem: "${userPrompt}"` }
    ]);

    const promptArchitectText = await promptEnhancementResponse.response.text();
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

    const finalPositivePrompt = enhancedPrompts.positive_prompt;
    const finalNegativePrompt = enhancedPrompts.negative_prompt;
    const explanation = enhancedPrompts.explanation;

    console.log('Final Positive Prompt:', finalPositivePrompt);
    console.log('Final Negative Prompt:', finalNegativePrompt);
    console.log('Explanation from Prompt Architect:', explanation);

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
    if (sd_username && sd_password) {
      headers.set('Authorization', `Basic ${btoa(`${sd_username}:${sd_password}`)}`);
    }

    const res = await fetch(`${sd_url}/sdapi/v1/txt2img`, { method, headers, body });
    if (res.status !== 200) {
      throw new Error(`Error: ${res.status}`);
    }

    const json = await res.json();
    console.log(json);
    
    const imageBase64 = json.images[0];
    
    // Send the generated image and the explanation
    await sendImage(remoteJid, imageBase64, `Imagem gerada com sucesso!\n\n${explanation}`);
    
    return true;
  } catch (err) {
    console.error('Erro ao gerar imagem:', err);
    // Send an error message back to the user
    await sendImage(remoteJid, null, `Desculpe, houve um erro ao gerar a imagem: ${err.message}`);
    return false;
  }
}
  