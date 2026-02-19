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

    // OpenAI Responses API (Structured Outputs via JSON Schema)
    // Docs: /v1/responses  [oai_citation:2‡OpenAI Platform](https://platform.openai.com/docs/api-reference/responses?utm_source=chatgpt.com)
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
المطلوب: تعطي 4 حقول فقط بصيغة JSON صحيحة:
- english: الاسم الإنجليزي المصحح/الأنسب
- pronunciation_ar: نطق تقريبي بالحروف العربية للاسم الإنجليزي
- arabic: الترجمة/المقابل العربي الأنسب (إن وجد)
- description_ar: وصف عربي قصير وواضح (سطر أو سطرين). بدون تفاصيل طويلة.

قواعد:
- صحح الأخطاء الإملائية في المصطلح قبل الإجابة.
- الوصف والشرح عربي فقط (هنا وصف قصير فقط).
- لا تكتب أي كلام خارج JSON.`
            }
          ]
        },
        {
          role: "user",
          content: [{ type: "text", text: input }]
        }
      ],
      // Structured output
      response_format: {
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

    // Extract the JSON text from the response output
    // Most deployments will have output_text aggregated in SDKs, but we parse from output items here.
    let jsonText = "";
    if (Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item && Array.isArray(item.content)) {
          for (const c of item.content) {
            if (c?.type === "output_text" && typeof c.text === "string") {
              jsonText += c.text;
            }
          }
        }
      }
    }

    let obj;
    try {
      obj = JSON.parse(jsonText);
    } catch {
      // fallback: sometimes structured output returns directly in a field; try that
      obj = data?.output_parsed || null;
    }

    if (!obj) {
      res.status(500).send("Failed to parse model JSON.");
      return;
    }

    res.status(200).json(obj);
  } catch (e) {
    res.status(500).send(String(e?.message || e));
  }
}
