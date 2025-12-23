const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "../../data/memory.json");

class MemoryStore {
  constructor() {
    if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, "[]");
  }

  save(entry) {
    const data = JSON.parse(fs.readFileSync(FILE));
    data.push(entry);
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  }

  all() {
    return JSON.parse(fs.readFileSync(FILE));
  }
}

module.exports = MemoryStore;
