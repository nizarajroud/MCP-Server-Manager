import React, { useState, useEffect } from 'react';
import { Save, Upload, RotateCcw } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const AgentConfigTab = ({ agents, selectedAgent, agentContent, agentSha, selectedBranch, registry, health, saveToGitHub, showNotification, reloadAgent, api }) => {
  const [subTab, setSubTab] = useState('general');
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

      {subTab === 'deploy' && (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600 text-slate-400">
                  <th className="text-left py-2 px-3">Serveur</th>
                  <th className="text-left py-2 px-3">Cible</th>
                  <th className="text-left py-2 px-3">Port</th>
                  <th className="text-left py-2 px-3">Santé</th>
                  <th className="text-left py-2 px-3">Mode actuel</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(agentContent.mcpServers || {}).map(name => {
                  const reg = registry[name];
                  const cfg = agentContent.mcpServers[name];
                  const isRemote = cfg.args && cfg.args.includes('mcp-remote');
                  return (
                    <tr key={name} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="py-2 px-3">{name}</td>
                      <td className="py-2 px-3">
                        {reg ? (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${reg.target === 'envy' ? 'bg-slate-600 text-slate-300' : 'bg-purple-900/50 text-purple-300'}`}>
                            {reg.target === 'envy' ? '🏠 local' : `💻 ${reg.target}`}
                          </span>
                        ) : <span className="text-slate-500">—</span>}
                      </td>
                      <td className="py-2 px-3 text-slate-400">{reg?.port || '—'}</td>
                      <td className="py-2 px-3">
                        {health[name] ? (
                          <span className={`w-2 h-2 inline-block rounded-full ${health[name] === 'up' ? 'bg-green-400' : 'bg-red-400'}`} />
                        ) : '—'}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${isRemote ? 'bg-blue-900/50 text-blue-300' : 'bg-slate-600 text-slate-300'}`}>
                          {isRemote ? '🌐 remote' : '📦 local'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={async () => {
              try {
                const result = await api.applyRemoteConfig(selectedAgent, selectedBranch);
                showNotification(`Config remote appliquée (${result.changed} serveurs) ✓`);
                reloadAgent();
              } catch (e) { showNotification(`Erreur: ${e.message}`, 'error'); }
            }} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition flex items-center gap-2">
              <Upload size={18} /> Appliquer config remote
            </button>
            <button onClick={async () => {
              try {
                const result = await api.restoreLocalConfig(selectedAgent, selectedBranch);
                showNotification(`Config locale restaurée (${result.changed} serveurs) ✓`);
                reloadAgent();
              } catch (e) { showNotification(`Erreur: ${e.message}`, 'error'); }
            }} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition flex items-center gap-2">
              <RotateCcw size={18} /> Restaurer config locale
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentConfigTab;
