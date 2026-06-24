// ============================================================
// HUSH — GOOGLE AUTH + FOLDER PICKER
// Uses the narrow drive.file scope: the app can only touch files
// it created itself, or a folder you explicitly pick below. It
// never has blanket access to your whole Drive.
// ============================================================

let _tokenClient = null;
let _accessToken = null;
let _accessTokenExpiry = 0;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function ensureGoogleScriptsLoaded() {
  if (!window.google || !window.google.accounts) {
    await loadScript("https://accounts.google.com/gsi/client");
  }
  if (!window.gapi) {
    await loadScript("https://apis.google.com/js/api.js");
    await new Promise((resolve) => gapi.load("picker", resolve));
  }
}

function initTokenClient() {
  if (_tokenClient) return;
  _tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    scope: CONFIG.GOOGLE_SCOPE,
    callback: () => {}, // overridden per-call below
  });
}

// Tries a silent (no popup) token refresh first; falls back to
// an interactive popup only if silent refresh fails. Returns an
// access token string.
function requestAccessToken({ interactive }) {
  return new Promise((resolve, reject) => {
    initTokenClient();
    _tokenClient.callback = (resp) => {
      if (resp.error) {
        reject(resp);
        return;
      }
      _accessToken = resp.access_token;
      _accessTokenExpiry = Date.now() + (resp.expires_in - 60) * 1000;
      resolve(_accessToken);
    };
    _tokenClient.requestAccessToken({ prompt: interactive ? "consent" : "" });
  });
}

async function getAccessToken() {
  await ensureGoogleScriptsLoaded();
  if (_accessToken && Date.now() < _accessTokenExpiry) return _accessToken;
  try {
    return await requestAccessToken({ interactive: false });
  } catch (e) {
    return await requestAccessToken({ interactive: true });
  }
}

// Opens the Google Picker UI scoped to folders, so the person can
// select the shared folder you both already created in Drive.
// Returns the folder's Drive file ID.
async function pickDriveFolder() {
  await ensureGoogleScriptsLoaded();
  const token = await requestAccessToken({ interactive: true });

  return new Promise((resolve, reject) => {
    const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
      .setSelectFolderEnabled(true)
      .setIncludeFolders(true);

    const picker = new google.picker.PickerBuilder()
      .setOAuthToken(token)
      .setDeveloperKey(CONFIG.GOOGLE_API_KEY)
      .addView(view)
      .setTitle("Pick the shared Hush folder")
      .setCallback((data) => {
        if (data.action === google.picker.Action.PICKED) {
          resolve(data.docs[0].id);
        } else if (data.action === google.picker.Action.CANCEL) {
          reject(new Error("cancelled"));
        }
      })
      .build();
    picker.setVisible(true);
  });
}
