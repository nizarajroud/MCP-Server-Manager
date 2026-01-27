import React, { useState, useEffect } from 'react';
import { Database, Download, Upload, Globe, Settings, CheckSquare, Square, Trash2, Plus, Save, FolderOpen } from 'lucide-react';
import '../utils/storage';

const MCPManager = () => {
  const [servers, setServers] = useState([]);
  const [selectedServers, setSelectedServers] = useState(new Set());
  const [outputPath, setOutputPath] = useState('~/claude_desktop_config.json');
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [importJson, setImportJson] = useState('');
  const [activeTab, setActiveTab] = useState('manage');
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [agentFilter, setAgentFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      const keys = await window.storage.list('mcp_server:');
      if (keys && keys.keys) {
        const serverData = await Promise.all(
          keys.keys.map(async (key) => {
            try {
              const result = await window.storage.get(key);
              return result ? { id: key, ...JSON.parse(result.value) } : null;
            } catch (e) {
              return null;
            }
          })
        );
        setServers(serverData.filter(s => s !== null));
      }
    } catch (error) {
      console.log('No servers found yet');
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 3000);
  };

  const toggleServer = (serverId) => {
    const newSelected = new Set(selectedServers);
    if (newSelected.has(serverId)) {
      newSelected.delete(serverId);
    } else {
      newSelected.add(serverId);
    }
    setSelectedServers(newSelected);
  };

  const toggleAll = () => {
    const filteredServers = servers.filter(s => (agentFilter === 'all' || s.agent === agentFilter) && (searchQuery === '' || s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.command.toLowerCase().includes(searchQuery.toLowerCase())));
    if (selectedServers.size === filteredServers.length && filteredServers.every(s => selectedServers.has(s.id))) {
      filteredServers.forEach(s => selectedServers.delete(s.id));
      setSelectedServers(new Set(selectedServers));
    } else {
      const newSelected = new Set(selectedServers);
      filteredServers.forEach(s => newSelected.add(s.id));
      setSelectedServers(newSelected);
    }
  };

  const generateConfig = () => {
    const mcpServers = {};
    servers.forEach(server => {
      if (selectedServers.has(server.id)) {
        mcpServers[server.name] = {
          command: server.command,
          args: server.args || [],
          env: server.env || {}
        };
      }
    });

    return {
      mcpServers
    };
  };

  const downloadConfig = () => {
    const config = generateConfig();
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'claude_desktop_config.json';
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Configuration téléchargée avec succès!');
  };

  const importFromJson = async (jsonContent) => {
    try {
      const content = jsonContent || importJson;
      console.log('Starting import...', new Date().toISOString());
      const parsed = JSON.parse(content);
      console.log('Parsed JSON:', parsed);
      const mcpServers = parsed.mcpServers || parsed;
      const agentName = parsed.name || `Agent-${Date.now()}`;
      console.log('MCP Servers:', mcpServers);
      
      if (!mcpServers || typeof mcpServers !== 'object') {
        showNotification('Aucun serveur MCP trouvé dans le JSON', 'error');
        return;
      }

      const entries = Object.entries(mcpServers);
      if (entries.length === 0) {
        showNotification('Aucun serveur MCP est configuré sur cet agent.', 'error');
        return;
      }
      
      let imported = 0;
      for (const [name, config] of entries) {
        if (config.command) {
          const serverId = `mcp_server:${Date.now()}_${name}`;
          const serverData = {
            name,
            command: config.command,
            args: config.args || [],
            env: config.env || {},
            agent: agentName
          };
          await window.storage.set(serverId, JSON.stringify(serverData));
          imported++;
        }
      }
      await loadServers();
      setImportJson('');
      showNotification(`${imported} serveur(s) importé(s) avec succès!`);
    } catch (error) {
      console.error('Import error:', error);
      showNotification(`Erreur: ${error.message}`, 'error');
    }
  };

  const scrapeServers = async () => {
    if (!scrapeUrl) {
      showNotification('Veuillez entrer une URL', 'error');
      return;
    }

    try {
      const response = await fetch(scrapeUrl);
      const text = await response.text();
      
      const jsonMatches = text.match(/\{[\s\S]*?"mcpServers"[\s\S]*?\}/g);
      
      if (jsonMatches && jsonMatches.length > 0) {
        let totalImported = 0;
        const agentName = `Scraped-${new URL(scrapeUrl).hostname}`;
        for (const jsonStr of jsonMatches) {
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.mcpServers) {
              for (const [name, config] of Object.entries(parsed.mcpServers)) {
                const serverId = `mcp_server:${Date.now()}_${Math.random()}_${name}`;
                const serverData = {
                  name,
                  command: config.command,
                  args: config.args || [],
                  env: config.env || {},
                  source: scrapeUrl,
                  agent: agentName
                };
                await window.storage.set(serverId, JSON.stringify(serverData));
                totalImported++;
              }
            }
          } catch (e) {
            console.log('Skipping invalid JSON block');
          }
        }
        await loadServers();
        setScrapeUrl('');
        showNotification(`${totalImported} serveur(s) scrapé(s) avec succès!`);
      } else {
        showNotification('Aucun serveur MCP trouvé sur cette page', 'error');
      }
    } catch (error) {
      showNotification(`Erreur de scraping: ${error.message}`, 'error');
    }
  };

  const deleteServer = async (serverId) => {
    try {
      await window.storage.delete(serverId);
      await loadServers();
      selectedServers.delete(serverId);
      setSelectedServers(new Set(selectedServers));
      showNotification('Serveur supprimé avec succès!');
    } catch (error) {
      showNotification('Erreur lors de la suppression', 'error');
    }
  };

  const addManualServer = async () => {
    const name = prompt('Nom du serveur:');
    if (!name) return;
    
    const command = prompt('Commande (ex: node, npx, python):');
    if (!command) return;
    
    const argsStr = prompt('Arguments (séparés par des virgules):');
    const args = argsStr ? argsStr.split(',').map(a => a.trim()) : [];
    
    const serverId = `mcp_server:${Date.now()}_${name}`;
    const serverData = { name, command, args, env: {} };
    
    try {
      await window.storage.set(serverId, JSON.stringify(serverData));
      await loadServers();
      showNotification('Serveur ajouté avec succès!');
    } catch (error) {
      showNotification('Erreur lors de l\'ajout', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            MCP Server Manager
          </h1>
          <p className="text-slate-300">Gérez vos serveurs Model Context Protocol</p>
        </header>

        {notification.show && (
          <div className={`mb-4 p-4 rounded-lg ${notification.type === 'success' ? 'bg-green-500/20 border border-green-500' : 'bg-red-500/20 border border-red-500'}`}>
            {notification.message}
          </div>
        )}

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-6 py-3 rounded-lg flex items-center gap-2 transition ${activeTab === 'manage' ? 'bg-purple-600' : 'bg-slate-700 hover:bg-slate-600'}`}
          >
            <Database size={20} />
            Gérer
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`px-6 py-3 rounded-lg flex items-center gap-2 transition ${activeTab === 'import' ? 'bg-purple-600' : 'bg-slate-700 hover:bg-slate-600'}`}
          >
            <Upload size={20} />
            Importer
          </button>
          <button
            onClick={() => setActiveTab('scrape')}
            className={`px-6 py-3 rounded-lg flex items-center gap-2 transition ${activeTab === 'scrape' ? 'bg-purple-600' : 'bg-slate-700 hover:bg-slate-600'}`}
          >
            <Globe size={20} />
            Scraper
          </button>
        </div>

        {activeTab === 'manage' && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-slate-700">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold">Serveurs MCP ({servers.filter(s => (agentFilter === 'all' || s.agent === agentFilter) && (searchQuery === '' || s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.command.toLowerCase().includes(searchQuery.toLowerCase()))).length})</h2>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher..."
                    className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:border-purple-500 focus:outline-none text-sm"
                  />
                  <select
                    value={agentFilter}
                    onChange={(e) => setAgentFilter(e.target.value)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition border border-slate-600 focus:border-purple-500 focus:outline-none"
                  >
                    <option value="all">Tous les agents</option>
                    {[...new Set(servers.map(s => s.agent).filter(Boolean))].map(agent => (
                      <option key={agent} value={agent}>{agent}</option>
                    ))}
                  </select>
                  <button
                    onClick={toggleAll}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition flex items-center gap-2"
                  >
                    <CheckSquare size={18} />
                    {selectedServers.size === servers.filter(s => (agentFilter === 'all' || s.agent === agentFilter) && (searchQuery === '' || s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.command.toLowerCase().includes(searchQuery.toLowerCase()))).length && servers.filter(s => (agentFilter === 'all' || s.agent === agentFilter) && (searchQuery === '' || s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.command.toLowerCase().includes(searchQuery.toLowerCase()))).every(s => selectedServers.has(s.id)) ? 'Tout désélectionner' : 'Tout sélectionner'}
                  </button>
                  <button
                    onClick={async () => {
                      if (selectedServers.size === 0) return;
                      if (!confirm(`Voulez-vous vraiment supprimer ${selectedServers.size} serveur(s) ?`)) return;
                      for (const serverId of selectedServers) {
                        await window.storage.delete(serverId);
                      }
                      setSelectedServers(new Set());
                      await loadServers();
                      showNotification(`${selectedServers.size} serveur(s) supprimé(s)!`);
                    }}
                    disabled={selectedServers.size === 0}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={18} />
                    Supprimer sélection
                  </button>
                  <button
                    onClick={addManualServer}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition flex items-center gap-2"
                  >
                    <Plus size={18} />
                    Ajouter
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {servers.filter(s => (agentFilter === 'all' || s.agent === agentFilter) && (searchQuery === '' || s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.command.toLowerCase().includes(searchQuery.toLowerCase()))).length === 0 ? (
                  <p className="text-slate-400 text-center py-8">Aucun serveur configuré. Importez ou ajoutez-en un!</p>
                ) : (
                  servers.filter(s => (agentFilter === 'all' || s.agent === agentFilter) && (searchQuery === '' || s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.command.toLowerCase().includes(searchQuery.toLowerCase()))).map(server => (
                    <div
                      key={server.id}
                      className="bg-slate-700/50 p-4 rounded-lg border border-slate-600 hover:border-purple-500 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <button
                            onClick={() => toggleServer(server.id)}
                            className="mt-1"
                          >
                            {selectedServers.has(server.id) ? (
                              <CheckSquare size={24} className="text-purple-400" />
                            ) : (
                              <Square size={24} className="text-slate-500" />
                            )}
                          </button>
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{server.name}</h3>
                            <p className="text-slate-300 text-sm mt-1">
                              <span className="text-purple-400">Commande:</span> {server.command}
                            </p>
                            {server.args && server.args.length > 0 && (
                              <p className="text-slate-300 text-sm">
                                <span className="text-purple-400">Args:</span> {server.args.join(', ')}
                              </p>
                            )}
                            {server.agent && (
                              <p className="text-slate-400 text-xs mt-1">Agent: {server.agent}</p>
                            )}
                            {server.source && (
                              <p className="text-slate-400 text-xs mt-1">Source: {server.source}</p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => deleteServer(server.id)}
                          className="text-red-400 hover:text-red-300 transition ml-2"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-slate-700">
              <h2 className="text-2xl font-semibold mb-4">Configuration de sortie</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Chemin de sortie</label>
                  <input
                    type="text"
                    value={outputPath}
                    onChange={(e) => setOutputPath(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:border-purple-500 focus:outline-none"
                    placeholder="~/claude_desktop_config.json"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={downloadConfig}
                    disabled={selectedServers.size === 0}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  >
                    <Download size={20} />
                    Télécharger la configuration ({selectedServers.size} serveurs)
                  </button>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-lg">
                  <p className="text-xs text-slate-400 mb-2">Aperçu de la configuration:</p>
                  <pre className="text-xs text-slate-300 overflow-x-auto">
                    {JSON.stringify(generateConfig(), null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'import' && (
          <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-slate-700">
            <h2 className="text-2xl font-semibold mb-4">Importer depuis JSON</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Sélectionner un fichier JSON</label>
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setImportJson(event.target.result);
                        importFromJson(event.target.result);
                      };
                      reader.readAsText(file);
                    }
                  }}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 focus:border-purple-500 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-600 file:text-white hover:file:bg-purple-500 file:cursor-pointer"
                />
              </div>
              <div className="bg-slate-900/50 p-4 rounded-lg">
                <p className="text-sm text-slate-300">
                  <strong>Formats acceptés:</strong>
                </p>
                <ul className="text-xs text-slate-400 mt-2 space-y-1 list-disc list-inside">
                  <li>Configuration complète avec mcpServers</li>
                  <li>Objet mcpServers uniquement</li>
                  <li>Fichiers Q CLI agent avec mcpServers</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'scrape' && (
          <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-slate-700">
            <h2 className="text-2xl font-semibold mb-4">Scraper depuis une URL</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">URL de la page contenant des configurations MCP</label>
                <input
                  type="url"
                  value={scrapeUrl}
                  onChange={(e) => setScrapeUrl(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:border-purple-500 focus:outline-none"
                  placeholder="https://example.com/mcp-configs"
                />
              </div>
              <button
                onClick={scrapeServers}
                disabled={!scrapeUrl.trim()}
                className="w-full px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                <Globe size={20} />
                Scraper la page
              </button>
              <div className="bg-slate-900/50 p-4 rounded-lg">
                <p className="text-sm text-slate-300">
                  <strong>Note:</strong> L'outil va chercher tous les blocs JSON contenant "mcpServers" dans la page et les importer automatiquement dans votre base de données.
                </p>
              </div>
            </div>
          </div>
        )}

        <footer className="mt-8 text-center text-slate-400 text-sm">
          <p>Les données sont stockées localement avec window.storage</p>
          <p className="mt-1">Pour utiliser avec Claude Desktop, téléchargez la config et copiez-la dans le bon emplacement</p>
        </footer>
      </div>
    </div>
  );
};

export default MCPManager;