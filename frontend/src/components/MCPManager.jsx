import React, { useState, useEffect } from 'react';
import { Database, Upload, Download, CheckSquare, Square, Plus, Save, Edit, Power, PowerOff, GitBranch, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';

const MCPManager = () => {
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [servers, setServers] = useState([]);
  const [agentContent, setAgentContent] = useState(null);
  const [agentSha, setAgentSha] = useState('');
  const [selectedServers, setSelectedServers] = useState(new Set());
  const [isEditing, setIsEditing] = useState(false);
  const [editedConfig, setEditedConfig] = useState('');
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [loading, setLoading] = useState(false);
  const [localBranch, setLocalBranch] = useState('');
  const [categories, setCategories] = useState({});
  const [collapsedCategories, setCollapsedCategories] = useState(new Set());
  const [defaultAgent, setDefaultAgent] = useState('');

  useEffect(() => { loadConfig(); }, []);
  useEffect(() => { if (localBranch) loadBranches(); }, [localBranch]);
  useEffect(() => { if (selectedBranch) loadAgents(); }, [selectedBranch, defaultAgent]);
  useEffect(() => { if (selectedAgent) loadAgent(); }, [selectedAgent]);
  useEffect(() => { setSelectedServers(new Set()); }, [selectedAgent]);

  const isLocalBranch = selectedBranch === localBranch;

  const loadConfig = async () => {
    try {
      const config = await api.getConfig();
      setLocalBranch(config.localBranch);
      setDefaultAgent(config.defaultAgent);
      const cats = await api.getCategories();
      setCategories(cats);
      setCollapsedCategories(new Set([...Object.keys(cats), '📦 Non catégorisé']));
    } catch (e) {}
  };

  const getServerCategory = (serverName) => {
    for (const [category, serverList] of Object.entries(categories)) {
      if (serverList.includes(serverName)) return category;
    }
    return '📦 Non catégorisé';
  };

  const getGroupedServers = () => {
    const grouped = {};
    for (const server of servers) {
      const category = getServerCategory(server.name);
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(server);
    }
    // Trier : actifs en premier, désactivés en bas
    for (const category of Object.keys(grouped)) {
      grouped[category].sort((a, b) => (a.disabled ? 1 : 0) - (b.disabled ? 1 : 0));
    }
    return grouped;
  };

  const toggleCategory = (category) => {
    const newCollapsed = new Set(collapsedCategories);
    if (newCollapsed.has(category)) {
      newCollapsed.delete(category);
    } else {
      newCollapsed.add(category);
    }
    setCollapsedCategories(newCollapsed);
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 3000);
  };

  const loadBranches = async () => {
    try {
      const data = await api.getBranches();
      setBranches(data);
      if (data.includes(localBranch)) setSelectedBranch(localBranch);
      else if (data.length > 0) setSelectedBranch(data[0]);
    } catch (e) {
      showNotification('Erreur chargement des branches', 'error');
    }
  };

  const loadAgents = async () => {
    try {
      setSelectedAgent('');
      setServers([]);
      const data = await api.getAgents(selectedBranch);
      setAgents(data);
      if (defaultAgent && data.find(a => a.name === defaultAgent)) setSelectedAgent(defaultAgent);
    } catch (e) {
      showNotification('Erreur chargement des agents', 'error');
    }
  };

  const loadAgent = async () => {
    try {
      setLoading(true);
      const { content, sha } = await api.getAgent(selectedAgent, selectedBranch);
      setAgentContent(content);
      setAgentSha(sha);
      const mcpServers = content.mcpServers || {};
      const serverList = Object.entries(mcpServers).map(([name, config]) => ({
        name,
        ...config
      }));
      setServers(serverList);
    } catch (e) {
      showNotification('Erreur chargement de l\'agent', 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveToGitHub = async (updatedMcpServers, message) => {
    try {
      const updatedContent = { ...agentContent, mcpServers: updatedMcpServers };
      const result = await api.saveAgent(selectedAgent, {
        content: updatedContent,
        sha: agentSha,
        branch: selectedBranch,
        message
      });
      setAgentSha(result.sha);
      setAgentContent(updatedContent);
      showNotification(`Commit réussi sur ${selectedBranch}`);
      return true;
    } catch (e) {
      if (e.message === 'CONFLICT') {
        const reload = confirm('Le fichier a été modifié depuis votre dernière lecture.\n\nÉcraser = OK | Recharger = Annuler');
        if (!reload) {
          await loadAgent();
          return false;
        }
        // Re-fetch SHA and retry
        const { sha } = await api.getAgent(selectedAgent, selectedBranch);
        const updatedContent = { ...agentContent, mcpServers: updatedMcpServers };
        const result = await api.saveAgent(selectedAgent, {
          content: updatedContent, sha, branch: selectedBranch, message
        });
        setAgentSha(result.sha);
        setAgentContent(updatedContent);
        showNotification(`Commit forcé sur ${selectedBranch}`);
        return true;
      }
      showNotification(`Erreur: ${e.message}`, 'error');
      return false;
    }
  };

  const toggleServerStatus = async (serverName) => {
    const mcpServers = { ...agentContent.mcpServers };
    mcpServers[serverName] = { ...mcpServers[serverName], disabled: !mcpServers[serverName].disabled };
    const action = mcpServers[serverName].disabled ? 'disable' : 'enable';
    const success = await saveToGitHub(mcpServers, `feat: ${action} ${serverName} on ${selectedAgent}`);
    if (success) {
      setServers(Object.entries(mcpServers).map(([name, config]) => ({ name, ...config })));
    }
  };

  const toggleSelectionStatus = async (enable) => {
    const mcpServers = { ...agentContent.mcpServers };
    for (const name of selectedServers) {
      mcpServers[name] = { ...mcpServers[name], disabled: !enable };
    }
    const action = enable ? 'enable' : 'disable';
    const success = await saveToGitHub(mcpServers, `feat: ${action} ${selectedServers.size} servers on ${selectedAgent}`);
    if (success) {
      setServers(Object.entries(mcpServers).map(([name, config]) => ({ name, ...config })));
    }
  };

  const toggleAll = () => {
    const allSelected = servers.length > 0 && servers.every(s => selectedServers.has(s.name));
    if (allSelected) {
      setSelectedServers(new Set());
    } else {
      setSelectedServers(new Set(servers.map(s => s.name)));
    }
  };

  const startEditing = () => {
    const mcpServers = agentContent.mcpServers || {};
    const formatted = Object.entries(mcpServers)
      .filter(([name]) => selectedServers.has(name))
      .map(([name, config]) => `"${name}": ${JSON.stringify(config, null, 2)}`)
      .join(',\n');
    setEditedConfig(formatted);
    setIsEditing(true);
  };

  const addServer = () => {
    setEditedConfig('');
    setIsEditing(true);
  };

  const saveConfig = async () => {
    try {
      const mcpServers = { ...agentContent.mcpServers };
      const trimmed = editedConfig.trim();
      const entries = trimmed.split(/,\n(?=")/);

      for (const entry of entries) {
        const match = entry.trim().match(/^"([^"]+)":\s*(\{[\s\S]*\})$/);
        if (match) {
          const [, name, configStr] = match;
          mcpServers[name] = JSON.parse(configStr);
        }
      }

      const success = await saveToGitHub(mcpServers, `feat: update config on ${selectedAgent}`);
      if (success) {
        setServers(Object.entries(mcpServers).map(([name, config]) => ({ name, ...config })));
        setIsEditing(false);
        setEditedConfig('');
      }
    } catch (e) {
      showNotification(`Erreur: ${e.message}`, 'error');
    }
  };

  const syncLocal = async () => {
    try {
      setLoading(true);
      
      const check = await api.checkSyncConflicts(selectedBranch);
      
      if (check.conflicts.length > 0) {
        const confirmed = confirm(
          `⚠️ ${check.conflicts.length} fichier(s) modifié(s) localement seront écrasés :\n\n` +
          check.conflicts.map(f => `  • ${f}`).join('\n') +
          `\n\nVoulez-vous continuer et écraser ces fichiers ?`
        );
        
        if (!confirmed) {
          showNotification('Sync annulé', 'error');
          return;
        }
      }
      
      const result = await api.syncLocal(selectedBranch);
      showNotification(`${result.synced} agent(s) synchronisé(s) vers ~/.kiro/agents/`);
    } catch (e) {
      showNotification(`Erreur sync: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            MCP Server Manager
          </h1>
          <p className="text-slate-300">Gérez vos serveurs MCP via GitHub</p>
        </header>

        {notification.show && (
          <div className={`mb-4 p-4 rounded-lg ${notification.type === 'success' ? 'bg-green-500/20 border border-green-500' : 'bg-red-500/20 border border-red-500'}`}>
            {notification.message}
          </div>
        )}

        {/* Branch + Agent selectors */}
        <div className="flex gap-4 mb-6">
          <div className="flex items-center gap-2">
            <GitBranch size={20} className="text-purple-400" />
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:border-purple-500 focus:outline-none"
            >
              {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Database size={20} className="text-purple-400" />
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:border-purple-500 focus:outline-none"
            >
              <option value="">-- Sélectionner un agent --</option>
              {agents.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
            </select>
          </div>
          <button onClick={loadAgent} disabled={!selectedAgent} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition disabled:opacity-50">
            <RefreshCw size={18} />
          </button>
          <button onClick={syncLocal} disabled={!isLocalBranch} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition flex items-center gap-2 disabled:opacity-50" title={isLocalBranch ? 'Sync vers ~/.kiro/agents/' : 'Sync disponible uniquement pour la branche locale'}>
            <Download size={18} /> Sync
          </button>
        </div>

        {/* Server list */}
        {selectedAgent && (
          <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Serveurs MCP — {selectedAgent} ({servers.length})</h2>
              <div className="flex gap-2">
                <button onClick={toggleAll} disabled={servers.length === 0} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition flex items-center gap-2 disabled:opacity-50">
                  <CheckSquare size={18} />
                  {servers.every(s => selectedServers.has(s.name)) ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
                <button onClick={() => toggleSelectionStatus(true)} disabled={selectedServers.size === 0} className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition flex items-center gap-2 disabled:opacity-50">
                  <Power size={18} /> Activer
                </button>
                <button onClick={() => toggleSelectionStatus(false)} disabled={selectedServers.size === 0} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition flex items-center gap-2 disabled:opacity-50">
                  <PowerOff size={18} /> Désactiver
                </button>
                <button disabled className="px-4 py-2 bg-green-600 rounded-lg transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" title="L'ajout se fait via l'agent Forge">
                  <Plus size={18} /> Ajouter
                </button>
              </div>
            </div>

            {loading ? (
              <p className="text-slate-400">Chargement...</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(getGroupedServers()).map(([category, categoryServers]) => (
                  <div key={category} className="border border-slate-600 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleCategory(category)}
                      className="w-full flex items-center justify-between px-4 py-2 bg-slate-700/80 hover:bg-slate-700 transition"
                    >
                      <span className="font-semibold">{category}</span>
                      <span className="text-slate-400">{collapsedCategories.has(category) ? '▶' : '▼'}</span>
                    </button>
                    {!collapsedCategories.has(category) && (
                      <div className="space-y-1 p-2">
                        {categoryServers.map(server => (
                          <div key={server.name} className="bg-slate-700/50 p-2 rounded border border-slate-600 hover:border-purple-500 transition">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <button onClick={() => {
                                  const s = new Set(selectedServers);
                                  s.has(server.name) ? s.delete(server.name) : s.add(server.name);
                                  setSelectedServers(s);
                                }}>
                                  {selectedServers.has(server.name) ? <CheckSquare size={18} className="text-purple-400" /> : <Square size={18} className="text-slate-500" />}
                                </button>
                                <h3 className="text-sm">{server.name}</h3>
                              </div>
                              <button
                                onClick={() => toggleServerStatus(server.name)}
                                className={`transition ml-2 ${server.disabled ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'}`}
                                title={server.disabled ? 'Activer' : 'Désactiver'}
                              >
                                {server.disabled ? <PowerOff size={16} /> : <Power size={16} />}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Edit section */}
            {selectedServers.size > 0 && !isEditing && (
              <button onClick={startEditing} className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition flex items-center gap-2">
                <Edit size={18} /> Éditer la sélection
              </button>
            )}

            {isEditing && (
              <div className="mt-4">
                <textarea
                  value={editedConfig}
                  onChange={(e) => setEditedConfig(e.target.value)}
                  className="w-full h-64 bg-slate-900 border border-slate-600 rounded-lg p-4 font-mono text-sm focus:border-purple-500 focus:outline-none"
                  placeholder='Collez la config JSON ici: "server-name": { "command": "...", "args": [...] }'
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={saveConfig} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition flex items-center gap-2">
                    <Save size={18} /> Sauvegarder & Commit
                  </button>
                  <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition">
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MCPManager;
