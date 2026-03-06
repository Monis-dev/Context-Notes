const STORAGE_KEY = "context_notes_data";
const SETTINGS_KEY = "cn_show_highlights";

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyHighlights(notes) {
  removeHighlights();

  let highlightedCount = 0;

  notes.forEach((note) => {
    if (!note.selection) return;

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false,
    );
    let node;
    const nodesToReplace = [];

    while ((node = walker.nextNode())) {
      const parentTag = node.parentElement ? node.parentElement.tagName : "";
      if (
        parentTag === "SCRIPT" ||
        parentTag === "STYLE" ||
        parentTag === "NOSCRIPT"
      )
        continue;

      if (node.nodeValue.includes(note.selection)) {
        nodesToReplace.push(node);
      }
    }

    nodesToReplace.forEach((n) => {
      const regex = new RegExp(`(${escapeRegExp(note.selection)})`, "g");
      const span = document.createElement("span");
      span.innerHTML = n.nodeValue.replace(
        regex,
        `<mark class="cn-highlight" style="background-color: #fde047; color: #92400e; border-bottom: 2px solid #f59e0b; padding: 0 2px; border-radius: 3px; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.1);" title="ContextNote: ${note.title}">$1</mark>`,
      );
      n.replaceWith(...span.childNodes);
      highlightedCount++;
    });
  });

  console.log(
    `[ContextNote] Successfully applied ${highlightedCount} highlights to this page.`,
  );
}

function removeHighlights() {
  document.querySelectorAll(".cn-highlight").forEach((mark) => {
    const parent = mark.parentNode;
    mark.replaceWith(...mark.childNodes);
    parent.normalize();
  });
}

function initHighlights() {
  chrome.storage.local.get([STORAGE_KEY, SETTINGS_KEY], (res) => {
    const isEnabled = res[SETTINGS_KEY] !== false;
    if (!isEnabled) {
      removeHighlights();
      return;
    }

    const allNotes = res[STORAGE_KEY] ? JSON.parse(res[STORAGE_KEY]) : [];
    // Only match notes saved on this exact URL
    const currentUrlNotes = allNotes.filter(
      (n) => n.url === window.location.href,
    );

    if (currentUrlNotes.length > 0) {
      console.log(
        `[ContextNote] Found ${currentUrlNotes.length} notes for this URL. Applying highlights...`,
      );
      applyHighlights(currentUrlNotes);
    } else {
      console.log("[ContextNote] No notes found for this specific URL.");
    }
  });
}

// Run when the webpage finishes loading
initHighlights();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "refresh_highlights") {
    initHighlights();
  } else if (request.action === "remove_highlights") {
    removeHighlights();
  }
});
