/**
 * WealthPulse AI — Local Storage & State Management
 */

const WealthStorage = {
  KEYS: {
    PORTFOLIO: "wealthpulse_active_portfolio",
    API_KEY: "wealthpulse_gemini_key",
    CHAT_HISTORY: "wealthpulse_chat_history",
    CONTACT_INFO: "wealthpulse_contact_info"
  },

  getPortfolio() {
    try {
      const data = localStorage.getItem(this.KEYS.PORTFOLIO);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  savePortfolio(portfolio) {
    try {
      localStorage.setItem(this.KEYS.PORTFOLIO, JSON.stringify(portfolio));
    } catch (e) {
      console.error("Failed to save portfolio to LocalStorage:", e);
    }
  },

  getApiKey() {
    return localStorage.getItem(this.KEYS.API_KEY) || "";
  },

  saveApiKey(key) {
    if (key) {
      localStorage.setItem(this.KEYS.API_KEY, key.trim());
    } else {
      localStorage.removeItem(this.KEYS.API_KEY);
    }
  },

  getChatHistory() {
    try {
      const data = localStorage.getItem(this.KEYS.CHAT_HISTORY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  saveChatHistory(history) {
    try {
      localStorage.setItem(this.KEYS.CHAT_HISTORY, JSON.stringify(history));
    } catch (e) {}
  },

  clearChatHistory() {
    localStorage.removeItem(this.KEYS.CHAT_HISTORY);
  },

  getContactInfo() {
    try {
      const data = localStorage.getItem(this.KEYS.CONTACT_INFO);
      return data ? JSON.parse(data) : { name: "Priyanshu Dubey", phone: "+91 9876543210" };
    } catch (e) {
      return { name: "Priyanshu Dubey", phone: "+91 9876543210" };
    }
  },

  saveContactInfo(info) {
    try {
      localStorage.setItem(this.KEYS.CONTACT_INFO, JSON.stringify(info));
    } catch (e) {}
  }
};
