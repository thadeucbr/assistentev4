export default async function analyzeImage(base64Image, prompt = 'What is in this picture?') {
  try {
    console.log(`Initializing analyzeImage with prompt: ${prompt}`);
    console.log(`Base64 image: ${base64Image}`);
    const endpoint = process.env.OLLAMA_ANALYZE_URL || 'http://localhost:11434/api/generate';
    const payload = {
      model: process.env.OLLAMA_ANALYZE_MODEL || 'llava',
      prompt: prompt,
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