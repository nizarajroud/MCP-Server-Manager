import express from 'express';

const app = express();
const PORT = process.env.PORT || 3001;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'nizarajroud/kiro-configs';
const GITHUB_API = 'https://api.github.com';
const LOCAL_BRANCH = process.env.LOCAL_BRANCH || 'personal-branch';
const DEFAULT_AGENT = process.env.DEFAULT_AGENT || 'exp2';
const LEGACY_MCP_PATH = process.env.LEGACY_MCP_PATH || 'settings/mcp.json';

app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

const githubFetch = async (path, options = {}) => {
  const [owner, repo] = GITHUB_REPO.split('/');
  const url = `${GITHUB_API}/repos/${owner}/${repo}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  return res;
};

// GET /api/config — Expose config to frontend
app.get('/api/config', (req, res) => {
  res.json({ localBranch: LOCAL_BRANCH, defaultAgent: DEFAULT_AGENT });
});

// GET /api/categories — Get server categories
app.get('/api/categories', async (req, res) => {
  try {
    const { default: fs } = await import('fs/promises');
    const { default: path } = await import('path');
    const { default: os } = await import('os');
    const filePath = path.join(os.homedir(), '.kiro', 'categories.json');
    const content = await fs.readFile(filePath, 'utf-8');
    res.json(JSON.parse(content));
  } catch (e) {
    res.json({});
  }
});

// PUT /api/categories — Update server categories
app.put('/api/categories', async (req, res) => {
  try {
    const { default: fs } = await import('fs/promises');
    const { default: path } = await import('path');
    const { default: os } = await import('os');
    const filePath = path.join(os.homedir(), '.kiro', 'categories.json');
    await fs.writeFile(filePath, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/branches — List branches
app.get('/api/branches', async (req, res) => {
  try {
    const response = await githubFetch('/branches');
    const branches = await response.json();
    res.json(branches.map(b => b.name));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/agents?branch=main — List agent files in a branch
app.get('/api/agents', async (req, res) => {
  try {
    const branch = req.query.branch || 'main';
    const response = await githubFetch(`/contents/agents?ref=${branch}`);
    const files = await response.json();
    const agents = files
      .filter(f => f.name.endsWith('.json') && !f.name.includes('example'))
      .map(f => ({ name: f.name.replace('.json', ''), path: f.path, sha: f.sha }));
    // Ajouter l'agent "Commun" (mcp.json)
    agents.unshift({ name: 'Commun', path: LEGACY_MCP_PATH, sha: null, isLegacy: true });
    res.json(agents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/agent/:name?branch=main — Get agent file content
app.get('/api/agent/:name', async (req, res) => {
  try {
    const branch = req.query.branch || 'main';
    
    // Cas spécial pour l'agent "Commun"
    if (req.params.name === 'Commun') {
      const response = await githubFetch(`/contents/${LEGACY_MCP_PATH}?ref=${branch}`);
      const file = await response.json();
      const content = JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8'));
      res.json({ content, sha: file.sha });
      return;
    }
    
    const response = await githubFetch(`/contents/agents/${req.params.name}.json?ref=${branch}`);
    const file = await response.json();
    const content = JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8'));
    res.json({ content, sha: file.sha });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/agent/:name — Save agent file (commit + push)
app.put('/api/agent/:name', async (req, res) => {
  try {
    const { content, sha, branch, message } = req.body;

    if (!content || !sha || !branch) {
      return res.status(400).json({ error: 'content, sha, and branch required' });
    }

    const encoded = Buffer.from(JSON.stringify(content, null, 2)).toString('base64');
    
    // Déterminer le chemin selon l'agent
    const filePath = req.params.name === 'Commun' 
      ? LEGACY_MCP_PATH 
      : `agents/${req.params.name}.json`;
    const commitMessage = message || `feat: update ${req.params.name} config`;

    const response = await githubFetch(`/contents/${filePath}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: commitMessage,
        content: encoded,
        sha,
        branch
      })
    });

    if (response.status === 409) {
      return res.status(409).json({ error: 'conflict', message: 'Le fichier a été modifié depuis votre dernière lecture.' });
    }

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.message });
    }

    const result = await response.json();
    res.json({ success: true, sha: result.content.sha, commit: result.commit.sha });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/sync/check — Check for local modifications before sync
app.post('/api/sync/check', async (req, res) => {
  try {
    const { branch } = req.body;
    if (!branch) return res.status(400).json({ error: 'branch required' });

    const { default: fs } = await import('fs/promises');
    const { default: path } = await import('path');
    const { default: os } = await import('os');

    const agentsDir = path.join(os.homedir(), '.kiro', 'agents');

    const listRes = await githubFetch(`/contents/agents?ref=${branch}`);
    const files = await listRes.json();
    const agentFiles = files.filter(f => f.name.endsWith('.json') && !f.name.includes('example'));

    const conflicts = [];
    for (const file of agentFiles) {
      const localPath = path.join(agentsDir, file.name);
      try {
        const localContent = await fs.readFile(localPath, 'utf-8');
        const fileRes = await githubFetch(`/contents/${file.path}?ref=${branch}`);
        const fileData = await fileRes.json();
        const remoteContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
        
        if (localContent.trim() !== remoteContent.trim()) {
          conflicts.push(file.name);
        }
      } catch (e) {
        // File doesn't exist locally, no conflict
      }
    }

    res.json({ conflicts, total: agentFiles.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/sync — Download agents from branch to ~/.kiro/agents/
app.post('/api/sync', async (req, res) => {
  try {
    const { branch } = req.body;
    if (!branch) return res.status(400).json({ error: 'branch required' });

    const { default: fs } = await import('fs/promises');
    const { default: path } = await import('path');
    const { default: os } = await import('os');

    const agentsDir = path.join(os.homedir(), '.kiro', 'agents');
    await fs.mkdir(agentsDir, { recursive: true });

    // List agents from branch
    const listRes = await githubFetch(`/contents/agents?ref=${branch}`);
    const files = await listRes.json();
    const agentFiles = files.filter(f => f.name.endsWith('.json') && !f.name.includes('example'));

    let synced = 0;
    for (const file of agentFiles) {
      const fileRes = await githubFetch(`/contents/${file.path}?ref=${branch}`);
      const fileData = await fileRes.json();
      const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
      await fs.writeFile(path.join(agentsDir, file.name), content);
      synced++;
    }

    res.json({ success: true, synced, path: agentsDir });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend démarré sur http://localhost:${PORT}`);
  if (!GITHUB_TOKEN) {
    console.warn('⚠️  GITHUB_TOKEN non configuré — les appels API GitHub échoueront');
  }
});
