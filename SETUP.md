# Hush — Setup Guide

Everything below is one-time setup. After this, both of you just open the calculator icon and type the PIN.

---

## 1. Create a fresh Google Cloud project

1. Go to https://console.cloud.google.com/projectcreate and create a new project (e.g. "Hush App").
2. With that project selected, go to **APIs & Services → Library**, search **Google Drive API**, click **Enable**.
3. Go to **APIs & Services → OAuth consent screen**.
   - User type: **External**.
   - Fill in app name (anything, e.g. "Calculator"), your email for support/dev contact.
   - Scopes: you don't need to add any here — the app requests `drive.file` at runtime.
   - **Test users**: add **both** of your Google account emails. This is important — since the app won't go through Google's verification process, only accounts listed here can sign in.
4. Go to **APIs & Services → Credentials**.
   - Click **Create Credentials → OAuth client ID**.
   - Application type: **Web application**.
   - Authorized JavaScript origins: add your future GitHub Pages URL, e.g. `https://yourusername.github.io` (no trailing slash, no path).
   - Click **Create**. Copy the **Client ID** — paste it into `js/config.js` as `GOOGLE_CLIENT_ID`.
   - Click **Create Credentials → API key**.
   - Click into the new key → restrict it: under "API restrictions" choose **Restrict key**, select **Google Drive API**. Under "Website restrictions" add your GitHub Pages domain.
   - Copy the key into `js/config.js` as `GOOGLE_API_KEY`.

## 2. Create the shared Drive folder

1. In your own Google Drive, create a new folder (e.g. "Hush Data").
2. Right-click it → **Share** → add her Google account with **Editor** access.
3. That's it — don't open it with the app yet, you'll pick it via the in-app folder picker during first-run setup below.

## 3. Set your secrets in `js/config.js`

Open `js/config.js` and fill in:
- `GOOGLE_CLIENT_ID` — from step 1
- `GOOGLE_API_KEY` — from step 1
- `UNLOCK_PIN` — digits only, e.g. `"2580"`. This is what you type on the calculator then press `=`.
- `IDENTITIES` — leave as `["You", "Her"]` or change to your real names.

Do **not** put your real encryption passphrase anywhere in this file — that's typed in, by design.

## 4. Deploy to GitHub Pages

1. Create a new **public** GitHub repository (free plan requires public for Pages).
2. Push this whole `hush` folder's contents to the repo root.
3. In the repo, go to **Settings → Pages**, set source to your main branch, root folder.
4. Wait a minute or two, then visit the URL GitHub gives you (e.g. `https://yourusername.github.io/your-repo-name/`).

> Reminder: the deployed site is public to anyone with the link, same as Hearth. That's fine here — there's no real secret sitting in the code anymore (the passphrase isn't stored in it), so finding the link alone doesn't get anyone into your messages.

## 5. First run — your device

1. Open the deployed link. You'll see a normal-looking calculator.
2. Type your PIN (e.g. `2580`) then press `=`.
3. **Enter passphrase** screen appears — type a passphrase only you and her will know. (Pick something neither of you will forget — there's no "forgot password" option by design, since nothing is recoverable from a server.)
4. **Who's this?** — tap "You" (or whatever you renamed it to).
5. **Connect Google Drive** — sign in with your Google account, then in the folder picker, select the **Hush Data** folder you created in step 2.
6. You're in. Send a test message.

## 6. First run — her device

Same steps, except:
- Same PIN, same passphrase (this is what links your two devices to the same encrypted conversation).
- Pick **"Her"** on the identity screen.
- Sign in with **her own** Google account, and pick the **same shared folder** (it'll show up since you already shared it with her in step 2).

## 7. Day-to-day use

- Opening the calculator icon again, typing the PIN and `=` will now show a **"Let's gooo 🚀"** button instead of the setup wizard — tap it, you're in chat.
- Works offline for reading old messages and composing new ones — anything sent offline queues and goes out automatically once you're back online.
- If an upload ever fails, the message shows "Failed to send — tap to retry" right in the chat, instead of silently disappearing.

## If you ever need to start over on a device

Clear the site's data from your browser settings (or uninstall/reinstall the PWA) — this wipes the locally cached key/identity/folder choice and local message cache on that device only. Your messages already in Drive aren't affected.
