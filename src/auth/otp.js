const crypto = require("crypto");
const db = require("../db/init");

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function saveOTP(email, code) {
  const expires = Date.now() + 5 * 60 * 1000;
  db.run("DELETE FROM otps WHERE email=?", [email]);
  db.run(
    "INSERT INTO otps (email, code, expires_at) VALUES (?, ?, ?)",
    [email, code, expires]
  );
}

function verifyOTP(email, code, cb) {
  db.get(
    "SELECT * FROM otps WHERE email=? AND code=?",
    [email, code],
    (err, row) => {
      if (!row || row.expires_at < Date.now()) return cb(false);
      db.run("DELETE FROM otps WHERE email=?", [email]);
      cb(true);
    }
  );
}

module.exports = { generateOTP, saveOTP, verifyOTP };
