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

  await fetch(`/api/chats/message/${currentChat}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });

  const ai = document.createElement("div");
  ai.className = "msg ai";
  document.getElementById("messages").appendChild(ai);

  const evt = new EventSource(`/api/chats/stream/${currentChat}`);

  evt.onmessage = e => {
    if (e.data === "[DONE]") {
      evt.close();
    } else {
      ai.textContent += e.data;
      ai.scrollIntoView({ behavior: "smooth" });
    }
  };
    }
