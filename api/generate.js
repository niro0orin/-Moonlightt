export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(500).send("Missing OPENAI_API_KEY in Vercel Environment Variables.");
      return;
    }

    const { term } = req.body || {};
    const input = String(term || "").trim();
    if (!input) {
      res.status(400).send("Missing term.");
      return;
    }

    const payload = {
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "text",
              text:
`أنت مساعد مصطلحات.
أعد فقط JSON صحيح يحتوي:
- english
- pronunciation_ar
- arabic
- description_ar

قواعد:
- صحح الأخطاء الإملائية.
- الوصف عربي فقط.
- لا تكتب أي شيء خارج JSON.`
            }
          ]
        },
        {
          role: "user",
          content: [{ type: "text", text: input }]
        }
      ],

      text: {
        format: {
          type: "json_schema",
          name: "term_card",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              english: { type: "string" },
              pronunciation_ar: { type: "string" },
              arabic: { type: "string" },
              description_ar: { type: "string" }
            },
            required: ["english", "pronunciation_ar", "arabic", "description_ar"]
          }
        }
      },

      temperature: 0.2
    };

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const errText = await r.text();
      res.status(500).send(errText);
      return;
    }

    const data = await r.json();

    let jsonText = data.output_text || "";

    if (!jsonText && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item?.content) {
          for (const c of item.content) {
            if (c?.type === "output_text") {
              jsonText += c.text;
            }
          }
        }
      }
    }

    const obj = JSON.parse(jsonText);

    res.status(200).json(obj);

  } catch (e) {
    res.status(500).send(String(e?.message || e));
  }
}
