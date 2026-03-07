// ai_service.js

const AIService = {
  async chat(question, contextNotes) {
    try {
      const res = await fetch(`${API_BASE}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, context: contextNotes }),
        credentials: "include",
      });
      const data = await res.json();
      return data.answer || "No response";
    } catch (e) {
      return "AI Service offline.";
    }
  },

  async summarize(content) {
    try {
      const res = await fetch(`${API_BASE}/api/ai/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
        credentials: "include",
      });
      const data = await res.json();
      return data.summary || "Summary failed.";
    } catch (e) {
      return "AI Service offline.";
    }
  },
};
