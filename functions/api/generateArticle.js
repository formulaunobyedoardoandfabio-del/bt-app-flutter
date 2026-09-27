// Assistente ChatGPT per il pannello Admin. Stessa logica dell'originale
// functions/index.js: costruisce il prompt lato server, chiama OpenAI.
// La chiave OpenAI vive solo qui (env var), mai nel client.
const { setCors } = require("./_lib/cors");

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo non permesso" });

  try {
    const { title, summary, category } = req.body || {};
    if (!title) return res.status(400).json({ error: "title obbligatorio" });

    const prompt = [
      `Scrivi un articolo per un'app di news di Formula 1 (B&T).`,
      `Categoria: ${category || "NEWS"}.`,
      `Titolo: ${title}`,
      summary ? `Sottotitolo/riassunto: ${summary}` : null,
      ``,
      `Scrivi in italiano, tono da redazione sportiva, 3-4 paragrafi brevi, senza inventare citazioni dirette di persone reali né dati di gara specifici non forniti. Restituisci solo il testo dell'articolo, senza titolo ripetuto e senza note editoriali.`,
    ].filter(Boolean).join("\n");

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 700,
        temperature: 0.7,
      }),
    });

    if (!r.ok) {
      const errBody = await r.text().catch(() => "");
      console.error("OpenAI error", r.status, errBody);
      return res.status(502).json({ error: "ChatGPT non ha risposto correttamente" });
    }

    const data = await r.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";
    res.json({ content });
  } catch (e) {
    console.error("generateArticle error", e);
    res.status(500).json({ error: e.message || "Errore interno" });
  }
};
