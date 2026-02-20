const STORAGE_KEY = "context_notes_data";
const API_BASE = "http://127.0.0.1:5000"; // Change this to your Render URL after deployment

// 1. Open the Dashboard
document.getElementById("openDashboard").addEventListener("click", () => {
  chrome.tabs.create({ url: `${API_BASE}/dashboard` });
});

// 2. Save a New Note
document.getElementById("saveBtn").addEventListener("click", async () => {
  const noteInput = document.getElementById("noteInput");
  const content = noteInput.value.trim();
  if (!content) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const noteData = {
    url: tab.url,
    content: content,
    selection: "",
  };

  try {
    // Push to server first to get the REAL Database ID
    const res = await fetch(`${API_BASE}/api/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(noteData),
      credentials: "include", // Sends your login session
    });

    if (res.ok) {
      // Successfully saved to server, reload to fetch fresh data
      noteInput.value = "";
      window.location.reload();
    } else {
      alert("Please log in via the Dashboard first.");
    }
  } catch (e) {
    console.error("Failed to connect to server.", e);
    alert("Server is offline.");
  }
});

// 3. INITIAL LOAD & SYNC DOWN (The Fix!)
window.onload = async () => {
  const notesList = document.getElementById("notesList");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  let allNotes = [];

  // --- SYNC DOWN FROM SERVER ---
  // This ensures highlights, dashboard edits, and deletions are visible here!
  try {
    const res = await fetch(`${API_BASE}/api/notes`, {
      credentials: "include",
    });
    if (res.ok) {
      const serverData = await res.json();

      // Flatten the server data (which is grouped by website) into a single list
      serverData.forEach((site) => {
        site.notes.forEach((note) => {
          allNotes.push({
            id: note.id,
            url: site.url,
            domain: site.domain,
            content: note.content,
            selection: note.selection,
          });
        });
      });

      // Update local storage so it matches the server (Source of Truth)
      await chrome.storage.local.set({
        [STORAGE_KEY]: JSON.stringify(allNotes),
      });
    }
  } catch (err) {
    console.log("Server offline, loading cached local notes...");
    const result = await chrome.storage.local.get(STORAGE_KEY);
    allNotes = result[STORAGE_KEY] ? JSON.parse(result[STORAGE_KEY]) : [];
  }

  // --- RENDER NOTES FOR CURRENT URL ---
  const pageNotes = allNotes.filter((n) => n.url === tab.url);

  if (pageNotes.length === 0) {
    notesList.innerHTML =
      '<p style="font-size: 13px; color: #64748b; text-align: center; margin-top: 20px;">No notes for this page.</p>';
  } else {
    notesList.innerHTML = "";
    // Reverse to show newest first
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

  // --- ATTACH LISTENERS FOR RENDERED CARDS ---

  // Delete Logic
  document.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.getAttribute("data-id");
      if (!confirm("Delete this note?")) return;

      try {
        // Delete from Server
        const res = await fetch(`${API_BASE}/api/notes/${id}`, {
          method: "DELETE",
          credentials: "include",
        });

        if (res.ok) {
          window.location.reload(); // Reload to fetch fresh list
        }
      } catch (e) {
        console.error("Failed to delete from server", e);
      }
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
        try {
          // Update Server
          const res = await fetch(`${API_BASE}/api/notes/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: newContent }),
            credentials: "include",
          });

          if (res.ok) {
            window.location.reload(); // Reload to fetch fresh list
          }
        } catch (e) {
          console.error("Failed to update on server", e);
        }
      }
    });
  });
};
