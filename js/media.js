// ============================================================
// HUSH — MEDIA CAPTURE
// Photos & video use the device's native camera (file input).
// Voice notes are recorded in-browser with MediaRecorder.
// ============================================================

function pickFile(accept, capture) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    if (capture) input.capture = capture;
    input.onchange = () => resolve(input.files[0] || null);
    input.click();
  });
}

async function capturePhoto() {
  return pickFile("image/*", "environment");
}

async function captureVideo() {
  return pickFile("video/*", "environment");
}

// Simple tap-to-start / tap-to-stop voice recorder.
class VoiceRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.chunks = [];
    this.stream = null;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream);
    this.mediaRecorder.ondataavailable = (e) => this.chunks.push(e.data);
    this.mediaRecorder.start();
  }

  stop() {
    return new Promise((resolve) => {
      this.mediaRecorder.onstop = () => {
        this.stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(this.chunks, { type: "audio/webm" });
        resolve(blob);
      };
      this.mediaRecorder.stop();
    });
  }
}
