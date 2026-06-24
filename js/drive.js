// ============================================================
// HUSH — DRIVE FILE OPERATIONS
// Every message is its own file. Every media blob is its own
// file. Nothing is merged into one shared document, so one
// failed upload can never corrupt or lose anything else —
// this is the direct fix for Hearth's old upload-loss problem.
// ============================================================

const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";

async function driveListFiles(folderId, pageToken) {
  const token = await getAccessToken();
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "nextPageToken, files(id, name, createdTime, size)",
    orderBy: "createdTime",
    pageSize: "1000",
  });
  if (pageToken) params.set("pageToken", pageToken);

  const res = await fetch(`${DRIVE_FILES_URL}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
  return res.json();
}

// Lists ALL files in the folder, following pagination.
async function driveListAllFiles(folderId) {
  let files = [];
  let pageToken;
  do {
    const page = await driveListFiles(folderId, pageToken);
    files = files.concat(page.files || []);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return files;
}

function buildMultipartBody(metadata, contentBytes, contentType) {
  const boundary = "hush_boundary_" + Math.random().toString(36).slice(2);
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const metaPart =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata);

  const contentHeader =
    delimiter + `Content-Type: ${contentType}\r\n\r\n`;

  const head = strToBytes(metaPart + contentHeader);
  const tail = strToBytes(closeDelim);

  const body = new Uint8Array(head.length + contentBytes.length + tail.length);
  body.set(head, 0);
  body.set(contentBytes, head.length);
  body.set(tail, head.length + contentBytes.length);

  return { body, boundary };
}

// Uploads raw bytes (already encrypted) as a new file in the folder.
async function driveUploadBytes(folderId, filename, bytes, mimeType) {
  const token = await getAccessToken();
  const metadata = { name: filename, parents: [folderId] };
  const { body, boundary } = buildMultipartBody(metadata, bytes, mimeType);

  const res = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) throw new Error(`Drive upload failed: ${res.status} ${await res.text()}`);
  return res.json(); // { id }
}

async function driveDownloadBytes(fileId) {
  const token = await getAccessToken();
  const res = await fetch(`${DRIVE_FILES_URL}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive download failed: ${res.status}`);
  return res.arrayBuffer();
}
