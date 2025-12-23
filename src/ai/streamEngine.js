const groq = require("./groq");

async function generateResponse(messages) {
  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages
  });

  return completion.choices[0].message.content;
}

module.exports = generateResponse;
