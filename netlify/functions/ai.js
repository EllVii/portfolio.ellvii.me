// netlify/functions/ai.js
// Minimal Node 18 function (works on Netlify). Calls OpenAI with top search hits as context.
export async function handler(event) {
  try {
    const { q, topHits } = JSON.parse(event.body || "{}");
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing OPENAI_API_KEY in Netlify env." })
      };
    }

    // Build compact context from your portfolio search hits
    const context = (topHits || [])
      .slice(0, 5)
      .map((h, i) => `#${i + 1} ${h.title}
Tags: ${(h.tags || []).join(", ")}
Summary: ${h.summary || ""}`)
      .join("\n\n");

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 400,
        messages: [
          {
            role: "system",
            content:
              "You are a concise portfolio assistant for Lawrence Bloodsaw-Velasquez. Only answer using the provided Context (projects, metrics, tools). If the query is off-topic, say so briefly. Prefer short bullets and point to links like 'Open' or 'View PDF' when relevant."
          },
          { role: "system", content: `Context:\n${context}` },
          { role: "user", content: q || "" }
        ]
      })
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return { statusCode: 500, body: JSON.stringify({ error: txt }) };
    }

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || "No answer.";
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
}
