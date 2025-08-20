export default class HttpStreamClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.sessionId = null;
  }

  async sendRequest(payload, onComplete, onError) {
    const url = `${this.baseUrl}/mcp`;
    const headers = {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
    };
    if (this.sessionId) {
      headers["mcp-session-id"] = this.sessionId;
      console.log("➡️ Enviando header mcp-session-id:", this.sessionId);
    }
    try {
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
      const sid = res.headers.get("mcp-session-id");
      if (sid && !this.sessionId) {
        this.sessionId = sid;
        console.log("📌 Sessão inicializada via header (mcp-session-id):", this.sessionId);
      } else if (!sid) {
        console.warn("⚠️ Nenhum header mcp-session-id retornado pelo servidor.");
      }
      const text = await res.text();
      if (!text || text.trim() === "") {
        onComplete && onComplete({ ok: true, sessionId: this.sessionId });
        return;
      }
      // Trata resposta SSE (event: message\ndata: ...)
      const dataLines = text.split('\n').filter(line => line.startsWith('data:'));
      if (dataLines.length > 0) {
        for (const line of dataLines) {
          const jsonStr = line.replace(/^data:\s*/, '');
          try {
            const json = JSON.parse(jsonStr);
            onComplete && onComplete(json);
          } catch (err) {
            console.error("❌ Erro ao parsear JSON da linha SSE:", jsonStr);
            onError && onError(err);
          }
        }
      } else {
        // Tenta parsear como JSON puro
        try {
          const json = JSON.parse(text);
          onComplete && onComplete(json);
        } catch (err) {
          console.error("❌ Erro ao parsear JSON:", text);
          onError && onError(err);
        }
      }
    } catch (err) {
      console.error("❌ Erro na requisição fetch:", err);
      onError && onError(err);
    }
  }
}
