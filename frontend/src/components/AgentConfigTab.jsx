import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const AgentConfigTab = ({ agents, selectedAgent, agentContent, agentSha, selectedBranch, registry, health, saveToGitHub, showNotification, reloadAgent, reloadRegistry, setRegistry, reloadHealth, api }) => {
  const [subTab, setSubTab] = useState('general');
  const [deploySort, setDeploySort] = useState({ key: null, asc: true });
  const [deploySearch, setDeploySearch] = useState('');
  const [deploySelected, setDeploySelected] = useState(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', welcomeMessage: '' });
  const [promptContent, setPromptContent] = useState('');
  const [promptFilePath, setPromptFilePath] = useState('');
  const [toolsList, setToolsList] = useState('');
  const [resourcesList, setResourcesList] = useState('');

  useEffect(() => {
    if (agentContent) {
      setForm({
        name: agentContent.name || '',
        description: agentContent.description || '',
        welcomeMessage: agentContent.welcomeMessage || ''
      });
      setToolsList((agentContent.tools || []).join('\n'));
      setResourcesList((agentContent.resources || []).join('\n'));
      
      const prompt = agentContent.prompt || '';
      if (prompt.startsWith('file://')) {
        const relativePath = prompt.replace('file://', '');
        // Resolve relative to kiro-configs repo
        const resolvedPath = `/home/nizar/HomeWspce/kiro-configs/agents/${relativePath}`.replace(/\/agents\/\.\.\//, '/');
        setPromptFilePath(resolvedPath);
        loadPromptFile(resolvedPath);
      } else {
        setPromptFilePath('');
        setPromptContent(prompt);
      }
    }
  }, [agentContent]);

  const loadPromptFile = async (path) => {
    try {
      const res = await fetch(`${API_URL}/api/file?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const data = await res.json();
        setPromptContent(data.content);
      } else {
        setPromptContent(`# Fichier non trouvé: ${path}`);
      }
    } catch (e) {
      setPromptContent(`# Erreur chargement: ${e.message}`);
    }
  };

  const saveGeneral = async () => {
    try {
      const updated = { ...agentContent, name: form.name, description: form.description, welcomeMessage: form.welcomeMessage };
      await api.saveAgent(selectedAgent, {
        content: updated, branch: selectedBranch,
        message: `feat: update ${selectedAgent} general config`
      });
      showNotification('Configuration générale sauvegardée');
    } catch (e) {
      showNotification(`Erreur: ${e.message}`, 'error');
    }
  };

  const savePrompt = async () => {
    try {
      if (promptFilePath) {
        const res = await fetch(`${API_URL}/api/file`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: promptFilePath, content: promptContent, branch: selectedBranch })
        });
        if (res.ok) showNotification('Prompt sauvegardé, commité et synchronisé ✓');
        else showNotification('Erreur sauvegarde prompt', 'error');
      } else {
        const updated = { ...agentContent, prompt: promptContent };
        await api.saveAgent(selectedAgent, {
          content: updated, branch: selectedBranch,
          message: `feat: update ${selectedAgent} prompt`
        });
        showNotification('Prompt sauvegardé');
      }
    } catch (e) {
      showNotification(`Erreur: ${e.message}`, 'error');
    }
  };

  const saveTools = async () => {
    try {
      const tools = toolsList.split('\n').map(t => t.trim()).filter(Boolean);
      const updated = { ...agentContent, tools };
      await api.saveAgent(selectedAgent, {
        content: updated, branch: selectedBranch,
        message: `feat: update ${selectedAgent} tools`
      });
      showNotification('Tools sauvegardés');
    } catch (e) {
      showNotification(`Erreur: ${e.message}`, 'error');
    }
  };

  const saveResources = async () => {
    try {
      const resources = resourcesList.split('\n').map(r => r.trim()).filter(Boolean);
      const updated = { ...agentContent, resources };
      await api.saveAgent(selectedAgent, {
        content: updated, branch: selectedBranch,
        message: `feat: update ${selectedAgent} resources`
      });
      showNotification('Resources sauvegardées');
    } catch (e) {
      showNotification(`Erreur: ${e.message}`, 'error');
    }
  };

  if (!agentContent) return <p className="text-slate-400">Sélectionnez un agent pour voir sa configuration.</p>;

  const subTabs = [
    { id: 'general', label: 'Général' },
    { id: 'prompt', label: 'Prompt' },
    { id: 'tools', label: 'Tools' },
    { id: 'resources', label: 'Resources' },
    { id: 'deploy', label: 'Déploiement' }
  ];

  return (
    <div>
      <div className="flex gap-1 border-b border-slate-700 mb-4">
        {subTabs.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={`px-4 py-2 border-b-2 transition ${subTab === t.id ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'general' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Nom</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:border-purple-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full h-24 px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:border-purple-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Welcome Message</label>
            <input value={form.welcomeMessage} onChange={e => setForm({ ...form, welcomeMessage: e.target.value })} className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:border-purple-500 focus:outline-none" />
          </div>
          <button onClick={saveGeneral} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition flex items-center gap-2">
            <Save size={18} /> Sauvegarder
          </button>
        </div>
      )}

      {subTab === 'prompt' && (
        <div className="space-y-4">
          {promptFilePath && (
            <p className="text-sm text-slate-400">📄 Fichier: <code className="text-purple-300">{promptFilePath}</code></p>
          )}
          <CodeMirror
            value={promptContent}
            onChange={setPromptContent}
            theme={oneDark}
            extensions={[markdown()]}
            height="500px"
            className="rounded-lg overflow-hidden border border-slate-600"
          />
          <button onClick={savePrompt} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition flex items-center gap-2">
            <Save size={18} /> Sauvegarder
          </button>
        </div>
      )}

      {subTab === 'tools' && (
        <div className="space-y-4">
          <label className="block text-sm text-slate-400 mb-1">Tools autorisés (un par ligne)</label>
          <CodeMirror
            value={toolsList}
            onChange={setToolsList}
            theme={oneDark}
            height="300px"
            className="rounded-lg overflow-hidden border border-slate-600"
          />
          <button onClick={saveTools} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition flex items-center gap-2">
            <Save size={18} /> Sauvegarder
          </button>
        </div>
      )}

      {subTab === 'resources' && (
        <div className="space-y-4">
          <label className="block text-sm text-slate-400 mb-1">Resources (un pattern par ligne)</label>
          <CodeMirror
            value={resourcesList}
            onChange={setResourcesList}
            theme={oneDark}
            height="300px"
            className="rounded-lg overflow-hidden border border-slate-600"
          />
          <button onClick={saveResources} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition flex items-center gap-2">
            <Save size={18} /> Sauvegarder
          </button>
        </div>
      )}

      {subTab === 'deploy' && (() => {
        const allServers = Object.keys(agentContent.mcpServers || {});
        const totalInternet = allServers.filter(n => { const c = agentContent.mcpServers[n]; return c.args?.some(a => typeof a === 'string' && (a.startsWith('https://') || a.includes('.api.aws'))); }).length;
        const totalLAN = allServers.filter(n => { const c = agentContent.mcpServers[n]; return c.args?.includes('mcp-remote') && !c.args?.some(a => typeof a === 'string' && (a.startsWith('https://') || a.includes('.api.aws'))); }).length;
        const totalDirect = allServers.length - totalInternet - totalLAN;
        const totalEnabled = allServers.filter(n => !agentContent.mcpServers[n].disabled).length;
        const totalCritical = allServers.filter(n => (agentContent.mcpServers[n].priority || 'standard') === 'critical').length;
        return (
        <div className="space-y-4">
          <div className="flex gap-4 items-center flex-wrap">
            <div className="flex gap-3 text-sm flex-wrap">
              <span className="px-2 py-1 bg-slate-700 rounded">Total: <strong>{allServers.length}</strong></span>
              <span className="px-2 py-1 bg-red-900/50 rounded text-red-300">🔴 Critiques: <strong>{totalCritical}</strong></span>
              <span className="px-2 py-1 bg-slate-700 rounded">📦 Local: <strong>{totalDirect}</strong></span>
              <span className="px-2 py-1 bg-purple-900/50 rounded text-purple-300">💻 LAN: <strong>{totalLAN}</strong></span>
              <span className="px-2 py-1 bg-green-900/50 rounded text-green-300">🌐 Internet: <strong>{totalInternet}</strong></span>
              <span className="px-2 py-1 bg-green-900/50 rounded text-green-300">✓ Actifs: <strong>{totalEnabled}</strong></span>
            </div>
            <input
              type="text"
              placeholder="Rechercher un serveur..."
              value={deploySearch || ''}
              onChange={e => setDeploySearch(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-sm focus:border-purple-500 focus:outline-none w-64"
            />
          </div>
          {deploySelected.size > 0 && (
            <div className="flex items-center gap-3 px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600 flex-wrap">
              <span className="text-sm text-slate-300">☑ {deploySelected.size} sélectionné{deploySelected.size > 1 ? 's' : ''}</span>
              <button disabled={batchLoading} onClick={async () => {
                setBatchLoading(true);
                const mcpServers = { ...agentContent.mcpServers };
                for (const n of deploySelected) mcpServers[n] = { ...mcpServers[n], disabled: false };
                await saveToGitHub(mcpServers, `feat: enable ${deploySelected.size} servers`);
                setDeploySelected(new Set()); setBatchLoading(false);
              }} className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-xs active:scale-90 transition-transform disabled:opacity-50">🟢 Activer</button>
              <button disabled={batchLoading} onClick={async () => {
                setBatchLoading(true);
                const mcpServers = { ...agentContent.mcpServers };
                const eligible = [...deploySelected].filter(n => (mcpServers[n]?.priority || 'standard') !== 'critical');
                if (!eligible.length) { showNotification('Aucun serveur éligible (critiques exclus)', 'error'); setBatchLoading(false); return; }
                for (const n of eligible) mcpServers[n] = { ...mcpServers[n], disabled: true };
                await saveToGitHub(mcpServers, `feat: disable ${eligible.length} servers`);
                setDeploySelected(new Set()); setBatchLoading(false);
              }} className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-xs active:scale-90 transition-transform disabled:opacity-50">🔴 Désactiver</button>
              <button disabled={batchLoading} onClick={async () => {
                setBatchLoading(true);
                try {
                  // Exclude Internet + critical servers from batch
                  const eligible = [...deploySelected].filter(n => {
                    const c = agentContent.mcpServers[n];
                    if ((c.priority || 'standard') === 'critical') return false;
                    return !c?.args?.some(a => typeof a === 'string' && (a.startsWith('https://') || a.includes('.api.aws')));
                  });
                  if (!eligible.length) { showNotification('Aucun serveur éligible (Internet/critiques exclus)', 'error'); setBatchLoading(false); return; }
                  const updates = eligible.map(n => ({ serverName: n, target: 'pcalt' }));
                  const result = await api.batchUpdateTargets(updates, selectedBranch);
                  setRegistry(result.registry);
                  const mcpServers = { ...agentContent.mcpServers };
                  for (const n of eligible) {
                    const r = result.registry[n];
                    if (r && r.port) {
                      const cfg = mcpServers[n];
                      mcpServers[n] = { ...cfg, _original: cfg._original || { command: cfg.command, args: cfg.args }, command: 'npx', args: ['mcp-remote', `http://${r.host}:${r.port}/mcp`, '--allow-http'], disabled: false };
                    }
                  }
                  await saveToGitHub(mcpServers, `feat: move ${eligible.length} servers to pcalt`);
                  await reloadHealth();
                  setDeploySelected(new Set());
                } catch (e) { showNotification(`Erreur: ${e.message}`, 'error'); }
                setBatchLoading(false);
              }} className="px-3 py-1 bg-purple-600 hover:bg-purple-500 rounded text-xs active:scale-90 transition-transform disabled:opacity-50">💻 → pcalt</button>
              <button disabled={batchLoading} onClick={async () => {
                setBatchLoading(true);
                try {
                  const eligible = [...deploySelected].filter(n => (agentContent.mcpServers[n]?.priority || 'standard') !== 'critical');
                  if (!eligible.length) { showNotification('Aucun serveur éligible (critiques exclus)', 'error'); setBatchLoading(false); return; }
                  const updates = eligible.map(n => ({ serverName: n, target: 'envy' }));
                  const result = await api.batchUpdateTargets(updates, selectedBranch);
                  setRegistry(result.registry);
                  const mcpServers = { ...agentContent.mcpServers };
                  for (const n of eligible) {
                    const cfg = mcpServers[n];
                    if (cfg._original) {
                      mcpServers[n] = { ...cfg, command: cfg._original.command, args: cfg._original.args, disabled: false };
                      delete mcpServers[n]._original;
                    } else {
                      mcpServers[n] = { ...cfg, disabled: false };
                    }
                  }
                  await saveToGitHub(mcpServers, `feat: move ${deploySelected.size} servers to local`);
                  await reloadHealth();
                  setDeploySelected(new Set());
                } catch (e) { showNotification(`Erreur: ${e.message}`, 'error'); }
                setBatchLoading(false);
              }} className="px-3 py-1 bg-slate-600 hover:bg-slate-500 rounded text-xs active:scale-90 transition-transform disabled:opacity-50">📦 → Local</button>
              {batchLoading && <span className="text-xs text-purple-300 animate-pulse">⏳ En cours...</span>}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600 text-slate-400">
                  <th className="py-2 px-2">
                    <input type="checkbox" onChange={(e) => {
                      const all = Object.keys(agentContent.mcpServers || {});
                      setDeploySelected(e.target.checked ? new Set(all) : new Set());
                    }} checked={deploySelected.size > 0 && deploySelected.size === Object.keys(agentContent.mcpServers || {}).length} className="accent-purple-500" />
                  </th>
                  <th className="text-left py-2 px-3">Serveur</th>
                  <th className="text-left py-2 px-3 cursor-pointer hover:text-white" onClick={() => setDeploySort(s => ({ key: 'priority', asc: s.key === 'priority' ? !s.asc : true }))}>Priorité {deploySort.key === 'priority' ? (deploySort.asc ? '▲' : '▼') : ''}</th>
                  <th className="text-left py-2 px-3 cursor-pointer hover:text-white" onClick={() => setDeploySort(s => ({ key: 'etat', asc: s.key === 'etat' ? !s.asc : true }))}>État {deploySort.key === 'etat' ? (deploySort.asc ? '▲' : '▼') : ''}</th>
                  <th className="text-left py-2 px-3 cursor-pointer hover:text-white" onClick={() => setDeploySort(s => ({ key: 'ressource', asc: s.key === 'ressource' ? !s.asc : true }))}>Ressource {deploySort.key === 'ressource' ? (deploySort.asc ? '▲' : '▼') : ''}</th>
                  <th className="text-left py-2 px-3">Santé <button onClick={reloadHealth} className="text-slate-500 hover:text-white ml-1 active:scale-75 transition-transform" title="Rafraîchir">🔄</button></th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(agentContent.mcpServers || {}).filter(name => !deploySearch || name.toLowerCase().includes(deploySearch.toLowerCase())).map(name => {
                  const reg = registry[name];
                  const cfg = agentContent.mcpServers[name];
                  const isInternet = cfg?.args?.some(a => typeof a === 'string' && (a.startsWith('https://') || a.includes('.api.aws')));
                  const priority = cfg.priority || 'standard';
                  return { name, reg, cfg, isInternet, disabled: !!cfg.disabled, priority, ressource: isInternet ? 'internet' : (reg && reg.target !== 'envy') ? reg.target : '' };
                }).sort((a, b) => {
                  if (!deploySort.key) return 0;
                  let va, vb;
                  switch (deploySort.key) {
                    case 'priority': { const o = {critical:0,standard:1,occasional:2}; va = o[a.priority]||1; vb = o[b.priority]||1; break; }
                    case 'etat': va = a.disabled ? 1 : 0; vb = b.disabled ? 1 : 0; break;
                    case 'ressource': va = a.ressource; vb = b.ressource; break;
                    default: return 0;
                  }
                  if (va < vb) return deploySort.asc ? -1 : 1;
                  if (va > vb) return deploySort.asc ? 1 : -1;
                  return 0;
                }).map(({ name, reg, cfg, isInternet, priority }) => {
                  return (
                    <tr key={name} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="py-2 px-2">
                        <input type="checkbox" checked={deploySelected.has(name)} onChange={() => {
                          const s = new Set(deploySelected);
                          s.has(name) ? s.delete(name) : s.add(name);
                          setDeploySelected(s);
                        }} className="accent-purple-500" />
                      </td>
                      <td className="py-2 px-3 font-medium">{name}</td>
                      <td className="py-2 px-3">
                        <button onClick={async () => {
                          const next = priority === 'critical' ? 'standard' : priority === 'standard' ? 'occasional' : 'critical';
                          const mcpServers = { ...agentContent.mcpServers };
                          mcpServers[name] = { ...mcpServers[name], priority: next };
                          await saveToGitHub(mcpServers, `feat: set ${name} priority to ${next}`);
                        }} className="active:scale-75 transition-transform" title={priority}>
                          {priority === 'critical' ? '🔴' : priority === 'occasional' ? '⚪' : '🟡'}
                        </button>
                      </td>
                      <td className="py-2 px-3 border-l border-slate-700">
                        <button onClick={async () => {
                          if (priority === 'critical' && !confirm(`⚠️ ${name} est critique. Désactiver quand même ?`)) return;
                          const mcpServers = { ...agentContent.mcpServers };
                          mcpServers[name] = { ...mcpServers[name], disabled: !mcpServers[name].disabled };
                          const action = mcpServers[name].disabled ? 'disable' : 'enable';
                          try {
                            await saveToGitHub(mcpServers, `feat: ${action} ${name}`);
                          } catch (e) { showNotification(`Erreur: ${e.message}`, 'error'); }
                        }} className={`transition active:scale-75 ${cfg.disabled ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'}`}>
                          {cfg.disabled ? '🔴' : '🟢'}
                        </button>
                      </td>
                      <td className="py-2 px-3">
                        {isInternet ? (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-green-900/50 text-green-300">🌐 Internet</span>
                        ) : (
                          <select value={reg?.target === 'envy' || !reg ? 'local' : reg.target} onChange={async (e) => {
                            try {
                              const target = e.target.value === 'local' ? 'envy' : e.target.value;
                              // 1. Update servers.yaml
                              const result = await api.updateServerTarget(name, target, selectedBranch);
                              // 2. Update agent JSON (client config)
                              const mcpServers = { ...agentContent.mcpServers };
                              const serverCfg = mcpServers[name];
                              if (target === 'envy') {
                                // Restore local: use _original if available
                                if (serverCfg._original) {
                                  mcpServers[name] = { ...serverCfg, command: serverCfg._original.command, args: serverCfg._original.args, disabled: false };
                                  delete mcpServers[name]._original;
                                } else {
                                  mcpServers[name] = { ...serverCfg, disabled: false };
                                }
                              } else {
                                // Switch to remote: store original + set mcp-remote
                                const port = result.port;
                                if (port && !(serverCfg.args && serverCfg.args.includes('mcp-remote'))) {
                                  mcpServers[name] = {
                                    ...serverCfg,
                                    _original: { command: serverCfg.command, args: serverCfg.args },
                                    command: 'npx',
                                    args: ['mcp-remote', `http://192.168.2.56:${port}/mcp`, '--allow-http'],
                                    disabled: false
                                  };
                                } else {
                                  mcpServers[name] = { ...serverCfg, disabled: false };
                                }
                              }
                              await saveToGitHub(mcpServers, `feat: ${target === 'envy' ? 'restore local' : 'switch to remote'} ${name}`);
                              reloadRegistry();
                              reloadHealth();
                            } catch (err) { showNotification(`Erreur: ${err.message}`, 'error'); }
                          }} className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs focus:border-purple-500 focus:outline-none">
                            <option value="local">📦 Local</option>
                            <option value="pcalt">💻 pcalt</option>
                          </select>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        {health[name] ? (
                          <span className={`w-2 h-2 inline-block rounded-full ${health[name] === 'up' ? 'bg-green-400' : 'bg-red-400'}`} />
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        );
      })()}
    </div>
  );
};

export default AgentConfigTab;
