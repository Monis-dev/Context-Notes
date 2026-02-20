const API_BASE = "http://127.0.0.1:5000";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-highlight",
    title: "Save Highlight to ContextNote",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "save-highlight") {
    // 1. Ask for a note/title
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () =>
        prompt("Add a note to this highlight:", "Important highlight"),
    });

    const userNote = result[0]?.result;
    if (userNote === null) return; // User cancelled

    const noteData = {
      url: tab.url,
      content: userNote || "Highlighted text",
      selection: info.selectionText,
    };

    // 2. Push to server immediately
    try {
      const res = await fetch(`${API_BASE}/api/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(noteData),
        credentials: "include",
      });

      if (res.ok) {
        console.log("Highlight synced to cloud");
      } else {
        console.error("Not logged in. Highlight not saved to cloud.");
      }
    } catch (e) {
      console.error("Connection error during highlight sync");
    }
  }
});
