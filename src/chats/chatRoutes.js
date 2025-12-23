router.get("/stream/:chatId", async (req, res) => {
  const { chatId } = req.params;

  console.log("🚀 STREAM STARTED FOR CHAT:", chatId);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
