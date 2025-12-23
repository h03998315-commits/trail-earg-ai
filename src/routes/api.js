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

// ===== PASS 1: INTERNAL THINKING =====
async function thinkOffline(groq, message, memory) {
  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    temperature: 0.55,
    messages: [
      {
        role: "system",
        content: `
You are EARG AI.

INTERNAL THINKING MODE:
- Think step-by-step silently.
- Decide if your knowledge is sufficient.
- If insufficient, explicitly say: "KNOWLEDGE_GAP".
- Do NOT answer yet.
`
      },
      ...memory,
      { role: "user", content: message }
    ]
  });

  return completion.choices[0].message.content;
}

// ===== PASS 2: FINAL ANSWER =====
async function answer(groq, message, memory, context = "") {
  const messages = [
    {
      role: "system",
      content: `
You are EARG AI.

IDENTITY:
- Created by the EARG AI team.
- Not Meta AI, OpenAI, or Google.

RESPONSE RULES:
- Answer like a highly competent human expert.
- Be concise but thorough.
- Do NOT explain limitations.
- Do NOT mention thinking or searching.
- Never hallucinate facts.
`
    }
  ];

  if (context) {
    messages.push({
      role: "system",
      content: `Live information (use only if helpful):\n${context}`
    });
  }

  messages.push(...memory);
  messages.push({ role: "user", content: message });

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    temperature: 0.6,
    messages
  });

  return completion.choices[0].message.content;
}

// ===== CHAT ROUTE =====
router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const groq = await getGroq();

    let usedInternet = false;

    // ===== THINK FIRST =====
    const internalThought = await thinkOffline(groq, message, chatMemory);

    let finalReply;

    // ===== KNOWLEDGE GAP DETECTED =====
    if (internalThought.includes("KNOWLEDGE_GAP")) {
      const results = await webSearch(message);

      if (results.length > 0) {
        usedInternet = true;

        const context = results
          .map((r, i) => `Source ${i + 1}: ${r.content}`)
          .join("\n\n");

        finalReply = await answer(groq, message, chatMemory, context);
      } else {
        // No good web data → answer honestly
        finalReply = await answer(groq, message, chatMemory);
      }
    } else {
      // Knowledge sufficient → answer directly
      finalReply = await answer(groq, message, chatMemory);
    }

    // ===== SAVE MEMORY =====
    chatMemory.push({ role: "user", content: message });
    chatMemory.push({ role: "assistant", content: finalReply });

    while (chatMemory.length > MAX_MEMORY) chatMemory.shift();

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
