const groq = require("./groq");

async function streamResponse(messages, res) {
  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages,
    stream: true
  });

  for await (const chunk of completion) {
    const token = chunk.choices[0]?.delta?.content;
    if (token) {
      res.write(`data:${token}\n\n`);
    }
  }

  res.write("data:[DONE]\n\n");
  res.end();
}

module.exports = streamResponse;
