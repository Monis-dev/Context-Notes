const STORAGE_KEY = "context_notes_data";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-highlight",
    title: "Save Highlight to ContextNote",
    contexts: ["selection", "page", "video"], // Added 'page' and 'video' so you can right-click anywhere
  });
});

// --- HELPER: Extract Video Time ---
function getPageMediaData() {
  const video = document.querySelector("video");
  if (video && !Number.isNaN(video.duration)) {
    const totalSeconds = Math.floor(video.currentTime);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const timeStr =
      h > 0
        ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
        : `${m}:${s.toString().padStart(2, "0")}`;
    return { timestamp: timeStr, hasVideo: true };
  }
  return { timestamp: null, hasVideo: false };
}

// --- MAIN LOGIC ---
async function executeContextNoteFlow(tab, explicitSelection = null) {
  // 1. Get Video Data
  let mediaData = { timestamp: null };
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: getPageMediaData,
    });
    if (results && results[0]) mediaData = results[0].result;
  } catch (e) {}

  // 2. Inject Dialog
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    args: [explicitSelection, mediaData.timestamp],
    func: (passedSelection, timestamp) => {
      // Logic: If text is selected, use it.
      // If NOT, but we have a timestamp, use "Video Timestamp" as placeholder.
      let selectionText =
        passedSelection || window.getSelection().toString().trim();

      if (!selectionText && timestamp) {
        selectionText = `Saved at timestamp ${timestamp}`;
      } else if (!selectionText) {
        // Fallback: If no text and no video, maybe they just want a page note?
        selectionText = document.title;
      }

      if (document.getElementById("cn-ext-dialog")) return;

      const dialog = document.createElement("dialog");
      dialog.id = "cn-ext-dialog";
      dialog.style.cssText = `
        padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; 
        font-family: system-ui, sans-serif; width: 340px; 
        box-shadow: 0 20px 40px rgba(0,0,0,0.25); backdrop-filter: blur(4px);
        background: #ffffff; color: #1e293b; z-index: 2147483647;
        position: fixed; top: 20px; right: 20px; margin: 0;
      `;

      let metaHtml = "";
      if (timestamp) {
        metaHtml += `<span style="background:#eef2ff; color:#4f46e5; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold; display:inline-flex; align-items:center; gap:4px; border:1px solid #c7d2fe;">⏱️ ${timestamp}</span>`;
      }

      const content = `
        <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #2563eb; display:flex; justify-content:space-between; align-items:center;">
          <span>New Note</span>
          ${metaHtml}
        </h3>
        
        <div style="font-size: 12px; font-style: italic; color: #92400e; background: #fffbeb; padding: 10px; border-left: 3px solid #f59e0b; margin-bottom: 12px; border-radius: 4px; max-height: 80px; overflow-y: auto; line-height:1.4;">
          "${selectionText}"
        </div>
        
        <input type="text" id="cn-title" placeholder="Note Heading..." style="width: 100%; box-sizing: border-box; padding: 10px; margin-bottom: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; outline:none;" />
        <textarea id="cn-desc" placeholder="Add a description..." style="width: 100%; box-sizing: border-box; padding: 10px; height: 70px; margin-bottom: 12px; border: 1px solid #cbd5e1; border-radius: 6px; resize: none; font-size: 13px; font-family: inherit; outline:none;"></textarea>
        
        <div id="cn-img-preview" style="display:none; margin-bottom:12px; position:relative;">
          <img id="cn-img-tag" style="width:100%; height:auto; border-radius:6px; border:1px solid #cbd5e1; max-height:150px; object-fit:cover;">
          <button id="cn-remove-img" style="position:absolute; top:5px; right:5px; background:rgba(0,0,0,0.6); color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:10px;">✕</button>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
          <button id="cn-snap" style="background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; padding:8px 10px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:4px;">
            📸 <span id="cn-snap-text">Screenshot</span>
          </button>
          <div style="display:flex; gap:8px;">
            <button id="cn-cancel" style="padding: 8px 12px; border: none; background: #f1f5f9; color: #475569; border-radius: 6px; cursor: pointer; font-weight: 600; font-size:12px;">Cancel</button>
            <button id="cn-save" style="padding: 8px 14px; border: none; background: #2563eb; color: white; border-radius: 6px; cursor: pointer; font-weight: 600; font-size:12px;">Save</button>
          </div>
        </div>
      `;

      dialog.innerHTML = content;
      document.body.appendChild(dialog);
      dialog.showModal();

      let currentImage = null;

      document.getElementById("cn-cancel").onclick = () => dialog.remove();

      document.getElementById("cn-snap").onclick = () => {
        const snapBtn = document.getElementById("cn-snap");
        const prevText = document.getElementById("cn-snap-text").innerText;
        snapBtn.disabled = true;
        document.getElementById("cn-snap-text").innerText = "...";
        dialog.style.opacity = "0";

        setTimeout(() => {
          chrome.runtime.sendMessage(
            { action: "capture_screenshot" },
            (response) => {
              dialog.style.opacity = "1";
              snapBtn.disabled = false;
              document.getElementById("cn-snap-text").innerText = prevText;

              if (response && response.data) {
                currentImage = response.data;
                document.getElementById("cn-img-tag").src = currentImage;
                document.getElementById("cn-img-preview").style.display =
                  "block";
                document.getElementById("cn-snap").style.display = "none";
              }
            },
          );
        }, 200);
      };

      document.getElementById("cn-remove-img").onclick = () => {
        currentImage = null;
        document.getElementById("cn-img-preview").style.display = "none";
        document.getElementById("cn-snap").style.display = "flex";
      };

      document.getElementById("cn-save").onclick = () => {
        const title =
          document.getElementById("cn-title").value.trim() || "Note";
        const desc = document.getElementById("cn-desc").value.trim();

        chrome.runtime.sendMessage({
          action: "save_highlight_data",
          data: {
            id: Date.now().toString(),
            url: window.location.href,
            domain: window.location.hostname,
            title: title,
            content: desc,
            selection: selectionText,
            timestamp: timestamp || null,
            image_data: currentImage || null,
            pinned: false,
          },
        });
        dialog.remove();
      };
    },
  });
}

// Trigger via Right-Click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-highlight") {
    executeContextNoteFlow(tab, info.selectionText);
  }
});

// Trigger via Keyboard Shortcut
chrome.commands.onCommand.addListener((command) => {
  if (command === "save-highlight-shortcut") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) executeContextNoteFlow(tabs[0], null);
    });
  }
});

// Message Hub
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "save_highlight_data") {
    chrome.storage.local.get(STORAGE_KEY, (res) => {
      const notes = res[STORAGE_KEY] ? JSON.parse(res[STORAGE_KEY]) : [];
      notes.push(request.data);
      chrome.storage.local.set({ [STORAGE_KEY]: JSON.stringify(notes) }, () => {
        if (sender.tab)
          chrome.tabs.sendMessage(sender.tab.id, {
            action: "refresh_highlights",
          });
      });
    });
  }
  if (request.action === "capture_screenshot") {
    chrome.tabs.captureVisibleTab(
      null,
      { format: "jpeg", quality: 60 },
      (dataUrl) => {
        sendResponse({ data: dataUrl });
      },
    );
    return true;
  }
});
