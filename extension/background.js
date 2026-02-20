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
    let userTitle = null;
    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => prompt("Enter a title for this note:", "My Highlight"),
      });
      userTitle = result[0]?.result;
    } catch (e) {
      return;
    }

    if (!userTitle) return;

    const noteData = {
      url: tab.url,
      content: userTitle,
      selection: info.selectionText, // This is the highlight
    };

    try {
      await fetch(`${API_BASE}/api/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(noteData),
        credentials: "include",
      });
    } catch (e) {
      console.error("Sync failed", e);
    }
  }
});
