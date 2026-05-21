const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export const api = {
  async getConfig() {
    const res = await fetch(`${API_URL}/api/config`);
    return res.json();
  },

  async getCategories() {
    const res = await fetch(`${API_URL}/api/categories`);
    return res.json();
  },

  async saveCategories(categories) {
    const res = await fetch(`${API_URL}/api/categories`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(categories)
    });
    return res.json();
  },

  async getBranches() {
    const res = await fetch(`${API_URL}/api/branches`);
    return res.json();
  },

  async getAgents(branch) {
    const res = await fetch(`${API_URL}/api/agents?branch=${branch}`);
    return res.json();
  },

  async getAgent(name, branch) {
    const res = await fetch(`${API_URL}/api/agent/${name}?branch=${branch}`);
    return res.json();
  },

  async saveAgent(name, { content, sha, branch, message }) {
    const res = await fetch(`${API_URL}/api/agent/${name}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, sha, branch, message })
    });
    if (res.status === 409) {
      throw new Error('CONFLICT');
    }
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Save failed');
    }
    return res.json();
  },

  async syncLocal(branch) {
    const res = await fetch(`${API_URL}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Sync failed');
    }
    return res.json();
  },

  async checkSyncConflicts(branch) {
    const res = await fetch(`${API_URL}/api/sync/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Check failed');
    }
    return res.json();
  }
};
