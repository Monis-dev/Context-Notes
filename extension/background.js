chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-highlight",
    title: "Save Highlight to ContextNote",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "save-highlight") {
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        return prompt("Enter a title for this note:", "My Highlight");
      },
    });

    const userTitle = result[0].result;

    if (!userTitle) return;

    const noteData = {
      url: tab.url,
      content: userTitle,
      text_selection: info.selectionText,
    };

    fetch("http://127.0.0.1:5000/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(noteData),
    });
  }
});
