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

/* =========================
   🔢 MATH DETECTION + SOLVER
   ========================= */

// Detect pure math expressions
function isMathQuery(text) {
  return /^[0-9+\-*/().%\s]+$/.test(text.trim());
}

// Safe math evaluation
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
   🌐 INTERNET SEARCH (NON-MATH)
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

    /* ---------- 1️⃣ PURE MATH → NO AI, NO INTERNET ---------- */
    if (isMathQuery(message)) {
      const answer = solveMath(message);
      if (answer !== null) {
        return res.json({
          reply: `The correct result is **${answer}**.`,
          usedInternet: false
        });
      }
    }

    /* ---------- 2️⃣ NON-MATH → AI + OPTIONAL INTERNET ---------- */
    const groq = await getGroq();
    let context = "";
    let usedInternet = false;

    const results = await webSearch(message);
    if (results.length) {
      usedInternet = true;
      context = results.map((r, i) => `Source ${i + 1}: ${r.content}`).join("\n\n");
    }

    const messages = [
      {
        role: "system",
        content: `
You are EARG AI, created by the EARG AI team.
You are not Meta AI, OpenAI, Google, or any other company.

Rules:
- Think and reason before answering.
- Use your own knowledge first.
- Internet info is supplemental only.
- Blend reasoning + live info naturally.
- Never mention sources, APIs, or searches.
- Never invent personal data.
- Be calm, accurate, and confident.
`
      }
    ];

    if (context) {
      messages.push({
        role: "system",
        content: `Supplemental real-time information:\n${context}`
      });
    }

    messages.push(...chatMemory);
    messages.push({ role: "user", content: message });

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages,
      temperature: 0.6
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
