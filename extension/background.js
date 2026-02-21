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
    // Prompt the user for a Heading/Title
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () =>
        prompt(
          "Add a heading/title for this highlight:",
          "Important Highlight",
        ),
    });

    const userTitle = result[0]?.result;
    if (userTitle === null) return; // User cancelled

    const noteData = {
      url: tab.url,
      title: userTitle || "Highlighted text", // Maps to Title
      content: "", // Empty description by default
      selection: info.selectionText, // The actual highlight
    };

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
        console.error("Not logged in. Highlight not saved.");
      }
    } catch (e) {
      console.error("Connection error during highlight sync");
    }
  }
});
