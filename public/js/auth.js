async function login() {
  const email = document.getElementById("email").value;
  localStorage.setItem("earg_email", email);

  await fetch("/api/auth/request-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });

  window.location.href = "/otp.html";
}

async function verify() {
  const code = document.getElementById("otp").value;
  const email = localStorage.getItem("earg_email");

  const res = await fetch("/api/auth/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code })
  });

  if (res.ok) {
    window.location.href = "/";
  } else {
    alert("Invalid OTP");
  }
}
