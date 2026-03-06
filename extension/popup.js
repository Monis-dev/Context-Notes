const STORAGE_KEY = "context_notes_data";
const SETTINGS_KEY = "cn_show_highlights"; // <-- THIS WAS MISSING!

const toggleEl = document.getElementById("highlightToggle");

// Load the current setting (default is true)
if (toggleEl) {
  chrome.storage.local.get(SETTINGS_KEY, (res) => {
    toggleEl.checked = res[SETTINGS_KEY] !== false;
  });

  // When user clicks the toggle
  toggleEl.addEventListener("change", async () => {
    const isEnabled = toggleEl.checked;
    await chrome.storage.local.set({ [SETTINGS_KEY]: isEnabled });

    // Tell the active tab to immediately show/hide highlights
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, {
        action: isEnabled ? "refresh_highlights" : "remove_highlights",
      });
    }
  });
}

// 1. Pop Out Button
document.getElementById("popOutBtn").addEventListener("click", () => {
  chrome.windows.create(
    {
      url: chrome.runtime.getURL("popup.html"),
      type: "popup",
      width: 360,
      height: 650,
    },
    () => {
      window.close(); // Wait until window is created to close original menu
    },
  );
});

// 2. Open Dashboard
document.getElementById("openDashboard").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

// 3. Save Note Locally
document.getElementById("saveBtn").addEventListener("click", async () => {
  const noteTitleInput = document.getElementById("noteTitle");
  const noteInput = document.getElementById("noteInput");
  const title = noteTitleInput.value.trim() || "Untitled";
  const content = noteInput.value.trim();
  if (!content && title === "Untitled") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const noteData = {
    id: Date.now().toString(),
    url: tab.url,
    domain: new URL(tab.url).hostname,
    title: title,
    content: content,
    selection: "",
    pinned: false,
  };

  const result = await chrome.storage.local.get(STORAGE_KEY);
  const notes = result[STORAGE_KEY] ? JSON.parse(result[STORAGE_KEY]) : [];
  notes.push(noteData);
  await chrome.storage.local.set({ [STORAGE_KEY]: JSON.stringify(notes) });

  noteTitleInput.value = "";
  noteInput.value = "";
  window.location.reload();
});

// 4. Initial Load
window.onload = async () => {
  const notesList = document.getElementById("notesList");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const result = await chrome.storage.local.get(STORAGE_KEY);
  let allNotes = result[STORAGE_KEY] ? JSON.parse(result[STORAGE_KEY]) : [];

  const pageNotes = allNotes.filter((n) => n.url === tab.url);

  if (pageNotes.length === 0) {
    notesList.innerHTML =
      '<div class="empty-state">No notes for this page.</div>';
  } else {
    notesList.innerHTML = "";
    // Put Pinned notes at the top!
    pageNotes
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
      .forEach((n) => {
        const card = document.createElement("div");
        card.className = "note-card";
        card.innerHTML = `
        <button class="btn-edit" data-id="${n.id}" data-title="${n.title.replace(/"/g, "&quot;")}" data-content="${n.content.replace(/"/g, "&quot;")}">✎</button>
        <button class="btn-delete" data-id="${n.id}">&times;</button>
        <div class="note-title">${n.pinned ? "⭐ " : ""}${n.title}</div>
        ${n.selection ? `<div class="context">"${n.selection}"</div>` : ""}
        ${n.content ? `<div class="content">${n.content}</div>` : ""}
      `;
        notesList.appendChild(card);
      });
  }

  document.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.getAttribute("data-id");
      if (!confirm("Delete this note?")) return;
      allNotes = allNotes.filter((n) => n.id !== id);
      await chrome.storage.local.set({
        [STORAGE_KEY]: JSON.stringify(allNotes),
      });
      window.location.reload();
    });
  });

  document.querySelectorAll(".btn-edit").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.getAttribute("data-id");
      const newTitle = prompt(
        "Edit Heading:",
        e.target.getAttribute("data-title"),
      );
      if (newTitle === null) return;
      const newContent = prompt(
        "Edit Description:",
        e.target.getAttribute("data-content"),
      );
      if (newContent === null) return;

      const idx = allNotes.findIndex((n) => n.id === id);
      if (idx > -1) {
        allNotes[idx].title = newTitle;
        allNotes[idx].content = newContent;
        await chrome.storage.local.set({
          [STORAGE_KEY]: JSON.stringify(allNotes),
        });
        window.location.reload();
      }
    });
  });
};
