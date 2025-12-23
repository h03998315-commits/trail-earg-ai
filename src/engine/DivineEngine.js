const groq = require("../services/groq");

class DivineEngine {
  constructor(core) {
    this.core = core;
  }

  async process(input) {
    const reply = await groq.generate(input);
    this.core.reflect(input, reply);
    return { reply, core: this.core.getState() };
  }
}

module.exports = DivineEngine;
