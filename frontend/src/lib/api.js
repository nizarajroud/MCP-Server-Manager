const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export const api = {
  async getConfig() {
    const res = await fetch(`${API_URL}/api/config`);
    return res.json();
  },

  async getCategories(branch) {
    const res = await fetch(`${API_URL}/api/categories${branch ? `?branch=${branch}` : ''}`);
    return res.json();
  },

  async saveCategories(categories, branch, message) {
    const res = await fetch(`${API_URL}/api/categories`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories, branch, message })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Save categories failed');
    }
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

  async saveAgent(name, { content, branch, message }) {
    const res = await fetch(`${API_URL}/api/agent/${name}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, branch, message })
    });
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
  },

  async getIssues() {
    const res = await fetch(`${API_URL}/api/issues`);
    return res.json();
  },

  async createIssue(title) {
    const res = await fetch(`${API_URL}/api/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Create failed');
    }
    return res.json();
  },

  async getServersRegistry(branch) {
    const res = await fetch(`${API_URL}/api/servers-registry${branch ? `?branch=${branch}` : ''}`);
    return res.json();
  },

  async updateServerTarget(serverName, target, branch) {
    const res = await fetch(`${API_URL}/api/servers-registry`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverName, target, branch })
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
    return res.json();
  },

  async batchUpdateTargets(updates, branch) {
    const res = await fetch(`${API_URL}/api/servers-registry/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates, branch })
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
    return res.json();
  },

  async getHealth(branch) {
    const res = await fetch(`${API_URL}/api/health${branch ? `?branch=${branch}` : ''}`);
    return res.json();
  },

  async getResources() {
    const res = await fetch(`${API_URL}/api/resources`);
    return res.json();
  },

  async applyRemoteConfig(agent, branch) {
    const res = await fetch(`${API_URL}/api/apply-remote-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent, branch })
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
    return res.json();
  },

  async restoreLocalConfig(agent, branch) {
    const res = await fetch(`${API_URL}/api/restore-local-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent, branch })
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
    return res.json();
  }
};
