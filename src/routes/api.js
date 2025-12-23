const router = require("express").Router();

let groqClient = null;

// 🧠 In-memory chat history (per server instance)
const chatMemory = [];
const MAX_MEMORY = 6;

// Load Groq safely (Node 22 compatible)
async function getGroq() {
  if (!groqClient) {
    const { default: Groq } = await import("groq-sdk");
    groqClient = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
  }
  return groqClient;
}

// ✅ Improved: Decide when internet is ACTUALLY needed
function needsInternet(query) {
  const q = query.toLowerCase();

  // Never search for casual or reasoning-only queries
  const noInternetPatterns = [
    /^hi$/,
    /^hello$/,
    /^hey$/,
    /^how are you/,
    /^who are you/,
    /^what can you do/,
    /^thank/,
    /^why /,
    /^how does /,
    /^explain /,
    /^what is /,
    /^define /
  ];

  if (noInternetPatterns.some(p => p.test(q.trim()))) {
    return false;
  }

  // Explicit internet intent
  const internetTriggers = [
    "search",
    "find",
    "online",
    "website",
    "app",
    "review",
    "price",
    "available",
    "latest",
    "download",
    "ios",
    "android",
    "company",
    "startup"
  ];

  return internetTriggers.some(word => q.includes(word));
}

// 🌐 Tavily web search (top 3)
async function webSearch(query) {
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
}

// Main chat route
router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const groq = await getGroq();

    let context = "";
    let usedInternet = false;

    // 🌐 Use internet ONLY when clearly needed
    if (needsInternet(message)) {
      const results = await webSearch(message);

      if (results.length > 0) {
        usedInternet = true;
        context = results.map((r, i) =>
          `Source ${i + 1}: ${r.content}`
        ).join("\n\n");
      }
    }

    const messages = [
      {
        role: "system",
        content: `
You are EARG AI, an assistant created by the EARG AI project.

Identity rules:
- You are NOT Meta AI, OpenAI, Google, or any other company.
- If asked about your creator, say: "I was created by the EARG AI team."

Reasoning rules:
- Think internally first.
- Use the internet ONLY if live information is provided.
- If live data is provided, summarize it confidently.
- Do NOT apologize for limitations.
- Do NOT explain how searching works.
- Do NOT say "I might be wrong because I searched".

Conversation:
- Remember recent messages.
- Respond clearly, directly, and naturally.
`
      }
    ];

    if (context) {
      messages.push({
        role: "system",
        content: `Live internet information:\n${context}`
      });
    }

    messages.push(...chatMemory);

    messages.push({
      role: "user",
      content: message
    });

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages
    });

    const reply = completion.choices[0].message.content;

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
