// ============================================================
// HUSH — CHAT UI
// Renders from local IndexedDB only (works fully offline).
// Sending always goes through the outbox queue first, so a
// failed upload never silently loses a message — it just sits
// there marked "failed" with a retry button until it goes through.
// ============================================================

let CURRENT_IDENTITY = null;
let SEARCH_QUERY = "";

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2) + Date.now();
}

async function getMediaURL(message) {
  if (!message.mediaFileId) return null;
  const cached = await mediaCacheGet(message.mediaFileId);
  if (cached) return URL.createObjectURL(cached);

  if (!navigator.onLine) return null; // can't fetch it right now
  try {
    const key = await getMasterKey();
    const raw = await driveDownloadBytes(message.mediaFileId);
    const decrypted = await decryptBytes(key, raw);
    const blob = new Blob([decrypted], { type: message.mediaMime || "application/octet-stream" });
    await mediaCacheSet(message.mediaFileId, blob);
    return URL.createObjectURL(blob);
  } catch (e) {
    console.warn("Media fetch failed", e);
    return null;
  }
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

async function renderMessages() {
 let _lastRenderSignature = null;

async function renderMessages() {
  const list = document.getElementById("chat-list");
  const stored = await messagesGetAll();
  const outbox = await outboxGetAll();

  const pendingIds = new Set(outbox.map((o) => o.id));
  const merged = stored
    .filter((m) => !pendingIds.has(m.id))
    .concat(outbox.map((o) => ({ ...o, _outboxLocalId: o.localId })));

  merged.sort((a, b) => a.createdAt - b.createdAt);

  const filtered = SEARCH_QUERY
    ? merged.filter((m) => (m.text || "").toLowerCase().includes(SEARCH_QUERY.toLowerCase()))
    : merged;

  const signature = JSON.stringify(
    filtered.map((m) => [m.id, m.version || 1, m.status || "", m.editedAt || "", m.text || ""])
  );
  if (signature === _lastRenderSignature) return;
  _lastRenderSignature = signature;

  const wasNearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;

  list.innerHTML = "";
  for (const m of filtered) {
    list.appendChild(await renderBubble(m));
  }

  if (wasNearBottom) {
    list.scrollTop = list.scrollHeight;
  }
}
}

async function renderBubble(m) {
  const wrap = document.createElement("div");
  const mine = m.sender === CURRENT_IDENTITY;
  wrap.className = `bubble-row ${mine ? "mine" : "theirs"}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const meta = document.createElement("div");
  meta.className = "bubble-meta";
  meta.textContent = `${m.sender} · ${formatTime(m.createdAt)}${m.editedAt ? " · edited" : ""}`;
  bubble.appendChild(meta);

  if (m.type === "text") {
    const p = document.createElement("div");
    p.className = "bubble-text";
    p.textContent = m.text;
    bubble.appendChild(p);
  } else {
    const url = await getMediaURL(m);
    if (m.type === "photo") {
      const img = document.createElement("img");
      img.className = "bubble-media";
      img.src = url || "";
      img.alt = "Photo";
      bubble.appendChild(img);
    } else if (m.type === "video") {
      const vid = document.createElement("video");
      vid.className = "bubble-media";
      vid.src = url || "";
      vid.controls = true;
      bubble.appendChild(vid);
    } else if (m.type === "voice") {
      const audio = document.createElement("audio");
      audio.src = url || "";
      audio.controls = true;
      bubble.appendChild(audio);
    }
    if (!url) {
      const note = document.createElement("div");
      note.className = "bubble-note";
      note.textContent = "Not downloaded yet — connect to the internet";
      bubble.appendChild(note);
    }
  }

  if (m.status === "pending") {
    const s = document.createElement("div");
    s.className = "bubble-status";
    s.textContent = "Sending…";
    bubble.appendChild(s);
  } else if (m.status === "failed") {
    const s = document.createElement("div");
    s.className = "bubble-status failed";
    s.textContent = "Failed to send — tap to retry";
    s.onclick = () => retryOutboxItem(m._outboxLocalId);
    bubble.appendChild(s);
  }

  if (mine && m.type === "text" && m.status !== "pending" && m.status !== "failed") {
    const editBtn = document.createElement("button");
    editBtn.className = "bubble-edit";
    editBtn.textContent = "Edit";
    editBtn.onclick = () => startEdit(m);
    bubble.appendChild(editBtn);
  }

  wrap.appendChild(bubble);
  return wrap;
}

async function sendText(text) {
  if (!text.trim()) return;
  const item = {
    id: uuid(),
    version: 1,
    sender: CURRENT_IDENTITY,
    createdAt: Date.now(),
    type: "text",
    text: text.trim(),
    mediaFileId: null,
    mediaMime: null,
    status: "pending",
    attempts: 0,
  };
  await outboxAdd(item);
  await renderMessages();
  processOutbox(); // fire and forget — UI already shows "sending"
}

async function sendMedia(type, blob, mimeType) {
  const item = {
    id: uuid(),
    version: 1,
    sender: CURRENT_IDENTITY,
    createdAt: Date.now(),
    type,
    text: null,
    mediaBlob: blob,
    mediaFileId: null, // filled in once the binary upload succeeds
    mediaMime: mimeType,
    status: "pending",
    attempts: 0,
  };
  await outboxAdd(item);
  await renderMessages();
  processOutbox();
}

function startEdit(message) {
  const input = document.getElementById("chat-input");
  input.value = message.text;
  input.focus();
  input.dataset.editingId = message.id;
  input.dataset.editingVersion = message.version || 1;
}

async function sendEditedText(text) {
  const input = document.getElementById("chat-input");
  const editingId = input.dataset.editingId;
  const editingVersion = parseInt(input.dataset.editingVersion || "1", 10);
  delete input.dataset.editingId;
  delete input.dataset.editingVersion;

  const item = {
    id: editingId,
    version: editingVersion + 1,
    sender: CURRENT_IDENTITY,
    createdAt: Date.now(),
    editedAt: Date.now(),
    type: "text",
    text: text.trim(),
    mediaFileId: null,
    mediaMime: null,
    status: "pending",
    attempts: 0,
  };
  await outboxAdd(item);
  await renderMessages();
  processOutbox();
}

async function retryOutboxItem(localId) {
  const all = await outboxGetAll();
  const item = all.find((o) => o.localId === localId);
  if (!item) return;
  item.status = "pending";
  await outboxUpdate(item);
  await renderMessages();
  processOutbox();
}

function initChatUI(identity) {
  CURRENT_IDENTITY = identity;

  const input = document.getElementById("chat-input");
  const sendBtn = document.getElementById("chat-send");
  const searchInput = document.getElementById("chat-search");
  const photoBtn = document.getElementById("chat-attach-photo");
  const videoBtn = document.getElementById("chat-attach-video");
  const voiceBtn = document.getElementById("chat-attach-voice");

  sendBtn.onclick = async () => {
    const text = input.value;
    if (!text.trim()) return;
    if (input.dataset.editingId) {
      await sendEditedText(text);
    } else {
      await sendText(text);
    }
    input.value = "";
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  searchInput.addEventListener("input", (e) => {
    SEARCH_QUERY = e.target.value;
    renderMessages();
  });

  photoBtn.onclick = async () => {
    const file = await capturePhoto();
    if (file) await sendMedia("photo", file, file.type || "image/jpeg");
  };

  videoBtn.onclick = async () => {
    const file = await captureVideo();
    if (file) await sendMedia("video", file, file.type || "video/mp4");
  };

  let recorder = null;
  let recording = false;
  voiceBtn.onclick = async () => {
    if (!recording) {
      recorder = new VoiceRecorder();
      await recorder.start();
      recording = true;
      voiceBtn.textContent = "⏹";
      voiceBtn.classList.add("recording");
    } else {
      const blob = await recorder.stop();
      recording = false;
      voiceBtn.textContent = "🎤";
      voiceBtn.classList.remove("recording");
      await sendMedia("voice", blob, "audio/webm");
    }
  };

  renderMessages();
}
