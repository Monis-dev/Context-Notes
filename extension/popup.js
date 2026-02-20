window.onload = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    const response = await fetch(
      `http://127.0.0.1:5000/notes?url=${encodeURIComponent(tab.url)}`,
    );
    const notes = await response.json();

    const notesList = document.getElementById("notesList");

    if (notes.length === 0) {
      notesList.innerHTML =
        '<p style="font-size: 12px; color: #64748b;">No notes yet.</p>';
    } else {
      notesList.innerHTML = "";
    }

    notes.reverse().forEach((n) => {
      const card = document.createElement("div");
      card.className = "note-card"; 

      card.innerHTML = `
        ${n.selection ? `<div class="context">"${n.selection}"</div>` : ""}
        <div class="content">${n.content}</div>
        <button class="btn-edit" data-id="${n.id}">✎</button>
        <button class="btn-delete" data-id="${n.id}">&times;</button>
      `;
      notesList.appendChild(card);
    });

    document.getElementById("openDashboard").addEventListener("click", () => {
      chrome.tabs.create({
        url: "http://127.0.0.1:5000/dashboard",
      });
    });

    document.getElementById("saveBtn").addEventListener("click", async () => {
      const noteInput = document.getElementById("noteInput");
      const content = noteInput.value.trim();

      if (!content) {
        alert("Please enter a note!");
        return;
      }

      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });

        const response = await fetch("http://127.0.0.1:5000/notes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: tab.url,
            content: content,
            text_selection: "", 
          }),
        });

        if (response.ok) {
          noteInput.value = ""; 
          location.reload(); 
        } else {
          console.error("Server error:", await response.text());
        }
      } catch (error) {
        console.error("Failed to save:", error);
        alert("Could not connect to backend. Is Flask running?");
      }
    });

    document.querySelectorAll(".btn-delete").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const noteId = e.currentTarget.getAttribute("data-id");

        if (!noteId || noteId === "undefined") {
          console.error("No ID found for this note");
          return;
        }

        try {
          await fetch(`http://127.0.0.1:5000/notes/${noteId}`, {
            method: "DELETE",
          });
          location.reload();
        } catch (err) {
          console.error("Delete failed:", err);
        }
      });
    });
    document.querySelectorAll(".btn-edit").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const noteId = e.target.getAttribute("data-id");

        const currentContent =
          e.target.parentElement.querySelector(".content").innerText;

        const newContent = prompt("Edit your note:", currentContent);

        if (newContent !== null && newContent !== currentContent) {
          try {
            await fetch(`http://127.0.0.1:5000/notes/${noteId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: newContent }),
            });
            location.reload(); 
          } catch (err) {
            console.error("Update failed:", err);
          }
        }
      });
    });
  } catch (err) {
    console.error("Fetch failed:", err);
    document.getElementById("notesList").innerHTML =
      '<p style="color:red">Backend Offline</p>';
  }
};
