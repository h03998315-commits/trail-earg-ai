const router = require("express").Router();

let groqClient = null;

// 🧠 In-memory chat history
const chatMemory = [];
const MAX_MEMORY = 8;

// Load Groq safely (Node 22)
async function getGroq() {
  if (!groqClient) {
    const { default: Groq } = await import("groq-sdk");
    groqClient = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
  }
  return groqClient;
}

// Casual messages → no internet
function isCasual(query) {
  const casualPatterns = [
    /^hi$/i,
    /^hello$/i,
    /^hey$/i,
    /^how are you/i,
    /^who are you/i,
    /^what can you do/i,
    /^thanks/i,
    /^thank you/i
  ];
  return casualPatterns.some(p => p.test(query.trim()));
}

// 🌐 Web search (Tavily)
async function webSearch(query) {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.TAVILY_API_KEY}`
      },
      body: JSON.stringify({
        query,
        max_results: 3,
        search_depth: "basic"
      })
    });

    const data = await res.json();
    return data.results || [];
  } catch {
    return [];
  }
}

// Main chat route
router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const groq = await getGroq();

    let context = "";
    let usedInternet = false;

    // 🌐 Use internet for almost everything except casual talk
    if (!isCasual(message)) {
      const results = await webSearch(message);
      if (results.length) {
        usedInternet = true;
        context = results.map((r, i) => (
          `Source ${i + 1}: ${r.content}`
        )).join("\n\n");
      }
    }

    // 🧠 System prompt (CRITICAL)
    const messages = [
      {
        role: "system",
        content: `
You are EARG AI, created by the EARG AI team.
You are NOT Meta AI, OpenAI, Google, or any other company.

Rules:
- Always think and reason first.
- Use your own knowledge and logic as the primary source.
- Internet information is supplemental only.
- If internet data is present, blend it naturally into the answer.
- Never mention searching, browsing, sources, or APIs.
- Never claim access to private data or user profiles.
- Do not guess personal details.
- If unsure, say so honestly.
- Answer like a confident, thoughtful assistant.
`
      }
    ];

    // 🌐 Inject web context silently
    if (context) {
      messages.push({
        role: "system",
        content: `Supplemental real-time information:\n${context}`
      });
    }

    // 🧠 Memory
    messages.push(...chatMemory);

    // User message
    messages.push({
      role: "user",
      content: message
    });

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages,
      temperature: 0.6
    });

    const reply = completion.choices[0].message.content;

    // Save memory
    chatMemory.push({ role: "user", content: message });
    chatMemory.push({ role: "assistant", content: reply });

    while (chatMemory.length > MAX_MEMORY) {
      chatMemory.shift();
    }

    res.json({ reply, usedInternet });

  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "AI failed" });
  }
});

// Health check
router.get("/status", (_, res) => {
  res.json({ ok: true });
});

module.exports = router;
