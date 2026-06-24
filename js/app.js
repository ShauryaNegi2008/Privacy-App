// ============================================================
// HUSH — APP CONTROLLER
// Screen flow:
//   calculator --(PIN)--> [first device: passphrase -> identity
//   -> connect Drive]  OR  [known device: "Let's gooo" button]
//   --> chat
// ============================================================

let _masterKey = null;

async function getMasterKey() {
  if (_masterKey) return _masterKey;
  const stored = await metaGet("masterKey");
  if (stored) {
    _masterKey = stored;
    return _masterKey;
  }
  return null;
}

async function setMasterKeyFromPassphrase(passphrase) {
  const key = await deriveKeyFromPassphrase(passphrase);
  await metaSet("masterKey", key);
  _masterKey = key;
  return key;
}

async function clearMasterKey() {
  _masterKey = null;
  await metaSet("masterKey", null);
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((el) => el.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// Tries to decrypt one existing manifest (if any) to confirm the
// typed passphrase actually matches what's already in the shared
// folder. Returns true if it matches (or nothing exists yet to check).
async function verifyPassphraseAgainstFolder(folderId, key) {
  const files = await driveListAllFiles(folderId);
  const manifest = files.find((f) => f.name.startsWith("m_"));
  if (!manifest) return true;
  try {
    const raw = await driveDownloadBytes(manifest.id);
    const envelope = JSON.parse(bytesToStr(new Uint8Array(raw)));
    await decryptText(key, envelope.iv, envelope.ciphertext);
    return true;
  } catch (e) {
    return false;
  }
}

async function handleUnlock() {
  showScreen("screen-loading");

  const key = await getMasterKey();
  const identity = await metaGet("identity");
  const folderId = await metaGet("driveFolderId");

  if (key && identity && folderId) {
    showScreen("screen-gooo");
    document.getElementById("gooo-button").onclick = () => enterChat(identity, folderId);
    return;
  }

  runSetupWizard();
}

async function runSetupWizard() {
  let key = await getMasterKey();
  let identity = await metaGet("identity");
  let folderId = await metaGet("driveFolderId");

  if (!key) {
    showScreen("screen-passphrase");
    return; // continues via the form submit handler below
  }
  if (!identity) {
    showScreen("screen-identity");
    return;
  }
  if (!folderId) {
    showScreen("screen-connect-drive");
    return;
  }
  enterChat(identity, folderId);
}

function enterChat(identity, folderId) {
  setSyncFolderId(folderId);
  initChatUI(identity);
  startSyncLoop();
  showScreen("screen-chat");
}

function wireSetupScreens() {
  // --- Passphrase screen ---
  const passForm = document.getElementById("passphrase-form");
  passForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("passphrase-input");
    const errorEl = document.getElementById("passphrase-error");
    errorEl.textContent = "";
    const passphrase = input.value;
    if (!passphrase) return;

    await setMasterKeyFromPassphrase(passphrase);

    // If a Drive folder was already picked previously (e.g. retry
    // after a failed verification), re-check the new passphrase now.
    const folderId = await metaGet("driveFolderId");
    if (folderId) {
      showScreen("screen-loading");
      try {
        const ok = await verifyPassphraseAgainstFolder(folderId, await getMasterKey());
        if (!ok) {
          await clearMasterKey();
          errorEl.textContent = "That doesn't match your partner's passphrase — try again.";
          showScreen("screen-passphrase");
          return;
        }
      } catch (e) {
        // Offline or other issue — let them through, we'll verify on next sync.
      }
    }
    input.value = "";
    runSetupWizard();
  });

  // --- Identity screen ---
  document.querySelectorAll(".identity-option").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await metaSet("identity", btn.dataset.identity);
      runSetupWizard();
    });
  });

  // --- Connect Drive screen ---
  document.getElementById("connect-drive-button").addEventListener("click", async () => {
    const errorEl = document.getElementById("connect-drive-error");
    errorEl.textContent = "";
    try {
      const folderId = await pickDriveFolder();
      const key = await getMasterKey();
      showScreen("screen-loading");
      const ok = await verifyPassphraseAgainstFolder(folderId, key);
      if (!ok) {
        await clearMasterKey();
        errorEl.textContent = "";
        document.getElementById("passphrase-error").textContent =
          "That doesn't match your partner's passphrase — try again.";
        await metaSet("driveFolderId", folderId); // remember the folder for the retry above
        showScreen("screen-passphrase");
        return;
      }
      await metaSet("driveFolderId", folderId);
      runSetupWizard();
    } catch (e) {
      errorEl.textContent = "Couldn't connect — try again.";
    }
  });
}

function renderIdentityOptions() {
  const container = document.getElementById("identity-options");
  container.innerHTML = "";
  for (const name of CONFIG.IDENTITIES) {
    const btn = document.createElement("button");
    btn.className = "identity-option";
    btn.dataset.identity = name;
    btn.textContent = name;
    container.appendChild(btn);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  renderIdentityOptions();
  wireSetupScreens();
  initCalculator(handleUnlock);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
});
