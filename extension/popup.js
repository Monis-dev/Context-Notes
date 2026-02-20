const STORAGE_KEY = "context_notes_data";
const API_BASE = "http://127.0.0.1:5000"; // Change this to your Render URL after deployment

// 1. GLOBAL UI HANDLERS

// Open the Dashboard (No injection needed - Dashboard pulls from Postgres)
document.getElementById("openDashboard").addEventListener("click", () => {
  chrome.tabs.create({ url: `${API_BASE}/dashboard` });
});

// Save Note (Local + Server Sync)
document.getElementById("saveBtn").addEventListener("click", async () => {
  const noteInput = document.getElementById("noteInput");
  const content = noteInput.value.trim();
  if (!content) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const noteData = {
    id: Date.now(), // Temporary ID for local
    url: tab.url,
    domain: new URL(tab.url).hostname,
    content: content,
    selection: "", // Manual note has no highlight
  };

  // 1. Save Locally for instant feedback
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const notes = result[STORAGE_KEY] ? JSON.parse(result[STORAGE_KEY]) : [];
  notes.push(noteData);
  await chrome.storage.local.set({ [STORAGE_KEY]: JSON.stringify(notes) });

  // 2. Sync to PostgreSQL Server
  try {
    const res = await fetch(`${API_BASE}/api/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(noteData),
      credentials: "include", // Sends your login session cookie
    });

    if (res.status === 401) {
      console.log("Not logged in. Note saved locally only.");
    }
  } catch (e) {
    console.error("Sync failed, saved locally.");
  }

  noteInput.value = "";
  location.reload();
});

// 2. INITIAL LOAD & RENDER
window.onload = async () => {
  const notesList = document.getElementById("notesList");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    // 1. Load Local Notes first (Instant)
    const result = await chrome.storage.local.get(STORAGE_KEY);
    let allNotes = result[STORAGE_KEY] ? JSON.parse(result[STORAGE_KEY]) : [];

    // 2. Filter for current page
    const pageNotes = allNotes.filter((n) => n.url === tab.url);

    if (pageNotes.length === 0) {
      notesList.innerHTML =
        '<p style="font-size: 12px; color: #64748b; text-align: center; margin-top: 20px;">No notes for this page.</p>';
    } else {
      notesList.innerHTML = "";
      pageNotes.reverse().forEach((n) => {
        const card = document.createElement("div");
        card.className = "note-card";
        card.innerHTML = `
          <button class="btn-edit" data-id="${n.id}">✎</button>
          <button class="btn-delete" data-id="${n.id}">&times;</button>
          ${n.selection ? `<div class="context">"${n.selection}"</div>` : ""}
          <div class="content">${n.content}</div>
        `;
        notesList.appendChild(card);
      });
    }

    // 3. ATTACH LISTENERS

    // Delete Logic
    document.querySelectorAll(".btn-delete").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.getAttribute("data-id");
        if (!confirm("Delete this note?")) return;

        // Delete Local
        allNotes = allNotes.filter((n) => n.id != id);
        await chrome.storage.local.set({
          [STORAGE_KEY]: JSON.stringify(allNotes),
        });

        // Delete Server
        try {
          await fetch(`${API_BASE}/api/notes/${id}`, {
            method: "DELETE",
            credentials: "include",
          });
        } catch (e) {}

        location.reload();
      });
    });

    // Edit Logic
    document.querySelectorAll(".btn-edit").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.getAttribute("data-id");
        const card = e.target.parentElement;
        const currentContent = card.querySelector(".content").innerText;
        const newContent = prompt("Edit your note:", currentContent);

        if (newContent && newContent !== currentContent) {
          // Update Local
          const idx = allNotes.findIndex((n) => n.id == id);
          if (idx !== -1) {
            allNotes[idx].content = newContent;
            await chrome.storage.local.set({
              [STORAGE_KEY]: JSON.stringify(allNotes),
            });
          }

          // Update Server (Note: Add a PUT route to app.py if you want server edits)
          // For now, it updates local and you can re-sync later
          location.reload();
        }
      });
    });
  } catch (err) {
    console.error("Error:", err);
  }
};
