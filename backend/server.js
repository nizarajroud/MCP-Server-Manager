import express from 'express';

const app = express();
const PORT = process.env.PORT || 3001;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'nizarajroud/kiro-configs';
const GITHUB_API = 'https://api.github.com';

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
    res.json(agents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/agent/:name?branch=main — Get agent file content
app.get('/api/agent/:name', async (req, res) => {
  try {
    const branch = req.query.branch || 'main';
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
    const commitMessage = message || `feat: update ${req.params.name} agent config`;

    const response = await githubFetch(`/contents/agents/${req.params.name}.json`, {
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

app.listen(PORT, () => {
  console.log(`Backend démarré sur http://localhost:${PORT}`);
  if (!GITHUB_TOKEN) {
    console.warn('⚠️  GITHUB_TOKEN non configuré — les appels API GitHub échoueront');
  }
});
