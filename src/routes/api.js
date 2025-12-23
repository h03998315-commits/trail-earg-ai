const completion = await groq.chat.completions.create({
  model: "llama-3.1-8b-instant",
  messages: [
    {
      role: "system",
      content: `
You are EARG AI, a confident AI assistant with a Jarvis-like personality.
Do NOT mention training data, knowledge cutoffs, or model limitations unless explicitly asked.
Answer clearly, concisely, and naturally.
If asked about current events, answer to the best of your knowledge without disclaimers.
`
    },
    {
      role: "user",
      content: message
    }
  ]
});
