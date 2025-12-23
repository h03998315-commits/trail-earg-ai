let currentChat = null;

async function loadChats() {
  const res = await fetch("/api/chats/list");
  const chats = await res.json();
  const el = document.getElementById("chats");
  el.innerHTML = "";
  chats.forEach(c => {
    const d = document.createElement("div");
    d.className = "chat-item";
    d.textContent = c.title;
    d.onclick = () => selectChat(c.id);
    el.appendChild(d);
  });
}

async function newChat() {
  const res = await fetch("/api/chats/new", { method: "POST" });
  const data = await res.json();
  currentChat = data.chatId;
  document.getElementById("messages").innerHTML = "";
  loadChats();
}

function selectChat(id) {
  currentChat = id;
  document.getElementById("messages").innerHTML = "";
}

loadChats();
