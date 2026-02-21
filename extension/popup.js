const STORAGE_KEY = "context_notes_data";
const API_BASE = "http://127.0.0.1:5000"; // Change to Render URL when deployed

// 1. Open Dashboard
document.getElementById("openDashboard").addEventListener("click", () => {
  chrome.tabs.create({ url: `${API_BASE}/dashboard` });
});

// 2. Save a New Note
document.getElementById("saveBtn").addEventListener("click", async () => {
  const noteTitleInput = document.getElementById("noteTitle");
  const noteInput = document.getElementById("noteInput");

  const title = noteTitleInput.value.trim() || "Untitled";
  const content = noteInput.value.trim();

  if (!content && title === "Untitled") return; // Don't save empty notes

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const noteData = {
    url: tab.url,
    title: title, // Added Title
    content: content, // Added Content
    selection: "",
  };

  try {
    const res = await fetch(`${API_BASE}/api/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(noteData),
      credentials: "include",
    });

    if (res.ok) {
      noteTitleInput.value = "";
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

// 3. INITIAL LOAD & SYNC DOWN
window.onload = async () => {
  const notesList = document.getElementById("notesList");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  let allNotes = [];

  try {
    const res = await fetch(`${API_BASE}/api/notes`, {
      credentials: "include",
    });
    if (res.ok) {
      const serverData = await res.json();
      serverData.forEach((site) => {
        site.notes.forEach((note) => {
          allNotes.push({
            id: note.id,
            url: site.url,
            domain: site.domain,
            title: note.title || "Untitled", // Support new title field
            content: note.content || "",
            selection: note.selection || "",
          });
        });
      });
      await chrome.storage.local.set({
        [STORAGE_KEY]: JSON.stringify(allNotes),
      });
    }
  } catch (err) {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    allNotes = result[STORAGE_KEY] ? JSON.parse(result[STORAGE_KEY]) : [];
  }

  // Render for current URL
  const pageNotes = allNotes.filter((n) => n.url === tab.url);

  if (pageNotes.length === 0) {
    notesList.innerHTML =
      '<div class="empty-state">No notes for this page.</div>';
  } else {
    notesList.innerHTML = "";
    pageNotes.reverse().forEach((n) => {
      const card = document.createElement("div");
      card.className = "note-card";
      card.innerHTML = `
        <button class="btn-edit" data-id="${n.id}" data-title="${n.title.replace(/"/g, "&quot;")}" data-content="${n.content.replace(/"/g, "&quot;")}">✎</button>
        <button class="btn-delete" data-id="${n.id}">&times;</button>
        <div class="note-title">${n.title}</div>
        ${n.selection ? `<div class="context">"${n.selection}"</div>` : ""}
        ${n.content ? `<div class="content">${n.content}</div>` : ""}
      `;
      notesList.appendChild(card);
    });
  }

  // Delete Logic
  document.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.getAttribute("data-id");
      if (!confirm("Delete this note?")) return;

      try {
        const res = await fetch(`${API_BASE}/api/notes/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (res.ok) window.location.reload();
      } catch (e) {
        console.error("Failed to delete", e);
      }
    });
  });

  // Edit Logic
  document.querySelectorAll(".btn-edit").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.getAttribute("data-id");
      const currentTitle = e.target.getAttribute("data-title");
      const currentContent = e.target.getAttribute("data-content");

      // Prompt for both title and content
      const newTitle = prompt("Edit Heading:", currentTitle);
      if (newTitle === null) return; // Cancelled

      const newContent = prompt("Edit Description:", currentContent);
      if (newContent === null) return; // Cancelled

      if (newTitle !== currentTitle || newContent !== currentContent) {
        try {
          const res = await fetch(`${API_BASE}/api/notes/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: newTitle, content: newContent }),
            credentials: "include",
          });

          if (res.ok) window.location.reload();
        } catch (err) {
          console.error("Failed to update on server", err);
        }
      }
    });
  });
};
