class DivineCore {
  constructor(memory) {
    this.memory = memory;
  }

  reflect(input, output) {
    this.memory.save({ input, output, time: Date.now() });
  }

  getState() {
    return { name: "Earg AI", core: "Divine Core" };
  }
}

module.exports = DivineCore;
