function add(role, text) {
  const m = document.createElement("div");
  m.className = "msg " + role;
  m.textContent = text;
  document.getElementById("messages").appendChild(m);
}

function send() {
  const input = document.getElementById("input");
  const text = input.value.trim();
  if (!text || !currentChat) return;

  input.value = "";
  add("user", text);

  const ai = document.createElement("div");
  ai.className = "msg ai";
  document.getElementById("messages").appendChild(ai);

  const evt = new EventSource(`/api/chats/stream/${currentChat}`);

  evt.onmessage = e => {
    if (e.data === "[DONE]") evt.close();
    else ai.textContent += e.data;
  };
}
