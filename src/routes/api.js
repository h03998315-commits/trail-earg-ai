const router = require("express").Router();

let groqClient;

// ===== MEMORY =====
const chatMemory = [];
const MAX_MEMORY = 10;

// ===== LOAD GROQ =====
async function getGroq() {
  if (!groqClient) {
    const { default: Groq } = await import("groq-sdk");
    groqClient = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
  }
  return groqClient;
}

// ===== UNCERTAINTY DETECTION =====
function lacksConfidence(text) {
  const signals = [
    "i don't know",
    "i am not sure",
    "i'm not sure",
    "i don’t have information",
    "i do not have information",
    "unclear",
    "not enough information",
    "cannot confirm",
    "might be",
    "possibly",
    "hard to say"
  ];
  const lower = text.toLowerCase();
  return signals.some(s => lower.includes(s));
}

// ===== WEB SEARCH =====
async function webSearch(query) {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.TAVILY_API_KEY}`
    },
    body: JSON.stringify({
      query,
      max_results: 4,
      search_depth: "basic"
    })
  });

  const data = await res.json();
  return data.results || [];
}

// ===== CHAT ROUTE =====
router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const groq = await getGroq();

    // ===== PASS 1: THINK FROM TRAINING =====
    const baseMessages = [
      {
        role: "system",
        content: `
You are EARG AI.

IDENTITY:
- Created by the EARG AI team.
- Not Meta AI, OpenAI, Google, or any provider.
- Never mention training data or model origin.

BEHAVIOR:
- Answer using your own reasoning first.
- If unsure, clearly express uncertainty.
- Do NOT invent facts.
- Do NOT mention searching or browsing.
- Think like an expert.
`
      },
      ...chatMemory,
      { role: "user", content: message }
    ];

    const firstCompletion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.6,
      messages: baseMessages
    });

    let firstReply = firstCompletion.choices[0].message.content;
    let finalReply = firstReply;
    let usedInternet = false;

    // ===== PASS 2: GO ONLINE IF NEEDED =====
    if (lacksConfidence(firstReply)) {
      const results = await webSearch(message);

      if (results.length > 0) {
        usedInternet = true;

        const context = results
          .map((r, i) => `Source ${i + 1}: ${r.content}`)
          .join("\n\n");

        const secondMessages = [
          {
            role: "system",
            content: `
You are EARG AI.

TASK:
- Combine your own reasoning with the live information below.
- Correct any uncertainty from earlier.
- Produce ONE confident, clear answer.
- Do NOT mention sources or searching.
`
          },
          {
            role: "system",
            content: `Live information:\n${context}`
          },
          { role: "user", content: message }
        ];

        const secondCompletion = await groq.chat.completions.create({
          model: "llama-3.1-8b-instant",
          temperature: 0.6,
          messages: secondMessages
        });

        finalReply = secondCompletion.choices[0].message.content;
      }
    }

    // ===== SAVE MEMORY =====
    chatMemory.push({ role: "user", content: message });
    chatMemory.push({ role: "assistant", content: finalReply });

    while (chatMemory.length > MAX_MEMORY) {
      chatMemory.shift();
    }

    res.json({
      reply: finalReply,
      usedInternet
    });

  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "AI failed" });
  }
});

// ===== STATUS =====
router.get("/status", (_, res) => {
  res.json({ ok: true });
});

module.exports = router;
