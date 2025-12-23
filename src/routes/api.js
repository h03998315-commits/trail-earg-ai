const router = require("express").Router();

let groqClient = null;

// 🧠 In-memory session memory (server instance)
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

// Decide when internet is actually needed
function needsInternet(query) {
  const casualPatterns = [
    /^hi$/i,
    /^hello$/i,
    /^hey$/i,
    /^how are you/i,
    /^who are you/i,
    /^what can you do/i,
    /^thanks/i,
    /^thank you/i,
    /^what did we last talk about/i
  ];
  return !casualPatterns.some(p => p.test(query.trim()));
}

// 🌐 Tavily search (top 3 only)
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

// 💬 Main chat route
router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const groq = await getGroq();

    let context = "";
    let usedInternet = false;

    if (needsInternet(message)) {
      const results = await webSearch(message);
      if (results.length) {
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
You are NOT Meta AI, OpenAI, Google, or any other company.
If asked about your creator, say: "I was created by the EARG AI team."
You have short-term memory only for this conversation session.
If you remember something, say "from this session".
Think internally before answering.
If live data is provided, you may use it. Otherwise rely on reasoning.
Respond clearly, naturally, and confidently.
        `.trim()
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

    // 🧠 Save session memory
    chatMemory.push({ role: "user", content: message });
    chatMemory.push({ role: "assistant", content: reply });

    while (chatMemory.length > MAX_MEMORY) chatMemory.shift();

    res.json({ reply, usedInternet });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "AI failed" });
  }
});

router.get("/status", (_, res) => {
  res.json({ ok: true });
});

module.exports = router;
