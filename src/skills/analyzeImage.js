async function getBase64Image(id) {
  if (!id) {
    console.error('getBase64Image: id is required');
    return false;
  }
  try {
    const payload = {
      args: {
        message: id
      }
    };
    const res = await fetch(`${process.env.WHATSAPP_URL}/decryptMedia`, {
      method: 'POST',
      headers: {
        'api_key': process.env.WHATSAPP_SECRET,
        'Content-Type': 'application/json',
        'accept': '*/*'
      },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success && json.response) {
      return json.response.replace('data:image/jpeg;base64,', '');
    } else {
      console.error('getBase64Image error:', json.error || json);
      return false;
    }
  } catch (err) {
    console.error('getBase64Image exception:', err);
    return false;
  }
}
export default async function analyzeImage({ id, prompt = 'What is in this picture?' }) {
  try {
    console.log(`Initializing analyzeImage with prompt: ${prompt}`);
    console.log(`Base64 image: ${id}`);
    const base64Image = await getBase64Image(id);    
    const endpoint = process.env.OLLAMA_ANALYZE_URL || 'http://localhost:11434/api/generate';
    const payload = {
      model: process.env.OLLAMA_ANALYZE_MODEL || 'llava',
      prompt: 'Descreva detalhadamente tudo o que está presente nesta imagem, se houver, transcreva todos os textos visíveis na imagem.',
      stream: false,
      images: [base64Image]
    };
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.status !== 200) {
      const json = await res.json();
      console.log(`AnalyzeImage error: ${JSON.stringify(json)}`);
      console.log(`AnalyzeImage error status: ${res.status}`);
      return `Error: ${res.status}`;
    }
    const json = await res.json();
    console.log(`AnalyzeImage response: ${JSON.stringify(json)}`);
    return json.response;
  } catch (err) {
    return { error: err.message || 'Erro desconhecido', stack: err.stack || undefined };
  }
}