import express from 'express';
import yaml from 'js-yaml';

const app = express();
const PORT = process.env.PORT || 3001;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'nizarajroud/kiro-configs';
const GITHUB_API = 'https://api.github.com';
const LOCAL_BRANCH = process.env.LOCAL_BRANCH || 'personal-branch';
const DEFAULT_AGENT = process.env.DEFAULT_AGENT || 'exp2';
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
    const { warning: pullWarning } = await pullLocalRepo(branch);

    res.json({ success: true, sha: result.content.sha, warning: pullWarning });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/common-servers?branch= — Get common MCP servers from settings/mcp.json
app.get('/api/common-servers', async (req, res) => {
  try {
    const branch = req.query.branch || LOCAL_BRANCH;
    const response = await githubFetch(`/contents/settings/mcp.json?ref=${branch}`);
    if (!response.ok) return res.json({});
    const file = await response.json();
    const content = JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8'));
    res.json(content.mcpServers || {});
  } catch (e) {
    res.json({});
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
    agents.unshift({ name: 'Commun', path: 'settings/mcp.json', sha: null });
    res.json(agents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/agent/:name?branch=main — Get agent file content
app.get('/api/agent/:name', async (req, res) => {
  try {
    const branch = req.query.branch || 'main';
    const filePath = req.params.name === 'Commun' ? 'settings/mcp.json' : `agents/${req.params.name}.json`;
    const response = await githubFetch(`/contents/${filePath}?ref=${branch}`);
    const file = await response.json();
    const content = JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8'));
    res.json({ content, sha: file.sha });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Helper: git pull --rebase on local repo to sync with remote
const pullLocalRepo = async (branch) => {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  let stashed = false;
  let warning = null;
  try {
    // Check for local changes
    const { stdout: status } = await execAsync(`git -C ${LOCAL_REPO_PATH} status --porcelain`);
    if (status.trim()) {
      // Stash local changes
      await execAsync(`git -C ${LOCAL_REPO_PATH} stash push -m "auto-stash before pull"`);
      stashed = true;
    }
    await execAsync(`git -C ${LOCAL_REPO_PATH} checkout ${branch} 2>/dev/null || true`);
    await execAsync(`git -C ${LOCAL_REPO_PATH} pull --rebase origin ${branch}`);
    // Restore stashed changes
    if (stashed) {
      try {
        await execAsync(`git -C ${LOCAL_REPO_PATH} stash pop`);
      } catch (e) {
        warning = 'Conflit avec des changements locaux — vérifiez git stash';
      }
    }
  } catch (e) {
    console.error('Git pull failed:', e.message);
  }
  return { warning };
};

// PUT /api/agent/:name — Rebase + Commit + Push + Sync local
app.put('/api/agent/:name', async (req, res) => {
  try {
    const { content, branch, message } = req.body;

    if (!content || !branch) {
      return res.status(400).json({ error: 'content and branch required' });
    }

    // Déterminer le chemin selon l'agent
    const filePath = req.params.name === 'Commun' ? 'settings/mcp.json' : `agents/${req.params.name}.json`;
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

    // 3. GIT PULL: Sync local repo with remote
    const { warning: pullWarning } = await pullLocalRepo(branch);

    res.json({ success: true, sha: result.content.sha, commit: result.commit.sha, warning: pullWarning });
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
        const { warning: pullWarning } = await pullLocalRepo(branch);
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

const SERVERS_YAML_PATH = 'settings/servers.yaml';

// GET /api/servers-registry?branch= — Get server placement metadata from servers.yaml
app.get('/api/servers-registry', async (req, res) => {
  try {
    const branch = req.query.branch || LOCAL_BRANCH;
    const response = await githubFetch(`/contents/${SERVERS_YAML_PATH}?ref=${branch}`);
    if (!response.ok) return res.json({});
    const file = await response.json();
    const content = Buffer.from(file.content, 'base64').toString('utf-8');
    const parsed = yaml.load(content);
    const machines = parsed.machines || {};
    const servers = parsed.servers || {};
    const registry = {};
    for (const [name, cfg] of Object.entries(servers)) {
      const machine = machines[cfg.target] || {};
      registry[name] = {
        target: cfg.target,
        host: machine.host || 'localhost',
        port: cfg.port || (machine.base_port ? machine.base_port + (cfg.port_offset || 0) : null)
      };
    }
    res.json(registry);
  } catch (e) {
    res.json({});
  }
});

// PUT /api/servers-registry — Update a server's target in servers.yaml
app.put('/api/servers-registry', async (req, res) => {
  try {
    const { serverName, target, branch } = req.body;
    if (!serverName || !target || !branch) return res.status(400).json({ error: 'serverName, target, branch required' });

    // Fetch current servers.yaml
    const response = await githubFetch(`/contents/${SERVERS_YAML_PATH}?ref=${branch}`);
    if (!response.ok) return res.status(404).json({ error: 'servers.yaml not found' });
    const file = await response.json();
    const content = Buffer.from(file.content, 'base64').toString('utf-8');
    const parsed = yaml.load(content);

    // Update target
    if (!parsed.servers) parsed.servers = {};
    if (!parsed.servers[serverName]) {
      parsed.servers[serverName] = { target, port_offset: Object.values(parsed.servers).filter(s => s.target === target).length };
    } else {
      parsed.servers[serverName].target = target;
    }

    // If moving to envy (local), remove port_offset
    if (target === 'local') {
      delete parsed.servers[serverName].port_offset;
      parsed.servers[serverName].reason = 'Local';
    } else if (parsed.servers[serverName].port_offset === undefined) {
      // Assign next available port_offset for this machine
      const usedOffsets = Object.values(parsed.servers).filter(s => s.target === target && s.port_offset !== undefined).map(s => s.port_offset);
      parsed.servers[serverName].port_offset = usedOffsets.length > 0 ? Math.max(...usedOffsets) + 1 : 0;
    }

    // Commit updated yaml
    const latestRes = await githubFetch(`/contents/${SERVERS_YAML_PATH}?ref=${branch}`);
    const latest = await latestRes.json();
    const encoded = Buffer.from(yaml.dump(parsed, { lineWidth: -1 })).toString('base64');
    const commitRes = await githubFetch(`/contents/${SERVERS_YAML_PATH}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `feat: move ${serverName} to ${target}`,
        content: encoded,
        sha: latest.sha,
        branch
      })
    });
    if (!commitRes.ok) {
      const err = await commitRes.json();
      return res.status(500).json({ error: err.message });
    }

    const { warning: pullWarning } = await pullLocalRepo(branch);

    // Return updated registry entry
    const machine = parsed.machines?.[target] || {};
    const port = machine.base_port ? machine.base_port + (parsed.servers[serverName].port_offset || 0) : null;
    res.json({ success: true, serverName, target, port });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/servers-registry/batch — Update multiple servers' targets in one commit
app.post('/api/servers-registry/batch', async (req, res) => {
  try {
    const { updates, branch } = req.body;
    if (!updates?.length || !branch) return res.status(400).json({ error: 'updates[] and branch required' });

    // Fetch current servers.yaml
    const response = await githubFetch(`/contents/${SERVERS_YAML_PATH}?ref=${branch}`);
    if (!response.ok) return res.status(404).json({ error: 'servers.yaml not found' });
    const file = await response.json();
    const content = Buffer.from(file.content, 'base64').toString('utf-8');
    const parsed = yaml.load(content);
    if (!parsed.servers) parsed.servers = {};

    // Apply all updates
    for (const { serverName, target } of updates) {
      if (!parsed.servers[serverName]) {
        parsed.servers[serverName] = { target };
      } else {
        parsed.servers[serverName].target = target;
      }
      if (target === 'local') {
        delete parsed.servers[serverName].port_offset;
        parsed.servers[serverName].reason = 'Local';
      } else if (parsed.servers[serverName].port_offset === undefined) {
        const usedOffsets = Object.values(parsed.servers).filter(s => s.target === target && s.port_offset !== undefined).map(s => s.port_offset);
        parsed.servers[serverName].port_offset = usedOffsets.length > 0 ? Math.max(...usedOffsets) + 1 : 0;
      }
    }

    // Single commit
    const latestRes = await githubFetch(`/contents/${SERVERS_YAML_PATH}?ref=${branch}`);
    const latest = await latestRes.json();
    const encoded = Buffer.from(yaml.dump(parsed, { lineWidth: -1 })).toString('base64');
    const commitRes = await githubFetch(`/contents/${SERVERS_YAML_PATH}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `feat: batch move ${updates.length} servers to ${updates[0].target}`,
        content: encoded,
        sha: latest.sha,
        branch
      })
    });
    if (!commitRes.ok) {
      const err = await commitRes.json();
      return res.status(500).json({ error: err.message });
    }

    const { warning: pullWarning } = await pullLocalRepo(branch);

    // Return updated registry
    const machines = parsed.machines || {};
    const registry = {};
    for (const [name, cfg] of Object.entries(parsed.servers)) {
      const machine = machines[cfg.target] || {};
      registry[name] = { target: cfg.target, host: machine.host || 'localhost', port: cfg.port || (machine.base_port ? machine.base_port + (cfg.port_offset || 0) : null) };
    }
    res.json({ success: true, changed: updates.length, registry });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/resources — Local process resource consumption per MCP server
app.get('/api/resources', async (req, res) => {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    // Get all node/python/uvx processes with CPU and MEM
    const { stdout } = await execAsync("ps aux --no-headers | grep -E 'mcp|supergateway|context7|firecrawl|mermaid|youtube|notebooklm|sequential|airtable|telegram|ticktick|github|gmail|notion|aws-api|eks-mcp|bookmarks|excel|pdf-reader|memory.*server|fetch.*mcp' | grep -v grep");
    const lines = stdout.trim().split('\n').filter(Boolean);
    const results = {};
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const cpu = parseFloat(parts[2]) || 0;
      const mem = parseFloat(parts[3]) || 0;
      const memKB = parseInt(parts[5]) || 0;
      const cmd = parts.slice(10).join(' ');
      // Match server name from command
      const serverNames = Object.keys(req.query).length ? [] : null;
      // Find which MCP server this process belongs to
      let matched = null;
      const patterns = [
        ['context7', 'context7'], ['firecrawl', 'firecrawl'], ['mcp-mermaid', 'mermaid'],
        ['youtube-transcript', 'youtube'], ['notebooklm', 'notebooklm'], ['sequential-thinking', 'sequential'],
        ['airtable', 'airtable'], ['telegram', 'telegram'], ['ticktick', 'ticktick'],
        ['github', 'github_wrapper\\|server-github'], ['gmail', 'gmail'], ['notion-workspace', 'notion'],
        ['awslabs.aws-api-mcp-server', 'aws_api_mcp\\|aws-api'], ['awslabs.eks-mcp-server', 'eks_mcp\\|eks-mcp'],
        ['memory', 'server-memory'], ['time', 'server-time'], ['excel', 'excel-mcp\\|excel'],
        ['bookmarks', 'bookmarks'], ['pdf-reader', 'pdf-reader'], ['fetch', 'server-fetch\\|mcp-server-fetch']
      ];
      for (const [name, pattern] of patterns) {
        if (new RegExp(pattern).test(cmd)) { matched = name; break; }
      }
      if (matched) {
        if (!results[matched]) results[matched] = { cpu: 0, memMB: 0 };
        results[matched].cpu += cpu;
        results[matched].memMB += Math.round(memKB / 1024);
      }
    }
    // Classify: heavy if > 300MB memory
    const classified = {};
    for (const [name, data] of Object.entries(results)) {
      classified[name] = { ...data, weight: data.memMB > 300 ? 'heavy' : 'light' };
    }
    res.json(classified);
  } catch (e) {
    res.json({});
  }
});

// POST /api/server-control — Start or stop a server on a remote machine via SSH
app.post('/api/server-control', async (req, res) => {
  try {
    const { serverName, action, branch } = req.body;
    if (!serverName || !action || !branch) return res.status(400).json({ error: 'serverName, action (start|stop), branch required' });

    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // Get server info from registry
    const regRes = await githubFetch(`/contents/${SERVERS_YAML_PATH}?ref=${branch}`);
    if (!regRes.ok) return res.status(404).json({ error: 'servers.yaml not found' });
    const regFile = await regRes.json();
    const parsed = yaml.load(Buffer.from(regFile.content, 'base64').toString('utf-8'));
    const srv = parsed.servers?.[serverName];
    const machine = parsed.machines?.[srv?.target];
    if (!srv || !machine || srv.target === 'local') return res.status(400).json({ error: 'Server is local or not found' });

    const port = srv.port || (machine.base_port + (srv.port_offset || 0));
    const sshCmd = `ssh -p ${machine.ssh_port || 22} -i ~/.ssh/id_rsa_wsl -o StrictHostKeyChecking=no ${machine.ssh_user || 'nizar'}@${machine.host}`;

    if (action === 'stop') {
      await execAsync(`${sshCmd} "pkill -f 'supergateway.*--port ${port}' 2>/dev/null || true"`);
      res.json({ success: true, action: 'stop', serverName, port });
    } else if (action === 'start') {
      // Get command from agent configs
      const agentFiles = await execAsync(`ls ${LOCAL_REPO_PATH}/agents/*.json`);
      let stdio = '';
      for (const file of agentFiles.stdout.trim().split('\n')) {
        const { stdout } = await execAsync(`jq -r '.mcpServers."${serverName}"._original // .mcpServers."${serverName}" | if .command then .command + " " + (.args // [] | join(" ")) else empty end' "${file}" 2>/dev/null`);
        if (stdout.trim() && !stdout.includes('mcp-remote')) { stdio = stdout.trim(); break; }
      }
      if (!stdio) return res.status(404).json({ error: `Command not found for ${serverName}` });

      // Source .env and start supergateway
      await execAsync(`${sshCmd} "pkill -f 'supergateway.*--port ${port}' 2>/dev/null || true"`);
      await execAsync(`${sshCmd} "source ~/HomeWspce/kiro-configs/.env 2>/dev/null; nohup npx -y supergateway --stdio '${stdio}' --port ${port} --outputTransport streamableHttp --stateful > /tmp/mcp-${serverName}.log 2>&1 &"`);
      res.json({ success: true, action: 'start', serverName, port, stdio });
    } else {
      res.status(400).json({ error: 'action must be start or stop' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/health — TCP port check on remote servers
app.get('/api/health', async (req, res) => {
  try {
    const branch = req.query.branch || LOCAL_BRANCH;
    const regRes = await fetch(`http://localhost:${PORT}/api/servers-registry?branch=${branch}`);
    const registry = await regRes.json();
    const { createConnection } = await import('net');
    const checks = Object.entries(registry)
      .filter(([, r]) => r.target !== 'local' && r.port)
      .map(([name, r]) => new Promise(resolve => {
        const sock = createConnection({ host: r.host, port: r.port, timeout: 1500 });
        sock.on('connect', () => { sock.destroy(); resolve([name, 'up']); });
        sock.on('error', () => resolve([name, 'down']));
        sock.on('timeout', () => { sock.destroy(); resolve([name, 'down']); });
      }));
    const results = await Promise.all(checks);
    res.json(Object.fromEntries(results));
  } catch (e) {
    res.json({});
  }
});

// POST /api/apply-remote-config — Transform agent JSON: remote servers → mcp-remote
app.post('/api/apply-remote-config', async (req, res) => {
  try {
    const { agent, branch } = req.body;
    if (!agent || !branch) return res.status(400).json({ error: 'agent and branch required' });

    // Load registry from servers.yaml
    const regRes = await githubFetch(`/contents/${SERVERS_YAML_PATH}?ref=${branch}`);
    if (!regRes.ok) return res.status(404).json({ error: 'servers.yaml not found' });
    const regFile = await regRes.json();
    const parsed = yaml.load(Buffer.from(regFile.content, 'base64').toString('utf-8'));
    const machines = parsed.machines || {};
    const serversYaml = parsed.servers || {};

    // Load agent JSON
    const filePath = `agents/${agent}.json`;
    const agentRes = await githubFetch(`/contents/${filePath}?ref=${branch}`);
    if (!agentRes.ok) return res.status(404).json({ error: 'Agent not found' });
    const agentFile = await agentRes.json();
    const agentContent = JSON.parse(Buffer.from(agentFile.content, 'base64').toString('utf-8'));

    // Transform: for each server with remote target, replace with mcp-remote
    const mcpServers = agentContent.mcpServers || {};
    let changed = 0;
    for (const [name, config] of Object.entries(mcpServers)) {
      const srv = serversYaml[name];
      if (!srv || srv.target === 'local') continue;
      const machine = machines[srv.target];
      if (!machine || !machine.base_port) continue;
      const port = machine.base_port + (srv.port_offset || 0);
      const url = `http://${machine.host}:${port}/mcp`;
      // Only transform if not already mcp-remote
      if (config.args && config.args.includes('mcp-remote')) continue;
      // Store original config for restore
      mcpServers[name] = {
        ...config,
        _original: { command: config.command, args: config.args },
        command: 'npx',
        args: ['mcp-remote', url, '--allow-http']
      };
      changed++;
    }

    if (changed === 0) return res.json({ success: true, changed: 0, message: 'Nothing to change' });

    // Commit
    const updated = { ...agentContent, mcpServers };
    const latestRes = await githubFetch(`/contents/${filePath}?ref=${branch}`);
    const latest = await latestRes.json();
    const encoded = Buffer.from(JSON.stringify(updated, null, 2)).toString('base64');
    const commitRes = await githubFetch(`/contents/${filePath}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `feat: apply remote config on ${agent} (${changed} servers)`,
        content: encoded,
        sha: latest.sha,
        branch
      })
    });
    if (!commitRes.ok) {
      const err = await commitRes.json();
      return res.status(500).json({ error: err.message });
    }

    const { warning: pullWarning } = await pullLocalRepo(branch);

    res.json({ success: true, changed });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/restore-local-config — Restore original commands from _original field
app.post('/api/restore-local-config', async (req, res) => {
  try {
    const { agent, branch } = req.body;
    if (!agent || !branch) return res.status(400).json({ error: 'agent and branch required' });

    const filePath = `agents/${agent}.json`;
    const agentRes = await githubFetch(`/contents/${filePath}?ref=${branch}`);
    if (!agentRes.ok) return res.status(404).json({ error: 'Agent not found' });
    const agentFile = await agentRes.json();
    const agentContent = JSON.parse(Buffer.from(agentFile.content, 'base64').toString('utf-8'));

    const mcpServers = agentContent.mcpServers || {};
    let changed = 0;
    for (const [name, config] of Object.entries(mcpServers)) {
      if (config._original) {
        mcpServers[name] = { ...config, command: config._original.command, args: config._original.args };
        delete mcpServers[name]._original;
        changed++;
      }
    }

    if (changed === 0) return res.json({ success: true, changed: 0, message: 'Nothing to restore' });

    const updated = { ...agentContent, mcpServers };
    const latestRes = await githubFetch(`/contents/${filePath}?ref=${branch}`);
    const latest = await latestRes.json();
    const encoded = Buffer.from(JSON.stringify(updated, null, 2)).toString('base64');
    const commitRes = await githubFetch(`/contents/${filePath}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `feat: restore local config on ${agent} (${changed} servers)`,
        content: encoded,
        sha: latest.sha,
        branch
      })
    });
    if (!commitRes.ok) {
      const err = await commitRes.json();
      return res.status(500).json({ error: err.message });
    }

    const { warning: pullWarning } = await pullLocalRepo(branch);

    res.json({ success: true, changed });
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

    const getAgentPath = (name) => `agents/${name}.json`;
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

    // 3. SYNC LOCAL

    // 4. GIT PULL: sync local repo
    const { warning: pullWarning } = await pullLocalRepo(branch);

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
