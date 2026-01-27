const STORAGE_PREFIX = 'mcp_server:';

export const storage = {
  async list(prefix = STORAGE_PREFIX) {
    const keys = Object.keys(localStorage).filter(key => key.startsWith(prefix));
    return { keys };
  },

  async get(key) {
    const value = localStorage.getItem(key);
    return value ? { value } : null;
  },

  async set(key, value) {
    localStorage.setItem(key, value);
  },

  async delete(key) {
    localStorage.removeItem(key);
  }
};

if (typeof window !== 'undefined') {
  window.storage = storage;
}
