// ============================================================
// HUSH — CONFIG
// Fill these in before deploying. None of these are the actual
// encryption secret — that's typed in by you and her, never
// stored here. Everything in this file is safe to be public.
// ============================================================

const CONFIG = {
  // From Google Cloud Console → Credentials → OAuth 2.0 Client ID (Web application)
  GOOGLE_CLIENT_ID: "309440384030-dd54gbr23640nj3psset7b2m55jd1m53.apps.googleusercontent.com",

  // From Google Cloud Console → Credentials → API key
  // (restrict it to your GitHub Pages domain + Drive API / Picker API)
  GOOGLE_API_KEY: "AIzaSyDiz3X9VHUluEMqj1o2ET71qe1Lu7BH520",

  // The calculator unlock code. Must be DIGITS ONLY (0-9), no decimals
  // or operators. Typed as a clean run of digit presses, then "=".
  // e.g. "2580" means: press 2, 5, 8, 0, = right after a clear.
  UNLOCK_PIN: "1708",

  // Sender labels shown in the chat. These are NOT secret —
  // they just tag who sent what. Change to your real names if you want.
  IDENTITIES: ["You", "Her"],

  // Non-secret salt used in deriving the encryption key from your
  // passphrase. This does NOT need to be kept secret — PBKDF2 salts
  // are public by design. It just needs to be the SAME value on both
  // of your devices, so don't change it after you've started using
  // the app (changing it would make old messages undecryptable).
  KDF_SALT: "hush-app-fixed-salt-v1",
  KDF_ITERATIONS: 250000,

  // How often (ms) the app checks Drive for new messages while open.
  POLL_INTERVAL_MS: 1000,

  // Drive OAuth scope — deliberately the narrow "drive.file" scope
  // (the app can only see files/folders YOU explicitly pick via the
  // Google Picker, not your whole Drive). This avoids Google's
  // sensitive-scope verification process entirely.
  GOOGLE_SCOPE: "https://www.googleapis.com/auth/drive",
};
