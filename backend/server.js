import express from 'express';

const app = express();
const PORT = process.env.PORT || 3001;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'nizarajroud/kiro-configs';
const GITHUB_API = 'https://api.github.com';
const LOCAL_BRANCH = process.env.LOCAL_BRANCH || 'personal-branch';
const DEFAULT_AGENT = process.env.DEFAULT_AGENT || 'exp2';
const LEGACY_MCP_PATH = process.env.LEGACY_MCP_PATH || 'settings/mcp.json';
const LOCAL_REPO_PATH = process.env.LOCAL_REPO_PATH || '/home/nizar/HomeWspce/kiro-configs';
const BACKLOG_REPO = process.env.BACKLOG_REPO || 'nizarajroud/MCP-Server-Manager';
const BACKLOG_LABEL = process.env.BACKLOG_LABEL || 'backlog';

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
app.get('/api/config', async (req, res) => {
  let version = '';
  try {
    const { default: fs } = await import('fs/promises');
    const { default: path } = await import('path');
    version = (await fs.readFile(path.join(path.dirname(new URL(import.meta.url).pathname), '..', '.deployed-version'), 'utf-8')).trim();
  } catch (e) {}
  res.json({ localBranch: LOCAL_BRANCH, defaultAgent: DEFAULT_AGENT, version });
});

const CATEGORIES_PATH = 'settings/categories.json';

// GET /api/categories?branch= — Get server categories from GitHub
app.get('/api/categories', async (req, res) => {
  try {
    const branch = req.query.branch || LOCAL_BRANCH;
    const response = await githubFetch(`/contents/${CATEGORIES_PATH}?ref=${branch}`);
    if (!response.ok) return res.json({});
    const file = await response.json();
    const content = JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8'));
    res.json(content);
  } catch (e) {
    res.json({});
  }
});

// PUT /api/categories — Rebase + Commit + Push + Pull categories
app.put('/api/categories', async (req, res) => {
  try {
    const { categories, branch, message } = req.body;
    if (!categories || !branch) return res.status(400).json({ error: 'categories and branch required' });

    // 1. REBASE: fetch latest SHA
    const latestRes = await githubFetch(`/contents/${CATEGORIES_PATH}?ref=${branch}`);
    let sha = null;
    if (latestRes.ok) {
      const latestFile = await latestRes.json();
      sha = latestFile.sha;
    }

    // 2. COMMIT + PUSH
    const encoded = Buffer.from(JSON.stringify(categories, null, 2)).toString('base64');
    const response = await githubFetch(`/contents/${CATEGORIES_PATH}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: message || 'feat: update categories',
        content: encoded,
        sha,
        branch
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.message });
    }

    const result = await response.json();

    // 3. GIT PULL: sync local repo
    await pullLocalRepo(branch);

    res.json({ success: true, sha: result.content.sha });
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

// Helper: sync a single file from GitHub to local ~/.kiro/agents/
const syncFileToLocal = async (filePath, branch) => {
  const { default: fs } = await import('fs/promises');
  const { default: path } = await import('path');
  const { default: os } = await import('os');

  const agentsDir = path.join(os.homedir(), '.kiro', 'agents');
  await fs.mkdir(agentsDir, { recursive: true });

  const response = await githubFetch(`/contents/${filePath}?ref=${branch}`);
  if (response.ok) {
    const fileData = await response.json();
    const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
    const localFile = path.join(agentsDir, path.basename(filePath));
    await fs.writeFile(localFile, content);
    return localFile;
  }
  return null;
};

// Helper: git pull --rebase on local repo to sync with remote
const pullLocalRepo = async (branch) => {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  try {
    await execAsync(`git -C ${LOCAL_REPO_PATH} checkout ${branch} 2>/dev/null || true`);
    await execAsync(`git -C ${LOCAL_REPO_PATH} pull --rebase origin ${branch}`);
  } catch (e) {
    console.error('Git pull failed:', e.message);
  }
};

// PUT /api/agent/:name — Rebase + Commit + Push + Sync local
app.put('/api/agent/:name', async (req, res) => {
  try {
    const { content, branch, message } = req.body;

    if (!content || !branch) {
      return res.status(400).json({ error: 'content and branch required' });
    }

    // Déterminer le chemin selon l'agent
    const filePath = req.params.name === 'Commun' 
      ? LEGACY_MCP_PATH 
      : `agents/${req.params.name}.json`;
    const commitMessage = message || `feat: update ${req.params.name} config`;

    // 1. REBASE: Fetch latest SHA (pull latest)
    const latestRes = await githubFetch(`/contents/${filePath}?ref=${branch}`);
    if (!latestRes.ok) {
      return res.status(404).json({ error: 'File not found on remote' });
    }
    const latestFile = await latestRes.json();
    const latestSha = latestFile.sha;

    // 2. COMMIT + PUSH via GitHub API
    const encoded = Buffer.from(JSON.stringify(content, null, 2)).toString('base64');
    const response = await githubFetch(`/contents/${filePath}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: commitMessage,
        content: encoded,
        sha: latestSha,
        branch
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.message });
    }

    const result = await response.json();

    // 3. SYNC LOCAL: Download updated file to ~/.kiro/agents/
    const localPath = await syncFileToLocal(filePath, branch);

    // 4. GIT PULL: Sync local repo with remote
    await pullLocalRepo(branch);

    res.json({ success: true, sha: result.content.sha, commit: result.commit.sha, synced: localPath });
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

// GET /api/file?path= — Read a local file
app.get('/api/file', async (req, res) => {
  try {
    const { default: fs } = await import('fs/promises');
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'path required' });
    const content = await fs.readFile(filePath, 'utf-8');
    res.json({ content, path: filePath });
  } catch (e) {
    res.status(404).json({ error: 'File not found' });
  }
});

// PUT /api/file — Write local file + commit + push + sync
app.put('/api/file', async (req, res) => {
  try {
    const { default: fs } = await import('fs/promises');
    const { default: path } = await import('path');
    const { default: os } = await import('os');
    const { path: filePath, content, branch } = req.body;
    if (!filePath || content === undefined) return res.status(400).json({ error: 'path and content required' });

    if (branch) {
      // Determine repo path relative to kiro-configs
      const kiroConfigsBase = LOCAL_REPO_PATH + '/';
      if (filePath.startsWith(kiroConfigsBase)) {
        const repoPath = filePath.replace(kiroConfigsBase, '');
        
        // Rebase: get latest SHA
        const latestRes = await githubFetch(`/contents/${repoPath}?ref=${branch}`);
        let sha = null;
        if (latestRes.ok) {
          const latestFile = await latestRes.json();
          sha = latestFile.sha;
        }

        // Commit + Push
        const encoded = Buffer.from(content).toString('base64');
        const commitRes = await githubFetch(`/contents/${repoPath}`, {
          method: 'PUT',
          body: JSON.stringify({
            message: `feat: update ${path.basename(filePath)}`,
            content: encoded,
            sha,
            branch
          })
        });

        if (!commitRes.ok) {
          const err = await commitRes.json();
          return res.status(500).json({ error: `Commit failed: ${err.message}` });
        }

        // Git pull on local repo — this updates the local file
        await pullLocalRepo(branch);
      } else {
        // File outside repo — just write locally
        await fs.writeFile(filePath, content);
      }
    } else {
      // No branch — just write locally
      await fs.writeFile(filePath, content);
    }

    res.json({ success: true, path: filePath });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/move-server — Move or copy servers between agents
app.post('/api/move-server', async (req, res) => {
  try {
    const { serverNames, sourceAgent, destAgent, branch, mode } = req.body;
    if (!serverNames?.length || !sourceAgent || !destAgent || !branch) {
      return res.status(400).json({ error: 'serverNames, sourceAgent, destAgent, branch required' });
    }

    const getAgentPath = (name) => name === 'Commun' ? LEGACY_MCP_PATH : `agents/${name}.json`;
    const srcPath = getAgentPath(sourceAgent);
    const destPath = getAgentPath(destAgent);

    // Fetch both agent contents
    const [srcRes, destRes] = await Promise.all([
      githubFetch(`/contents/${srcPath}?ref=${branch}`),
      githubFetch(`/contents/${destPath}?ref=${branch}`)
    ]);

    if (!srcRes.ok || !destRes.ok) {
      return res.status(404).json({ error: 'Agent file not found' });
    }

    const srcFile = await srcRes.json();
    const destFile = await destRes.json();
    const srcContent = JSON.parse(Buffer.from(srcFile.content, 'base64').toString('utf-8'));
    const destContent = JSON.parse(Buffer.from(destFile.content, 'base64').toString('utf-8'));

    // Add servers to destination
    if (!destContent.mcpServers) destContent.mcpServers = {};
    for (const name of serverNames) {
      if (srcContent.mcpServers?.[name]) {
        destContent.mcpServers[name] = srcContent.mcpServers[name];
      }
    }

    // 1. REBASE dest: fetch latest SHA
    const destLatestRes = await githubFetch(`/contents/${destPath}?ref=${branch}`);
    const destLatest = await destLatestRes.json();

    // 2. COMMIT + PUSH dest
    const destEncoded = Buffer.from(JSON.stringify(destContent, null, 2)).toString('base64');
    const destCommit = await githubFetch(`/contents/${destPath}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `feat: ${mode} ${serverNames.join(', ')} to ${destAgent}`,
        content: destEncoded,
        sha: destLatest.sha,
        branch
      })
    });
    if (!destCommit.ok) {
      const err = await destCommit.json();
      return res.status(500).json({ error: `Dest commit failed: ${err.message}` });
    }

    // If move, remove from source
    if (mode === 'move') {
      for (const name of serverNames) {
        delete srcContent.mcpServers[name];
      }
      // REBASE src: fetch latest SHA
      const srcLatestRes = await githubFetch(`/contents/${srcPath}?ref=${branch}`);
      const srcLatest = await srcLatestRes.json();

      const srcEncoded = Buffer.from(JSON.stringify(srcContent, null, 2)).toString('base64');
      const srcCommit = await githubFetch(`/contents/${srcPath}`, {
        method: 'PUT',
        body: JSON.stringify({
          message: `feat: remove ${serverNames.join(', ')} from ${sourceAgent}`,
          content: srcEncoded,
          sha: srcLatest.sha,
          branch
        })
      });
      if (!srcCommit.ok) {
        const err = await srcCommit.json();
        return res.status(500).json({ error: `Source commit failed: ${err.message}` });
      }
    }

    // 3. SYNC LOCAL: only for non-Commun agents (Commun lives in settings/, git pull handles it)
    if (destAgent !== 'Commun') await syncFileToLocal(destPath, branch);
    if (mode === 'move' && sourceAgent !== 'Commun') await syncFileToLocal(srcPath, branch);

    // 4. GIT PULL: sync local repo
    await pullLocalRepo(branch);

    res.json({ success: true, moved: serverNames, from: sourceAgent, to: destAgent, mode });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/issues — List open issues from backlog repo
app.get('/api/issues', async (req, res) => {
  try {
    const [owner, repo] = BACKLOG_REPO.split('/');
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/issues?state=open&labels=${BACKLOG_LABEL}&per_page=50`, {
      headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    const issues = await response.json();
    res.json(issues.map(i => ({ number: i.number, title: i.title, state: i.state, created_at: i.created_at })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/issues — Create a new issue in backlog repo
app.post('/api/issues', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    const [owner, repo] = BACKLOG_REPO.split('/');
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, labels: [BACKLOG_LABEL] })
    });
    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.message });
    }
    const issue = await response.json();
    res.json({ number: issue.number, title: issue.title, state: issue.state, created_at: issue.created_at });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend démarré sur http://localhost:${PORT}`);
  if (!GITHUB_TOKEN) {
    console.warn('⚠️  GITHUB_TOKEN non configuré — les appels API GitHub échoueront');
  }
});
