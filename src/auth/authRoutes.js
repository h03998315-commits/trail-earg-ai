const router = require("express").Router();
const { v4: uuid } = require("uuid");
const db = require("../db/init");
const { generateOTP, saveOTP, verifyOTP } = require("./otp");

router.post("/request-otp", (req, res) => {
  const { email } = req.body;
  const code = generateOTP();
  saveOTP(email, code);

  // TEMP: log OTP (Phase 3 adds email sending)
  console.log("OTP for", email, code);

  res.json({ ok: true });
});

router.post("/verify-otp", (req, res) => {
  const { email, code } = req.body;

  verifyOTP(email, code, valid => {
    if (!valid) return res.status(401).json({ error: "Invalid OTP" });

    db.get("SELECT * FROM users WHERE email=?", [email], (e, user) => {
      if (!user) {
        db.run(
          "INSERT INTO users VALUES (?, ?, ?)",
          [uuid(), email, new Date().toISOString()]
        );
      }
      res.cookie("earg_session", email, { httpOnly: true });
      res.json({ ok: true });
    });
  });
});

module.exports = router;
