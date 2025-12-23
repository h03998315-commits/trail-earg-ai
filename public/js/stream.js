function add(role, text) {
  const msg = document.createElement("div");
  msg.className = "msg " + role;
  msg.textContent = text;
  document.getElementById("messages").appendChild(msg);
  msg.scrollIntoView({ behavior: "smooth" });
}

async function send() {
  const input = document.getElementById("input");
  const text = input.value.trim();
  if (!text || !currentChat) return;

  input.value = "";
  add("user", text);

  const res = await fetch(`/api/chats/send/${currentChat}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });

  const data = await res.json();
  add("ai", data.reply);
}
