// ============================================================
// HUSH — SYNC ENGINE
// Two jobs, run on a timer + on "online" events:
//   1) processOutbox() — push anything queued locally up to Drive
//   2) pollOnce()       — pull down anything new from Drive
// Both are safe to call repeatedly; everything is idempotent.
// ============================================================

let _folderId = null;
let _syncTimer = null;
let _syncing = false;

function setSyncFolderId(id) {
  _folderId = id;
}

async function processOutbox() {
  if (!navigator.onLine || !_folderId) return;
  const items = await outboxGetAll();
  const key = await getMasterKey();

  for (const item of items) {
    if (item.status === "sending") continue; // already in flight this pass
    try {
      item.status = "sending";
      await outboxUpdate(item);

      // Step 1: upload the media binary first (if any), once.
      if (item.mediaBlob && !item.mediaFileId) {
        const rawBuf = await item.mediaBlob.arrayBuffer();
        const encryptedBytes = await encryptBytes(key, rawBuf);
        const uploaded = await driveUploadBytes(
          _folderId,
          `b_${item.id}.bin`,
          encryptedBytes,
          "application/octet-stream"
        );
        item.mediaFileId = uploaded.id;
        item.mediaSize = item.mediaBlob.size;
        await outboxUpdate(item); // checkpoint — don't redo this if step 2 fails
        // Cache the plaintext blob locally so it displays instantly, offline included
        await mediaCacheSet(uploaded.id, item.mediaBlob);
      }

      // Step 2: upload the (small) encrypted manifest describing the message.
      const manifestPlain = {
        id: item.id,
        version: item.version,
        sender: item.sender,
        createdAt: item.createdAt,
        editedAt: item.editedAt || null,
        type: item.type,
        text: item.text || null,
        mediaFileId: item.mediaFileId || null,
        mediaMime: item.mediaMime || null,
        mediaSize: item.mediaSize || null,
      };
      const { iv, ciphertext } = await encryptText(key, JSON.stringify(manifestPlain));
      const manifestBytes = strToBytes(JSON.stringify({ iv, ciphertext }));
      await driveUploadBytes(
        _folderId,
        `m_${item.id}_${item.version}.json`,
        manifestBytes,
        "application/json"
      );

      // Success — move it from outbox into the real message store.
      await messageUpsert({ ...manifestPlain, status: undefined });
      await outboxRemove(item.localId);
    } catch (e) {
      console.warn("Outbox item failed", item.id, e);
      item.status = "failed";
      item.attempts = (item.attempts || 0) + 1;
      await outboxUpdate(item);
    }
  }
  await renderMessages();
}

async function pollOnce() {
  if (!navigator.onLine || !_folderId || _syncing) return;
  _syncing = true;
  try {
    const key = await getMasterKey();
    const files = await driveListAllFiles(_folderId);
    const manifests = files.filter((f) => f.name.startsWith("m_"));

    for (const f of manifests) {
      if (await seenFileHas(f.id)) continue;
      try {
        const raw = await driveDownloadBytes(f.id);
        const envelope = JSON.parse(bytesToStr(new Uint8Array(raw)));
        const plaintext = await decryptText(key, envelope.iv, envelope.ciphertext);
        const msg = JSON.parse(plaintext);
        await messageUpsert(msg);
        await seenFileMark(f.id);
      } catch (e) {
        console.warn("Failed to process manifest", f.id, e);
      }
    }
    await renderMessages();
  } finally {
    _syncing = false;
  }
}

function startSyncLoop() {
  if (_syncTimer) clearInterval(_syncTimer);
  _syncTimer = setInterval(() => {
    pollOnce();
    processOutbox();
  }, CONFIG.POLL_INTERVAL_MS);

  window.addEventListener("online", () => {
    pollOnce();
    processOutbox();
  });

  // Reopening the app (switching back to the tab, unlocking the phone)
  // should never make you wait for the next timer tick.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      pollOnce();
      processOutbox();
    }
  });

  pollOnce();
  processOutbox();
}
