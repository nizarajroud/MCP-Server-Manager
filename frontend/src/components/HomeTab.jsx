import React, { useState } from 'react';
import { Power, PowerOff, CheckSquare, Square, Edit, Save, GripVertical, ArrowRightLeft } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { api } from '../lib/api';
import MoveServerModal from './MoveServerModal';

const HomeTab = ({ servers, categories, setCategories, registry, health, agentContent, selectedAgent, selectedBranch, agents, saveToGitHub, setServers, showNotification, reloadAgent }) => {
  const [selectedServers, setSelectedServers] = useState(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState(new Set([...Object.keys(categories), '📦 Non catégorisé']));
  const [isEditing, setIsEditing] = useState(false);
  const [editedConfig, setEditedConfig] = useState('');
  const [showMoveModal, setShowMoveModal] = useState(false);

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
    for (const category of Object.keys(grouped)) {
      grouped[category].sort((a, b) => (a.disabled ? 1 : 0) - (b.disabled ? 1 : 0));
    }
    return grouped;
  };

  const toggleCategory = (category) => {
    const s = new Set(collapsedCategories);
    s.has(category) ? s.delete(category) : s.add(category);
    setCollapsedCategories(s);
  };

  const toggleAll = () => {
    const allSelected = servers.length > 0 && servers.every(s => selectedServers.has(s.name));
    setSelectedServers(allSelected ? new Set() : new Set(servers.map(s => s.name)));
  };

  const toggleServerStatus = async (serverName) => {
    const mcpServers = { ...agentContent.mcpServers };
    mcpServers[serverName] = { ...mcpServers[serverName], disabled: !mcpServers[serverName].disabled };
    const action = mcpServers[serverName].disabled ? 'disable' : 'enable';
    const success = await saveToGitHub(mcpServers, `feat: ${action} ${serverName} on ${selectedAgent}`);
    if (success) setServers(Object.entries(mcpServers).map(([name, config]) => ({ name, ...config })));
  };

  const toggleSelectionStatus = async (enable) => {
    const mcpServers = { ...agentContent.mcpServers };
    for (const name of selectedServers) {
      mcpServers[name] = { ...mcpServers[name], disabled: !enable };
    }
    const success = await saveToGitHub(mcpServers, `feat: ${enable ? 'enable' : 'disable'} ${selectedServers.size} servers on ${selectedAgent}`);
    if (success) setServers(Object.entries(mcpServers).map(([name, config]) => ({ name, ...config })));
  };

  const onDragEnd = async (result) => {
    const { draggableId, destination, source } = result;
    if (!destination || destination.droppableId === source.droppableId) return;

    const serverName = draggableId;
    const newCategory = destination.droppableId;
    const oldCategory = source.droppableId;

    const updated = { ...categories };
    if (oldCategory !== '📦 Non catégorisé' && updated[oldCategory]) {
      updated[oldCategory] = updated[oldCategory].filter(s => s !== serverName);
    }
    if (newCategory !== '📦 Non catégorisé') {
      if (!updated[newCategory]) updated[newCategory] = [];
      if (!updated[newCategory].includes(serverName)) {
        updated[newCategory].push(serverName);
      }
    }

    setCategories(updated);
    try {
      await api.saveCategories(updated, selectedBranch, `feat: move ${serverName} to ${newCategory}`);
      showNotification(`${serverName} → ${newCategory} ✓`);
    } catch (e) {
      showNotification(`Erreur: ${e.message}`, 'error');
    }
  };

  const startEditing = () => {
    const formatted = Object.entries(agentContent.mcpServers)
      .filter(([name]) => selectedServers.has(name))
      .map(([name, config]) => `"${name}": ${JSON.stringify(config, null, 2)}`)
      .join(',\n');
    setEditedConfig(formatted);
    setIsEditing(true);
  };

  const saveConfig = async () => {
    try {
      const mcpServers = { ...agentContent.mcpServers };
      const entries = editedConfig.trim().split(/,\n(?=")/);
      for (const entry of entries) {
        const match = entry.trim().match(/^"([^"]+)":\s*(\{[\s\S]*\})$/);
        if (match) mcpServers[match[1]] = JSON.parse(match[2]);
      }
      const success = await saveToGitHub(mcpServers, `feat: update config on ${selectedAgent}`);
      if (success) {
        setServers(Object.entries(mcpServers).map(([name, config]) => ({ name, ...config })));
        setIsEditing(false);
      }
    } catch (e) {
      showNotification(`Erreur: ${e.message}`, 'error');
    }
  };

  const grouped = getGroupedServers();

  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-4">
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
        <button onClick={() => setShowMoveModal(true)} disabled={selectedServers.size === 0} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition flex items-center gap-2 disabled:opacity-50">
          <ArrowRightLeft size={18} /> Déplacer
        </button>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="space-y-3">
          {Object.entries(grouped).map(([category, categoryServers]) => (
            <div key={category} className="border border-slate-600 rounded-lg overflow-hidden">
              <button onClick={() => toggleCategory(category)} className="w-full flex items-center justify-between px-4 py-2 bg-slate-700/80 hover:bg-slate-700 transition">
                <span className="font-semibold">{category} <span className="text-slate-400 text-sm">({categoryServers.length})</span></span>
                <span className="text-slate-400">{collapsedCategories.has(category) ? '▶' : '▼'}</span>
              </button>
              {!collapsedCategories.has(category) && (
                <Droppable droppableId={category}>
                  {(provided, snapshot) => (
                    <div ref={provided.innerRef} {...provided.droppableProps}
                      className={`space-y-1 p-2 min-h-[40px] transition ${snapshot.isDraggingOver ? 'bg-purple-500/10' : ''}`}>
                      {categoryServers.map((server, index) => (
                        <Draggable key={server.name} draggableId={server.name} index={index}>
                          {(provided, snapshot) => (
                            <div ref={provided.innerRef} {...provided.draggableProps}
                              className={`bg-slate-700/50 p-2 rounded border transition ${snapshot.isDragging ? 'border-purple-400 shadow-lg shadow-purple-500/20' : 'border-slate-600 hover:border-purple-500'}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1">
                                  <span {...provided.dragHandleProps} className="text-slate-500 hover:text-slate-300 cursor-grab">
                                    <GripVertical size={14} />
                                  </span>
                                  <button onClick={() => {
                                    const s = new Set(selectedServers);
                                    s.has(server.name) ? s.delete(server.name) : s.add(server.name);
                                    setSelectedServers(s);
                                  }}>
                                    {selectedServers.has(server.name) ? <CheckSquare size={18} className="text-purple-400" /> : <Square size={18} className="text-slate-500" />}
                                  </button>
                                  <h3 className="text-sm">{server.name}</h3>
                                  {(() => {
                                    const reg = registry[server.name];
                                    const cfg = agentContent.mcpServers[server.name];
                                    const isRemoteInternet = cfg?.args?.some(a => typeof a === 'string' && (a.startsWith('https://') || a.includes('.api.aws')));
                                    if (isRemoteInternet) return <span className="text-xs px-1.5 py-0.5 rounded bg-green-900/50 text-green-300">🌐 Internet</span>;
                                    if (reg && reg.target !== 'local') return <span className="text-xs px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-300">💻 {reg.target}</span>;
                                    if (reg) return <span className="text-xs px-1.5 py-0.5 rounded bg-slate-600 text-slate-300">📦 Local</span>;
                                    return null;
                                  })()}
                                  {health[server.name] && (
                                    <span className={`w-2 h-2 rounded-full ${health[server.name] === 'up' ? 'bg-green-400' : 'bg-red-400'}`} title={health[server.name]} />
                                  )}
                                </div>
                                <button onClick={() => toggleServerStatus(server.name)} className={`transition ml-2 ${server.disabled ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'}`}>
                                  {server.disabled ? <PowerOff size={16} /> : <Power size={16} />}
                                </button>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              )}
            </div>
          ))}
        </div>
      </DragDropContext>

      {selectedServers.size > 0 && !isEditing && (
        <button onClick={startEditing} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition flex items-center gap-2">
          <Edit size={18} /> Éditer la sélection
        </button>
      )}

      {isEditing && (
        <div>
          <textarea value={editedConfig} onChange={(e) => setEditedConfig(e.target.value)} className="w-full h-64 bg-slate-900 border border-slate-600 rounded-lg p-4 font-mono text-sm focus:border-purple-500 focus:outline-none" placeholder='Collez la config JSON ici' />
          <div className="flex gap-2 mt-2">
            <button onClick={saveConfig} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition flex items-center gap-2">
              <Save size={18} /> Sauvegarder & Commit
            </button>
            <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition">Annuler</button>
          </div>
        </div>
      )}

      {showMoveModal && (
        <MoveServerModal
          serverNames={[...selectedServers]}
          sourceAgent={selectedAgent}
          agents={agents}
          selectedBranch={selectedBranch}
          onClose={() => setShowMoveModal(false)}
          onSuccess={(result) => {
            setShowMoveModal(false);
            if (result.error) {
              showNotification(`Erreur: ${result.error}`, 'error');
            } else {
              showNotification(`${result.moved.length} serveur(s) ${result.mode === 'move' ? 'déplacé(s)' : 'copié(s)'} vers ${result.to} ✓`);
              setSelectedServers(new Set());
              reloadAgent();
            }
          }}
        />
      )}
    </div>
  );
};

export default HomeTab;
