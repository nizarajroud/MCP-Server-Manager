import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';

const AgentConfigTab = ({ agents, selectedAgent, agentContent, agentSha, selectedBranch, saveToGitHub, showNotification, api }) => {
  const [subTab, setSubTab] = useState('general');
  const [form, setForm] = useState({ name: '', description: '', welcomeMessage: '' });
  const [promptContent, setPromptContent] = useState('');
  const [toolsList, setToolsList] = useState('');
  const [resourcesList, setResourcesList] = useState('');

  useEffect(() => {
    if (agentContent) {
      setForm({
        name: agentContent.name || '',
        description: agentContent.description || '',
        welcomeMessage: agentContent.welcomeMessage || ''
      });
      setPromptContent(agentContent.prompt || '');
      setToolsList((agentContent.tools || []).join('\n'));
      setResourcesList((agentContent.resources || []).join('\n'));
    }
  }, [agentContent]);

  const saveGeneral = async () => {
    try {
      const updated = { ...agentContent, name: form.name, description: form.description, welcomeMessage: form.welcomeMessage };
      const result = await api.saveAgent(selectedAgent, {
        content: updated, sha: agentSha, branch: selectedBranch,
        message: `feat: update ${selectedAgent} general config`
      });
      showNotification('Configuration générale sauvegardée');
    } catch (e) {
      showNotification(`Erreur: ${e.message}`, 'error');
    }
  };

  const savePrompt = async () => {
    try {
      const updated = { ...agentContent, prompt: promptContent };
      await api.saveAgent(selectedAgent, {
        content: updated, sha: agentSha, branch: selectedBranch,
        message: `feat: update ${selectedAgent} prompt`
      });
      showNotification('Prompt sauvegardé');
    } catch (e) {
      showNotification(`Erreur: ${e.message}`, 'error');
    }
  };

  const saveTools = async () => {
    try {
      const tools = toolsList.split('\n').map(t => t.trim()).filter(Boolean);
      const updated = { ...agentContent, tools };
      await api.saveAgent(selectedAgent, {
        content: updated, sha: agentSha, branch: selectedBranch,
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
        content: updated, sha: agentSha, branch: selectedBranch,
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
    { id: 'resources', label: 'Resources' }
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
          <label className="block text-sm text-slate-400 mb-1">System Prompt (ou chemin fichier)</label>
          <textarea value={promptContent} onChange={e => setPromptContent(e.target.value)} className="w-full h-64 px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg font-mono text-sm focus:border-purple-500 focus:outline-none" />
          <button onClick={savePrompt} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition flex items-center gap-2">
            <Save size={18} /> Sauvegarder
          </button>
        </div>
      )}

      {subTab === 'tools' && (
        <div className="space-y-4">
          <label className="block text-sm text-slate-400 mb-1">Tools autorisés (un par ligne)</label>
          <textarea value={toolsList} onChange={e => setToolsList(e.target.value)} className="w-full h-48 px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg font-mono text-sm focus:border-purple-500 focus:outline-none" />
          <button onClick={saveTools} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition flex items-center gap-2">
            <Save size={18} /> Sauvegarder
          </button>
        </div>
      )}

      {subTab === 'resources' && (
        <div className="space-y-4">
          <label className="block text-sm text-slate-400 mb-1">Resources (un pattern par ligne)</label>
          <textarea value={resourcesList} onChange={e => setResourcesList(e.target.value)} className="w-full h-48 px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg font-mono text-sm focus:border-purple-500 focus:outline-none" />
          <button onClick={saveResources} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition flex items-center gap-2">
            <Save size={18} /> Sauvegarder
          </button>
        </div>
      )}
    </div>
  );
};

export default AgentConfigTab;
