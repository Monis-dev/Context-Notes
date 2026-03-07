const API_URL = "http://127.0.0.1:5000"; // Change to your Render URL

const ProMode = {
  // 1. Check Status (Double check with server)
  async isProUser() {
    try {
      const res = await fetch(`${API_URL}/api/me`, { credentials: "include" });
      if (res.ok) {
        const user = await res.json();
        return user.is_pro === true;
      }
    } catch (e) {
      console.error("Auth check failed", e);
    }
    return false;
  },

  // 2. Generic Upgrade Alert
  showUpgradeMessage() {
    // You can replace this with opening the Paywall Modal from dashboard.js
    if (document.getElementById("paywallModal")) {
      document.getElementById("paywallModal").classList.add("on");
    } else {
      alert("🔒 Pro Feature: Please upgrade to use AI tools & Cloud Sync.");
    }
  },

  // 3. AI Chat
  async aiChat(question, domainNotes) {
    if (!(await this.isProUser())) {
      this.showUpgradeMessage();
      return null;
    }

    const res = await fetch(`${API_BASE}/api/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, context: domainNotes }),
      credentials: "include",
    });
    const data = await res.json();
    return data.answer;
  },

  // 4. Summarize Page (or Note)
  async summarizeText(text) {
    if (!(await this.isProUser())) {
      this.showUpgradeMessage();
      return null;
    }

    try {
      const res = await fetch(`${API_URL}/api/ai/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
        credentials: "include",
      });
      return await res.json();
    } catch (e) {
      return { summary: "Error generating summary." };
    }
  },
};
