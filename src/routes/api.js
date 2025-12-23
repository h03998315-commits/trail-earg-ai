const router = require("express").Router();

let groqClient = null;

// 🧠 In-memory chat history
const chatMemory = [];
const MAX_MEMORY = 8;

// Load Groq safely
async function getGroq() {
  if (!groqClient) {
    const { default: Groq } = await import("groq-sdk");
    groqClient = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
  }
  return groqClient;
}

/* =========================
   🔢 MATH ENGINE (STRICT)
   ========================= */

function isMathQuery(text) {
  return /^[0-9+\-*/().%\s]+$/.test(text.trim());
}

function solveMath(expression) {
  try {
    const cleaned = expression.replace(/%/g, "/100");
    const result = Function(`"use strict"; return (${cleaned})`)();
    if (typeof result === "number" && isFinite(result)) {
      return result;
    }
    return null;
  } catch {
    return null;
  }
}

/* =========================
   🧠 CASUAL CHAT DETECTION
   ========================= */

function isCasual(text) {
  return /^(hi|hello|hey|how are you|how r u|thanks|thank you)$/i.test(
    text.trim()
  );
}

/* =========================
   🌐 INTERNET SEARCH (SMART)
   ========================= */

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

/* =========================
   💬 MAIN CHAT ROUTE
   ========================= */

router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    /* ---------- 1️⃣ PURE MATH ---------- */
    if (isMathQuery(message)) {
      const answer = solveMath(message);
      if (answer !== null) {
        return res.json({
          reply: `${answer}`,
          usedInternet: false
        });
      }
    }

    const groq = await getGroq();

    let context = "";
    let usedInternet = false;

    /* ---------- 2️⃣ INTERNET ONLY WHEN NEEDED ---------- */
    if (!isCasual(message) && message.length > 15) {
      const results = await webSearch(message);
      if (results.length) {
        usedInternet = true;
        context = results
          .map(r => r.content)
          .slice(0, 2)
          .join("\n");
      }
    }

    /* ---------- 3️⃣ NATURAL SYSTEM PROMPT ---------- */
    const messages = [
      {
        role: "system",
        content: `
You are EARG AI, an intelligent assistant created by the EARG AI team.

Behavior rules:
- Be natural, conversational, and human-like.
- Respond normally to greetings (no explanations).
- Use reasoning and logic by default.
- Use live information only if it truly improves accuracy.
- Blend reasoning and real-time info seamlessly.
- Never mention searches, sources, or APIs.
- Never invent personal information.
- If unsure, say so simply.
- Sound confident, helpful, and friendly.
`
      }
    ];

    if (context) {
      messages.push({
        role: "system",
        content: `Real-time information (use if helpful):\n${context}`
      });
    }

    messages.push(...chatMemory);
    messages.push({ role: "user", content: message });

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages,
      temperature: 0.7
    });

    const reply = completion.choices[0].message.content;

    // Save memory
    chatMemory.push({ role: "user", content: message });
    chatMemory.push({ role: "assistant", content: reply });
    while (chatMemory.length > MAX_MEMORY) chatMemory.shift();

    res.json({ reply, usedInternet });

  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "AI failed" });
  }
});

/* =========================
   ❤️ HEALTH CHECK
   ========================= */

router.get("/status", (_, res) => {
  res.json({ ok: true });
});

module.exports = router;
