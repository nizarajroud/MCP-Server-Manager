import React, { useState, useEffect } from 'react';
import { Database, Download, GitBranch, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import HomeTab from './HomeTab';
import AgentConfigTab from './AgentConfigTab';
import ServerConfigTab from './ServerConfigTab';
import BacklogTab from './BacklogTab';
import SettingsTab from './SettingsTab';

const MCPManager = () => {
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [servers, setServers] = useState([]);
  const [agentContent, setAgentContent] = useState(null);
  const [agentSha, setAgentSha] = useState('');
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [loading, setLoading] = useState(false);
  const [localBranch, setLocalBranch] = useState('');
  const [defaultAgent, setDefaultAgent] = useState('');
  const [categories, setCategories] = useState({});
  const [mainTab, setMainTab] = useState('home');
  const [version, setVersion] = useState('');
  const [registry, setRegistry] = useState({});
  const [health, setHealth] = useState({});
  const [resources, setResources] = useState({});

  useEffect(() => { loadConfig(); }, []);
  useEffect(() => { if (localBranch) loadBranches(); }, [localBranch]);
  useEffect(() => { if (selectedBranch) { loadAgents(); loadCategories(); loadRegistry(); } }, [selectedBranch, defaultAgent]);
  useEffect(() => { if (selectedAgent) loadAgent(); }, [selectedAgent]);
  useEffect(() => {
    if (!selectedBranch) return;
    loadHealth();
    loadResources();
    const interval = setInterval(() => { loadHealth(); loadResources(); }, 30000);
    return () => clearInterval(interval);
  }, [selectedBranch]);

  const isLocalBranch = selectedBranch === localBranch;

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 3000);
  };

  const loadConfig = async () => {
    try {
      const config = await api.getConfig();
      setLocalBranch(config.localBranch);
      setDefaultAgent(config.defaultAgent);
      setVersion(config.version);
    } catch (e) {}
  };

  const loadCategories = async () => {
    try {
      const cats = await api.getCategories(selectedBranch);
      setCategories(cats);
    } catch (e) {}
  };

  const loadRegistry = async () => {
    try { setRegistry(await api.getServersRegistry(selectedBranch)); } catch (e) {}
  };

  const loadHealth = async () => {
    try { setHealth(await api.getHealth(selectedBranch)); } catch (e) {}
  };

  const loadResources = async () => {
    try { setResources(await api.getResources()); } catch (e) {}
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
      setServers(Object.entries(mcpServers).map(([name, config]) => ({ name, ...config })));
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
        content: updatedContent, branch: selectedBranch, message
      });
      setAgentSha(result.sha);
      setAgentContent(updatedContent);
      showNotification(`Sauvegardé, commité et synchronisé ✓`);
      return true;
    } catch (e) {
      showNotification(`Erreur: ${e.message}`, 'error');
      return false;
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
          `\n\nVoulez-vous continuer ?`
        );
        if (!confirmed) { showNotification('Sync annulé', 'error'); return; }
      }
      const result = await api.syncLocal(selectedBranch);
      showNotification(`${result.synced} agent(s) synchronisé(s) vers ~/.kiro/agents/`);
    } catch (e) {
      showNotification(`Erreur sync: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const mainTabs = [
    { id: 'home', label: 'Home' },
    { id: 'agents', label: 'Configuration des agents' },
    { id: 'servers', label: 'Configuration serveur MCP' },
    { id: 'settings', label: 'Paramètres' },
    { id: 'backlog', label: 'Backlog de mise à jour' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            MCP Server Manager {version && <span className="text-lg text-slate-400 font-normal">({version})</span>}
          </h1>
        </header>

        {notification.show && (
          <div className={`mb-4 p-4 rounded-lg ${notification.type === 'success' ? 'bg-green-500/20 border border-green-500' : 'bg-red-500/20 border border-red-500'}`}>
            {notification.message}
          </div>
        )}

        {/* Branch selector + Sync */}
        <div className="flex gap-4 mb-4">
          <div className="flex items-center gap-2">
            <GitBranch size={20} className="text-purple-400" />
            <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
              className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:border-purple-500 focus:outline-none">
              {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Database size={20} className="text-purple-400" />
            <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)}
              className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:border-purple-500 focus:outline-none">
              <option value="">-- Agent --</option>
              {agents.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
            </select>
          </div>
          <button onClick={loadAgent} disabled={!selectedAgent} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition disabled:opacity-50">
            <RefreshCw size={18} />
          </button>
          <button onClick={syncLocal} disabled={!isLocalBranch} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition flex items-center gap-2 disabled:opacity-50"
            title={isLocalBranch ? 'Sync vers ~/.kiro/agents/' : 'Sync uniquement pour la branche locale'}>
            <Download size={18} /> Sync
          </button>
        </div>

        {/* Main tabs */}
        <div className="flex gap-1 border-b border-slate-700 mb-6">
          {mainTabs.map(t => (
            <button key={t.id} onClick={() => setMainTab(t.id)}
              className={`px-6 py-3 border-b-2 transition ${mainTab === t.id ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-slate-700">
          {loading && <p className="text-slate-400">Chargement...</p>}

          {!loading && mainTab === 'home' && selectedAgent && (
            <HomeTab
              servers={servers}
              categories={categories}
              setCategories={setCategories}
              registry={registry}
              health={health}
              agentContent={agentContent}
              selectedAgent={selectedAgent}
              selectedBranch={selectedBranch}
              agents={agents}
              saveToGitHub={saveToGitHub}
              setServers={setServers}
              showNotification={showNotification}
              reloadAgent={loadAgent}
            />
          )}

          {!loading && mainTab === 'agents' && (
            <AgentConfigTab
              agents={agents}
              selectedAgent={selectedAgent}
              agentContent={agentContent}
              agentSha={agentSha}
              selectedBranch={selectedBranch}
              categories={categories}
              setCategories={setCategories}
              registry={registry}
              health={health}
              resources={resources}
              saveToGitHub={saveToGitHub}
              showNotification={showNotification}
              reloadAgent={loadAgent}
              reloadRegistry={loadRegistry}
              setRegistry={setRegistry}
              reloadHealth={loadHealth}
              api={api}
            />
          )}

          {!loading && mainTab === 'servers' && (
            <ServerConfigTab
              servers={servers}
              agentContent={agentContent}
              selectedAgent={selectedAgent}
              agentSha={agentSha}
              selectedBranch={selectedBranch}
              registry={registry}
              health={health}
              showNotification={showNotification}
              api={api}
            />
          )}

          {!loading && mainTab === 'backlog' && (
            <BacklogTab showNotification={showNotification} />
          )}

          {!loading && mainTab === 'settings' && (
            <SettingsTab
              categories={categories}
              setCategories={setCategories}
              selectedBranch={selectedBranch}
              showNotification={showNotification}
            />
          )}

          {!loading && !selectedAgent && !['backlog', 'settings'].includes(mainTab) && (
            <p className="text-slate-400">Sélectionnez un agent pour commencer.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MCPManager;
