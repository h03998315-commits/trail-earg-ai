const router = require("express").Router();
const Memory = require("../memory/MemoryStore");
const Core = require("../core/DivineCore");
const Engine = require("../engine/DivineEngine");

const memory = new Memory();
const core = new Core(memory);
const engine = new Engine(core);

router.post("/chat", async (req, res) => {
  const result = await engine.process(req.body.message);
  res.json(result);
});

router.get("/status", (_, res) => res.json({ ok: true }));

module.exports = router;
