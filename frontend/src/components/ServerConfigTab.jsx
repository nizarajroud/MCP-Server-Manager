import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2 } from 'lucide-react';

const ServerConfigTab = ({ servers, agentContent, selectedAgent, agentSha, selectedBranch, showNotification, api }) => {
  const [selectedServer, setSelectedServer] = useState('');
  const [subTab, setSubTab] = useState('server');
  const [serverJson, setServerJson] = useState('');
  const [wrapperPath, setWrapperPath] = useState('');
  const [wrapperContent, setWrapperContent] = useState('');
  const [envVars, setEnvVars] = useState([]);
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (selectedServer && agentContent?.mcpServers?.[selectedServer]) {
      const config = agentContent.mcpServers[selectedServer];
      setServerJson(JSON.stringify(config, null, 2));
      setDescription(config.description || '');
      setEnvVars(Object.entries(config.env || {}).map(([key, value]) => ({ key, value })));
      
      // Detect wrapper from args
      const args = config.args || [];
      const wrapperArg = args.find(a => a.includes('wrapper'));
      setWrapperPath(wrapperArg || '');
      setWrapperContent('');
      
      if (wrapperArg) {
        loadWrapper(wrapperArg);
      }
    }
  }, [selectedServer, agentContent]);

  const loadWrapper = async (path) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/api/file?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const data = await res.json();
        setWrapperContent(data.content);
      }
    } catch (e) {}
  };

  const saveServerConfig = async () => {
    try {
      const parsed = JSON.parse(serverJson);
      const mcpServers = { ...agentContent.mcpServers, [selectedServer]: parsed };
      await api.saveAgent(selectedAgent, {
        content: { ...agentContent, mcpServers },
        sha: agentSha, branch: selectedBranch,
        message: `feat: update ${selectedServer} config on ${selectedAgent}`
      });
      showNotification('Configuration serveur sauvegardée');
    } catch (e) {
      showNotification(`Erreur: ${e.message}`, 'error');
    }
  };

  const saveEnvVars = async () => {
    try {
      const env = {};
      envVars.forEach(({ key, value }) => { if (key) env[key] = value; });
      const config = { ...agentContent.mcpServers[selectedServer], env };
      const mcpServers = { ...agentContent.mcpServers, [selectedServer]: config };
      await api.saveAgent(selectedAgent, {
        content: { ...agentContent, mcpServers },
        sha: agentSha, branch: selectedBranch,
        message: `feat: update ${selectedServer} env vars on ${selectedAgent}`
      });
      showNotification('Variables d\'environnement sauvegardées');
    } catch (e) {
      showNotification(`Erreur: ${e.message}`, 'error');
    }
  };

  const saveWrapper = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/api/file`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: wrapperPath, content: wrapperContent })
      });
      if (res.ok) showNotification('Wrapper sauvegardé');
      else showNotification('Erreur sauvegarde wrapper', 'error');
    } catch (e) {
      showNotification(`Erreur: ${e.message}`, 'error');
    }
  };

  const subTabs = [
    { id: 'server', label: 'Serveur' },
    { id: 'wrapper', label: 'Wrapper' },
    { id: 'env', label: 'Variables d\'env' }
  ];

  return (
    <div>
      <div className="mb-4">
        <select value={selectedServer} onChange={e => setSelectedServer(e.target.value)}
          className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:border-purple-500 focus:outline-none">
          <option value="">-- Sélectionner un serveur MCP --</option>
          {servers.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
        </select>
      </div>

      {selectedServer && (
        <>
          <div className="flex gap-1 border-b border-slate-700 mb-4">
            {subTabs.map(t => (
              <button key={t.id} onClick={() => setSubTab(t.id)}
                className={`px-4 py-2 border-b-2 transition ${subTab === t.id ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {subTab === 'server' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full h-20 px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:border-purple-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Configuration JSON</label>
                <textarea value={serverJson} onChange={e => setServerJson(e.target.value)} className="w-full h-64 px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg font-mono text-sm focus:border-purple-500 focus:outline-none" />
              </div>
              <button onClick={saveServerConfig} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition flex items-center gap-2">
                <Save size={18} /> Sauvegarder
              </button>
            </div>
          )}

          {subTab === 'wrapper' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Chemin du wrapper</label>
                <input value={wrapperPath} onChange={e => setWrapperPath(e.target.value)} className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:border-purple-500 focus:outline-none font-mono text-sm" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Contenu</label>
                <textarea value={wrapperContent} onChange={e => setWrapperContent(e.target.value)} className="w-full h-64 px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg font-mono text-sm focus:border-purple-500 focus:outline-none" />
              </div>
              <button onClick={saveWrapper} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition flex items-center gap-2">
                <Save size={18} /> Sauvegarder
              </button>
            </div>
          )}

          {subTab === 'env' && (
            <div className="space-y-4">
              <div className="space-y-2">
                {envVars.map((v, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input value={v.key} onChange={e => { const n = [...envVars]; n[i].key = e.target.value; setEnvVars(n); }}
                      className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg font-mono text-sm focus:border-purple-500 focus:outline-none" placeholder="KEY" />
                    <span className="text-slate-500">=</span>
                    <input value={v.value} onChange={e => { const n = [...envVars]; n[i].value = e.target.value; setEnvVars(n); }}
                      className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg font-mono text-sm focus:border-purple-500 focus:outline-none" placeholder="value" />
                    <button onClick={() => setEnvVars(envVars.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => setEnvVars([...envVars, { key: '', value: '' }])} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition flex items-center gap-2">
                <Plus size={18} /> Ajouter variable
              </button>
              <button onClick={saveEnvVars} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition flex items-center gap-2">
                <Save size={18} /> Sauvegarder
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ServerConfigTab;
