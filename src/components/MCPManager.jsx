import React, { useState, useEffect } from 'react';
import { Database, Download, Upload, Globe, Settings, CheckSquare, Square, Trash2, Plus, Save, FolderOpen, Edit, Power, PowerOff } from 'lucide-react';
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
  const [isEditing, setIsEditing] = useState(false);
  const [editedConfig, setEditedConfig] = useState('');
  const [agentFilePath, setAgentFilePath] = useState('');

  useEffect(() => {
    loadServers();
  }, []);

  useEffect(() => {
    if (selectedServers.size === 0) {
      setAgentFilePath('');
    } else {
      const selectedServerIds = Array.from(selectedServers);
      const firstSelectedServer = servers.find(s => s.id === selectedServerIds[0]);
      if (firstSelectedServer && firstSelectedServer.agentPath) {
        setAgentFilePath(firstSelectedServer.agentPath);
      }
    }
  }, [selectedServers, servers]);

  useEffect(() => {
    // Réinitialiser la sélection quand on change d'agent
    setSelectedServers(new Set());
  }, [agentFilter]);

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

  const migrateAgentPaths = async () => {
    try {
      const keys = await window.storage.list('mcp_server:');
      
      if (!keys || !keys.keys) {
        showNotification('Aucun serveur trouvé', 'error');
        return;
      }
      
      let updated = 0;
      
      for (const key of keys.keys) {
        const result = await window.storage.get(key);
        if (result) {
          const server = JSON.parse(result.value);
          
          // Si le serveur n'a pas d'agentPath, l'ajouter
          if (!server.agentPath && server.agent) {
            server.agentPath = `/home/nizar/.kiro/agents/${server.agent}.json`;
            await window.storage.set(key, JSON.stringify(server));
            updated++;
          }
        }
      }
      
      await loadServers();
      showNotification(`${updated} serveur(s) mis à jour avec agentPath`);
    } catch (error) {
      showNotification(`Erreur: ${error.message}`, 'error');
    }
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
    const filteredServers = servers.filter(s => 
      (agentFilter === 'all' || s.agent === agentFilter) && 
      (searchQuery === '' || s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.command.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    
    const allSelected = filteredServers.length > 0 && filteredServers.every(s => selectedServers.has(s.id));
    
    if (allSelected) {
      // Tout désélectionner
      const newSelected = new Set(selectedServers);
      filteredServers.forEach(s => newSelected.delete(s.id));
      setSelectedServers(newSelected);
    } else {
      // Tout sélectionner
      const newSelected = new Set(selectedServers);
      filteredServers.forEach(s => newSelected.add(s.id));
      setSelectedServers(newSelected);
    }
  };

  const generateConfig = () => {
    const mcpServers = {};
    servers.forEach(server => {
      if (selectedServers.has(server.id)) {
        const config = {
          command: server.command,
          args: server.args || [],
          env: server.env || {}
        };
        
        // Ajouter les champs optionnels s'ils existent
        if (server.autoApprove !== undefined) config.autoApprove = server.autoApprove;
        if (server.disabled !== undefined) config.disabled = server.disabled;
        if (server.timeout !== undefined) config.timeout = server.timeout;
        if (server.transport !== undefined) config.transport = server.transport;
        
        mcpServers[server.name] = config;
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

  const saveConfig = async () => {
    try {
      const mcpServers = {};
      const trimmed = editedConfig.trim();
      
      console.log('=== SAVE CONFIG START ===');
      console.log('Edited config:', trimmed);
      
      // Parse multiple server entries separated by commas
      const serverEntries = trimmed.split(/,\n(?=")/);
      
      for (const entry of serverEntries) {
        const match = entry.trim().match(/^"([^"]+)":\s*(\{[\s\S]*\})$/);
        if (match) {
          const [, name, configStr] = match;
          mcpServers[name] = JSON.parse(configStr);
        }
      }
      
      console.log('Parsed mcpServers:', mcpServers);
      console.log('All servers:', servers);
      
      if (Object.keys(mcpServers).length === 0) {
        throw new Error('Aucun serveur valide trouvé');
      }
      
      // Mettre à jour le storage local
      const selectedServerIds = Array.from(selectedServers);
      console.log('Selected server IDs:', selectedServerIds);
      
      for (const serverId of selectedServerIds) {
        const server = servers.find(s => s.id === serverId);
        console.log('Processing server:', server);
        if (server && mcpServers[server.name]) {
          const editedConfig = mcpServers[server.name];
          const updatedServer = {
            ...server,
            command: editedConfig.command,
            args: editedConfig.args || [],
            env: editedConfig.env || {}
          };
          
          // Mettre à jour les champs optionnels
          if (editedConfig.autoApprove !== undefined) updatedServer.autoApprove = editedConfig.autoApprove;
          if (editedConfig.disabled !== undefined) updatedServer.disabled = editedConfig.disabled;
          if (editedConfig.timeout !== undefined) updatedServer.timeout = editedConfig.timeout;
          if (editedConfig.transport !== undefined) updatedServer.transport = editedConfig.transport;
          
          await window.storage.set(serverId, JSON.stringify(updatedServer));
        }
      }
      
      // Sauvegarder dans le fichier agent
      // Déterminer l'agent à partir des serveurs édités
      const editedServerNames = Object.keys(mcpServers);
      console.log('Edited server names:', editedServerNames);
      const editedServers = servers.filter(s => editedServerNames.includes(s.name));
      console.log('Edited servers:', editedServers);
      
      if (editedServers.length > 0 && editedServers[0].agentPath) {
        const agentPath = editedServers[0].agentPath;
        console.log('Saving to agent file:', agentPath);
        const agentName = agentPath.split('/').pop().replace('.json', '');
        console.log('Agent name:', agentName);
        
        // Récupérer TOUS les serveurs de cet agent
        const agentServers = servers.filter(s => s.agentPath === agentPath);
        console.log('Agent servers found:', agentServers.length);
        const allMcpServers = {};
        
        for (const server of agentServers) {
          // Utiliser la config éditée si disponible, sinon la config existante
          if (mcpServers[server.name]) {
            allMcpServers[server.name] = mcpServers[server.name];
          } else {
            const config = {
              command: server.command,
              args: server.args || [],
              env: server.env || {}
            };
            
            // Préserver les champs optionnels
            if (server.autoApprove !== undefined) config.autoApprove = server.autoApprove;
            if (server.disabled !== undefined) config.disabled = server.disabled;
            if (server.timeout !== undefined) config.timeout = server.timeout;
            if (server.transport !== undefined) config.transport = server.transport;
            
            allMcpServers[server.name] = config;
          }
        }
        
        console.log('Sending to backend:', { agentName, mcpServers: allMcpServers });
        
        const response = await fetch('http://localhost:3001/api/save-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentName,
            mcpServers: allMcpServers
          })
        });
        
        console.log('Backend response status:', response.status);
        
        if (!response.ok) {
          const error = await response.json();
          console.error('Backend error:', error);
          throw new Error(error.error || 'Erreur lors de la sauvegarde du fichier');
        }
        
        const result = await response.json();
        console.log('Backend result:', result);
      } else {
        console.log('No agent path found for edited servers');
        console.log('editedServers[0]:', editedServers[0]);
      }
      
      await loadServers();
      setIsEditing(false);
      showNotification('Configuration sauvegardée avec succès!');
    } catch (error) {
      console.error('Save error:', error);
      showNotification(`Erreur: ${error.message}`, 'error');
    }
  };

  const startEditing = () => {
    const mcpServers = generateConfig().mcpServers;
    const entries = Object.entries(mcpServers);
    const formatted = entries.map(([name, config]) => 
      `"${name}": ${JSON.stringify(config, null, 2)}`
    ).join(',\n');
    setEditedConfig(formatted);
    setIsEditing(true);
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
      
      // Utiliser le chemin fourni ou générer un chemin par défaut
      const finalAgentPath = agentFilePath || `/home/nizar/.kiro/agents/${agentName}.json`;
      
      let imported = 0;
      for (const [name, config] of entries) {
        if (config.command) {
          // Chercher un serveur existant avec le même nom et agent
          const existingServer = servers.find(s => s.name === name && s.agent === agentName);
          const serverId = existingServer ? existingServer.id : `mcp_server:${Date.now()}_${name}`;
          
          const serverData = {
            name,
            command: config.command,
            args: config.args || [],
            env: config.env || {},
            agent: agentName,
            agentPath: finalAgentPath
          };
          
          // Préserver tous les champs optionnels
          if (config.autoApprove !== undefined) serverData.autoApprove = config.autoApprove;
          if (config.disabled !== undefined) serverData.disabled = config.disabled;
          if (config.timeout !== undefined) serverData.timeout = config.timeout;
          if (config.transport !== undefined) serverData.transport = config.transport;
          
          await window.storage.set(serverId, JSON.stringify(serverData));
          imported++;
        }
      }
      await loadServers();
      setImportJson('');
      setAgentFilePath('');
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

  const toggleServerStatus = async (serverId) => {
    try {
      const server = servers.find(s => s.id === serverId);
      if (!server) return;
      
      // Toggle disabled: si absent ou false, mettre à true; si true, mettre à false
      const newDisabledStatus = server.disabled !== true;
      
      const updatedServer = {
        ...server,
        disabled: newDisabledStatus
      };
      
      await window.storage.set(serverId, JSON.stringify(updatedServer));
      
      // Sauvegarder dans le fichier agent si disponible
      if (server.agentPath) {
        const agentName = server.agentPath.split('/').pop().replace('.json', '');
        const agentServers = servers.filter(s => s.agentPath === server.agentPath);
        const allMcpServers = {};
        
        for (const s of agentServers) {
          const config = {
            command: s.command,
            args: s.args || [],
            env: s.env || {}
          };
          
          // Appliquer le nouveau statut pour le serveur concerné
          const isDisabled = s.id === serverId ? newDisabledStatus : (s.disabled || false);
          if (isDisabled !== undefined) config.disabled = isDisabled;
          if (s.autoApprove !== undefined) config.autoApprove = s.autoApprove;
          if (s.timeout !== undefined) config.timeout = s.timeout;
          if (s.transport !== undefined) config.transport = s.transport;
          
          allMcpServers[s.name] = config;
        }
        
        await fetch('http://localhost:3001/api/save-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentName,
            mcpServers: allMcpServers
          })
        });
      }
      
      await loadServers();
      showNotification(`Serveur ${newDisabledStatus ? 'désactivé' : 'activé'} avec succès!`);
    } catch (error) {
      showNotification('Erreur lors du changement de statut', 'error');
    }
  };

  const toggleSelectionStatus = async (enable) => {
    try {
      if (selectedServers.size === 0 || agentFilter === 'all') return;
      
      const selectedServersList = servers.filter(s => selectedServers.has(s.id));
      const agentPath = selectedServersList[0]?.agentPath;
      
      if (!agentPath) {
        showNotification('Aucun chemin agent trouvé', 'error');
        return;
      }
      
      // Mettre à jour chaque serveur sélectionné
      for (const server of selectedServersList) {
        const updatedServer = {
          ...server,
          disabled: !enable
        };
        await window.storage.set(server.id, JSON.stringify(updatedServer));
      }
      
      // Sauvegarder dans le fichier agent
      const agentName = agentPath.split('/').pop().replace('.json', '');
      const agentServers = servers.filter(s => s.agentPath === agentPath);
      const allMcpServers = {};
      
      for (const s of agentServers) {
        const config = {
          command: s.command,
          args: s.args || [],
          env: s.env || {}
        };
        
        // Appliquer le nouveau statut pour les serveurs sélectionnés
        const isSelected = selectedServers.has(s.id);
        const isDisabled = isSelected ? !enable : (s.disabled || false);
        if (isDisabled !== undefined) config.disabled = isDisabled;
        if (s.autoApprove !== undefined) config.autoApprove = s.autoApprove;
        if (s.timeout !== undefined) config.timeout = s.timeout;
        if (s.transport !== undefined) config.transport = s.transport;
        
        allMcpServers[s.name] = config;
      }
      
      await fetch('http://localhost:3001/api/save-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName,
          mcpServers: allMcpServers
        })
      });
      
      await loadServers();
      showNotification(`${selectedServers.size} serveur(s) ${enable ? 'activé(s)' : 'désactivé(s)'} avec succès!`);
    } catch (error) {
      showNotification('Erreur lors du changement de statut', 'error');
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

        <div className="flex gap-2 mb-2">
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
          <button
            onClick={migrateAgentPaths}
            className="px-6 py-3 rounded-lg flex items-center gap-2 transition bg-yellow-600 hover:bg-yellow-700 ml-auto"
            title="Mettre à jour les serveurs existants avec agentPath"
          >
            <Settings size={20} />
            Migrer
          </button>
        </div>

        <div className="mb-6 text-slate-300 text-sm">
          <span className="font-medium">Chemin par défaut des agents Kiro - Niveau global:</span> {import.meta.env.VITE_DEFAULT_PATH || '/home/nizar/.kiro/agents/'}
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
                    <option value="all">Tous les agents Kiro</option>
                    {[...new Set(servers.map(s => s.agent).filter(Boolean))].map(agent => (
                      <option key={agent} value={agent}>{agent}</option>
                    ))}
                  </select>
                  <button
                    onClick={toggleAll}
                    disabled={agentFilter === 'all'}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckSquare size={18} />
                    {(() => {
                      const filteredServers = servers.filter(s => 
                        (agentFilter === 'all' || s.agent === agentFilter) && 
                        (searchQuery === '' || s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.command.toLowerCase().includes(searchQuery.toLowerCase()))
                      );
                      const allSelected = filteredServers.length > 0 && filteredServers.every(s => selectedServers.has(s.id));
                      return allSelected ? 'Tout désélectionner' : 'Tout sélectionner';
                    })()}
                  </button>
                  <button
                    onClick={() => toggleSelectionStatus(true)}
                    disabled={selectedServers.size === 0 || agentFilter === 'all'}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Power size={18} />
                    Activer sélection
                  </button>
                  <button
                    onClick={() => toggleSelectionStatus(false)}
                    disabled={selectedServers.size === 0 || agentFilter === 'all'}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <PowerOff size={18} />
                    Désactiver sélection
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
                      className="bg-slate-700/50 p-3 rounded-lg border border-slate-600 hover:border-purple-500 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <button
                            onClick={() => toggleServer(server.id)}
                          >
                            {selectedServers.has(server.id) ? (
                              <CheckSquare size={20} className="text-purple-400" />
                            ) : (
                              <Square size={20} className="text-slate-500" />
                            )}
                          </button>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-base">{server.name}</h3>
                              {server.agent && (
                                <span className="text-slate-400 text-xs">({server.agent})</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleServerStatus(server.id)}
                          className={`transition ml-2 ${server.disabled ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'}`}
                          title={server.disabled ? 'Activer le serveur' : 'Désactiver le serveur'}
                        >
                          {server.disabled ? <PowerOff size={18} /> : <Power size={18} />}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {agentFilePath && (
              <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-slate-700">
                <h2 className="text-xl font-semibold mb-2">Chemin de l'agent</h2>
                <p className="text-slate-300 text-sm break-all">{agentFilePath}</p>
              </div>
            )}

            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-slate-700">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold">Configuration de serveur MCP</h2>
                <div className="flex gap-2">
                  {!isEditing ? (
                    <button
                      onClick={startEditing}
                      disabled={selectedServers.size === 0}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Edit size={18} />
                      Éditer
                    </button>
                  ) : (
                    <button
                      onClick={saveConfig}
                      className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition flex items-center gap-2"
                    >
                      <Save size={18} />
                      Sauvegarder
                    </button>
                  )}
                </div>
              </div>
              <div className="bg-slate-900/50 p-4 rounded-lg">
                {isEditing ? (
                  <textarea
                    value={editedConfig}
                    onChange={(e) => setEditedConfig(e.target.value)}
                    className="w-full h-96 bg-slate-800 text-slate-300 text-xs font-mono p-4 rounded border border-slate-600 focus:border-purple-500 focus:outline-none"
                  />
                ) : (
                  <pre className="text-xs text-slate-300 overflow-x-auto max-h-96 overflow-y-auto">
                    {(() => {
                      const mcpServers = generateConfig().mcpServers;
                      const entries = Object.entries(mcpServers);
                      return entries.map(([name, config]) => 
                        `"${name}": ${JSON.stringify(config, null, 2)}`
                      ).join(',\n');
                    })()}
                  </pre>
                )}
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
                      const defaultPath = import.meta.env.VITE_DEFAULT_PATH || '/home/nizar/.kiro/agents/';
                      setAgentFilePath(defaultPath + file.name);
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