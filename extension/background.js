const STORAGE_KEY = "context_notes_data";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-highlight",
    title: "Save Highlight to ContextNote",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "save-highlight") {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [info.selectionText],
      func: (selectionText) => {
        if (document.getElementById("cn-ext-dialog")) return;

        const dialog = document.createElement("dialog");
        dialog.id = "cn-ext-dialog";
        dialog.style.cssText = `
          padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; 
          font-family: system-ui, sans-serif; width: 340px; 
          box-shadow: 0 20px 40px rgba(0,0,0,0.2); backdrop-filter: blur(4px);
          background: #ffffff; color: #1e293b; z-index: 2147483647;
        `;

        dialog.innerHTML = `
          <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #2563eb;">Save Highlight</h3>
          <div style="font-size: 12px; font-style: italic; color: #92400e; background: #fffbeb; padding: 8px; border-left: 3px solid #f59e0b; margin-bottom: 12px; border-radius: 4px; max-height: 80px; overflow-y: auto;">
            "${selectionText}"
          </div>
          <input type="text" id="cn-title" placeholder="Heading..." style="width: 100%; box-sizing: border-box; padding: 10px; margin-bottom: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px;" />
          <textarea id="cn-desc" placeholder="Add a description (optional)..." style="width: 100%; box-sizing: border-box; padding: 10px; height: 80px; margin-bottom: 15px; border: 1px solid #cbd5e1; border-radius: 6px; resize: none; font-size: 13px; font-family: inherit;"></textarea>
          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button id="cn-cancel" style="padding: 8px 14px; border: none; background: #f1f5f9; color: #475569; border-radius: 6px; cursor: pointer; font-weight: 600;">Cancel</button>
            <button id="cn-save" style="padding: 8px 14px; border: none; background: #2563eb; color: white; border-radius: 6px; cursor: pointer; font-weight: 600;">Save Note</button>
          </div>
        `;

        document.body.appendChild(dialog);
        dialog.showModal();

        document.getElementById("cn-cancel").onclick = () => dialog.remove();

        document.getElementById("cn-save").onclick = () => {
          const title =
            document.getElementById("cn-title").value.trim() ||
            "Highlighted Text";
          const desc = document.getElementById("cn-desc").value.trim();

          // Send data back to the background script to save locally
          chrome.runtime.sendMessage({
            action: "save_highlight_data",
            data: {
              id: Date.now().toString(), // Unique Local ID
              url: window.location.href,
              domain: window.location.hostname,
              title: title,
              content: desc,
              selection: selectionText,
            },
          });
          dialog.remove();
        };
      },
    });
  }
});

// Listener: Receives the note and saves it to Chrome Local Storage
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "save_highlight_data") {
    chrome.storage.local.get(STORAGE_KEY, (res) => {
      const notes = res[STORAGE_KEY] ? JSON.parse(res[STORAGE_KEY]) : [];
      notes.push(request.data);
      chrome.storage.local.set({ [STORAGE_KEY]: JSON.stringify(notes) });
    });
  }
});
