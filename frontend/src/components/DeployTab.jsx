import React, { useState } from 'react';
import { GripVertical, ChevronsUp, ChevronsDown } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { api } from '../lib/api';

const DeployTab = ({ agentContent, selectedAgent, selectedBranch, categories, setCategories, registry, setRegistry, health, resources, saveToGitHub, showNotification, reloadRegistry, reloadHealth }) => {
  const [deploySort, setDeploySort] = useState({ key: 'cl', asc: false });
  const [deploySearch, setDeploySearch] = useState('');
  const [deploySelected, setDeploySelected] = useState(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState(new Set());
  const [activeFilters, setActiveFilters] = useState(new Set());

  const toggleFilter = (key, e) => {
    let s;
    if (e?.shiftKey) {
      s = new Set(activeFilters);
    } else {
      s = activeFilters.has(key) ? new Set() : new Set();
    }
    s.has(key) ? s.delete(key) : s.add(key);
    setActiveFilters(s);
    setCollapsedCats(new Set());
  };

  if (!agentContent) return <p className="text-slate-400">Sélectionnez un agent pour commencer.</p>;

  return (() => {
const allServers = Object.keys(agentContent.mcpServers || {});
const totalInternet = allServers.filter(n => { const c = agentContent.mcpServers[n]; return c.args?.some(a => typeof a === 'string' && (a.startsWith('https://') || a.includes('.api.aws'))); }).length;
const totalLAN = allServers.filter(n => { const c = agentContent.mcpServers[n]; return c.args?.includes('mcp-remote') && !c.args?.some(a => typeof a === 'string' && (a.startsWith('https://') || a.includes('.api.aws'))); }).length;
const totalDirect = allServers.length - totalInternet - totalLAN;
const totalEnabled = allServers.filter(n => !agentContent.mcpServers[n].disabled).length;
const totalCritical = allServers.filter(n => (agentContent.mcpServers[n].priority || 'standard') === 'critical').length;

const getServerCategory = (name) => {
  for (const [cat, list] of Object.entries(categories)) {
    if (list.includes(name)) return cat;
  }
  return '📦 Non catégorisé';
};

const getGrouped = () => {
  const grouped = {};
  const filtered = allServers.filter(n => {
    if (deploySearch && !n.toLowerCase().includes(deploySearch.toLowerCase())) return false;
    const c = agentContent.mcpServers[n];
    const isInet = c.args?.some(a => typeof a === 'string' && (a.startsWith('https://') || a.includes('.api.aws')));
    const isLan = c.args?.includes('mcp-remote') && !isInet;
    // Priority filter (intersection)
    if (activeFilters.has('critical') && (c.priority || 'standard') !== 'critical') return false;
    if (activeFilters.has('normal') && (c.priority || 'standard') === 'critical') return false;
    // State filter (intersection)
    if (activeFilters.has('actifs') && c.disabled) return false;
    if (activeFilters.has('disabled') && !c.disabled) return false;
    if (activeFilters.has('heavy') && (!resources[n] || resources[n].weight !== 'heavy' || (registry[n] && registry[n].target !== 'local'))) return false;
    // Resource filters (union within group)
    const resourceFilters = ['local', 'lan', 'internet'].filter(f => activeFilters.has(f));
    if (resourceFilters.length > 0) {
      const matchesLocal = resourceFilters.includes('local') && !isInet && !isLan;
      const matchesLan = resourceFilters.includes('lan') && isLan;
      const matchesInternet = resourceFilters.includes('internet') && isInet;
      if (!matchesLocal && !matchesLan && !matchesInternet) return false;
    }
    return true;
  });
  for (const name of filtered) {
    const cat = getServerCategory(name);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(name);
  }
  // Sort within categories
  if (activeFilters.has('heavy')) {
    for (const cat of Object.keys(grouped)) {
      grouped[cat].sort((a, b) => ((resources[b]?.memMB || 0) - (resources[a]?.memMB || 0)));
    }
  } else if (deploySort.key) {
    const getSortVal = (n) => {
      const c = agentContent.mcpServers[n];
      const r = registry[n];
      const isInet = c?.args?.some(a => typeof a === 'string' && (a.startsWith('https://') || a.includes('.api.aws')));
      switch (deploySort.key) {
        case 'priority': return (c.priority || 'standard') === 'critical' ? 0 : 1;
        case 'etat': return c.disabled ? 1 : 0;
        case 'ressource': return isInet ? 'internet' : (r && r.target !== 'local') ? r.target : 'local';
        case 'cl': return resources[n]?.memMB || 0;
        default: return 0;
      }
    };
    for (const cat of Object.keys(grouped)) {
      grouped[cat].sort((a, b) => {
        const va = getSortVal(a), vb = getSortVal(b);
        if (va < vb) return deploySort.asc ? -1 : 1;
        if (va > vb) return deploySort.asc ? 1 : -1;
        return 0;
      });
    }
  }
  return grouped;
};

const onDragEnd = async (result) => {
  const { draggableId, destination, source } = result;
  if (!destination || destination.droppableId === source.droppableId) return;
  const serverName = draggableId;
  const newCat = destination.droppableId;
  const oldCat = source.droppableId;
  const updated = { ...categories };
  if (oldCat !== '📦 Non catégorisé' && updated[oldCat]) {
    updated[oldCat] = updated[oldCat].filter(s => s !== serverName);
  }
  if (newCat !== '📦 Non catégorisé') {
    if (!updated[newCat]) updated[newCat] = [];
    if (!updated[newCat].includes(serverName)) updated[newCat].push(serverName);
  }
  setCategories(updated);
  try {
    await api.saveCategories(updated, selectedBranch, `feat: move ${serverName} to ${newCat}`);
    showNotification(`${serverName} → ${newCat} ✓`);
  } catch (e) { showNotification(`Erreur: ${e.message}`, 'error'); }
};

const grouped = getGrouped();

const renderRow = (name, index) => {
  const cfg = agentContent.mcpServers[name];
  const reg = registry[name];
  const isInternet = cfg?.args?.some(a => typeof a === 'string' && (a.startsWith('https://') || a.includes('.api.aws')));
  const priority = cfg.priority || 'standard';
  return (
    <Draggable key={name} draggableId={name} index={index}>
      {(provided, snapshot) => (
        <tr ref={provided.innerRef} {...provided.draggableProps}
          className={`border-b border-slate-700/50 hover:bg-slate-700/30 ${snapshot.isDragging ? 'bg-purple-900/20' : ''}`}>
          <td className="py-2 px-1 w-8" {...provided.dragHandleProps}>
            <GripVertical size={14} className="text-slate-500 hover:text-slate-300 cursor-grab" />
          </td>
          <td className="py-2 px-2 w-8">
            <input type="checkbox" checked={deploySelected.has(name)} onChange={() => {
              const s = new Set(deploySelected); s.has(name) ? s.delete(name) : s.add(name); setDeploySelected(s);
            }} className="accent-purple-500" />
          </td>
          <td className="py-2 px-3 font-medium text-sm">{name}</td>
          <td className="py-2 px-3 w-16">
            <button onClick={async () => {
              const next = priority === 'critical' ? 'standard' : 'critical';
              const mcpServers = { ...agentContent.mcpServers };
              mcpServers[name] = { ...mcpServers[name], priority: next };
              await saveToGitHub(mcpServers, `feat: set ${name} priority to ${next}`);
            }} className="active:scale-75 transition-transform" title={priority}>
              {priority === 'critical' ? '⭐' : '○'}
            </button>
          </td>
          <td className="py-2 px-3 w-12">
            <button onClick={async () => {
              const mcpServers = { ...agentContent.mcpServers };
              mcpServers[name] = { ...mcpServers[name], disabled: !mcpServers[name].disabled };
              await saveToGitHub(mcpServers, `feat: ${mcpServers[name].disabled ? 'disable' : 'enable'} ${name}`);
            }} className={`transition active:scale-75 ${cfg.disabled ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'}`}>
              {cfg.disabled ? '🔴' : '🟢'}
            </button>
          </td>
          <td className="py-2 px-3 w-28">
            {isInternet ? (
              <span className="text-xs px-1.5 py-0.5 rounded bg-green-900/50 text-green-300">🌐 Internet</span>
            ) : cfg.locked ? (
              <span className="text-xs px-1.5 py-0.5 rounded bg-slate-600 text-slate-400">🔒 {reg?.target === 'local' || !reg ? 'Local' : reg.target}</span>
            ) : (
              <select value={reg?.target === 'local' || !reg ? 'local' : reg.target} onChange={async (e) => {
                try {
                  const target = e.target.value;
                  const result = await api.updateServerTarget(name, target, selectedBranch);
                  const mcpServers = { ...agentContent.mcpServers };
                  const serverCfg = mcpServers[name];
                  if (target === 'local') {
                    if (serverCfg._original) { mcpServers[name] = { ...serverCfg, command: serverCfg._original.command, args: serverCfg._original.args, disabled: false }; delete mcpServers[name]._original; }
                    else { mcpServers[name] = { ...serverCfg, disabled: false }; }
                  } else {
                    const port = result.port;
                    if (port) { mcpServers[name] = { ...serverCfg, _original: serverCfg._original || { command: serverCfg.command, args: serverCfg.args }, command: 'npx', args: ['mcp-remote', `http://192.168.2.56:${port}/mcp`, '--allow-http'], disabled: false }; }
                  }
                  await saveToGitHub(mcpServers, `feat: ${target === 'local' ? 'restore local' : 'switch to remote'} ${name}`);
                  // Auto start/stop server on remote
                  if (target !== 'local') {
                    try { await api.serverControl(name, 'start', selectedBranch); } catch (e) {}
                  } else {
                    try { await api.serverControl(name, 'stop', selectedBranch); } catch (e) {}
                  }
                  reloadRegistry(); reloadHealth();
                } catch (err) { showNotification(`Erreur: ${err.message}`, 'error'); }
              }} className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs focus:border-purple-500 focus:outline-none">
                <option value="local">📦 Local</option>
                <option value="pcalt">💻 pcalt</option>
              </select>
            )}
          </td>
          <td className="py-2 px-3 w-12" title={resources[name] ? `CPU: ${resources[name].cpu}% | MEM: ${resources[name].memMB}MB` : ''}>
            {(!isInternet && (!reg || reg.target === 'local')) ? (resources[name] ? (resources[name].weight === 'heavy' ? '🔥' : '🍃') : '—') : '—'}
          </td>
          <td className="py-2 px-3 w-12">
            {health[name] ? <span className={`w-2 h-2 inline-block rounded-full ${health[name] === 'up' ? 'bg-green-400' : 'bg-red-400'}`} /> : '—'}
          </td>
        </tr>
      )}
    </Draggable>
  );
};

return (
<div className="space-y-3">
  {/* Zone 1 — Filtres rapides */}
  <div className="flex gap-3 text-sm flex-wrap items-center">
    <span onClick={() => { setActiveFilters(new Set()); setCollapsedCats(new Set()); }} className={`px-2 py-1 rounded cursor-pointer transition ${activeFilters.size === 0 ? 'bg-slate-500 text-white ring-2 ring-slate-400' : 'bg-slate-700 hover:bg-slate-600'}`}>Total: <strong>{allServers.length}</strong></span>
    <div className="flex gap-1 items-center px-2 py-1 border border-slate-600 rounded-lg">
      <span className="text-[10px] text-slate-500 mr-1">Priorité</span>
      <span onClick={(e) => toggleFilter('critical', e)} className={`px-2 py-0.5 rounded cursor-pointer transition ${activeFilters.has('critical') ? 'bg-red-600 text-white ring-2 ring-red-400' : 'bg-red-900/50 text-red-300 hover:bg-red-800/50'}`}>🔴 {totalCritical}</span>
      <span onClick={(e) => toggleFilter('normal', e)} className={`px-2 py-0.5 rounded cursor-pointer transition ${activeFilters.has('normal') ? 'bg-yellow-600 text-white ring-2 ring-yellow-400' : 'bg-yellow-900/50 text-yellow-300 hover:bg-yellow-800/50'}`}>○ {allServers.length - totalCritical}</span>
    </div>
    <div className="flex gap-1 items-center px-2 py-1 border border-slate-600 rounded-lg">
      <span className="text-[10px] text-slate-500 mr-1">Ressource</span>
      <span onClick={(e) => toggleFilter('local', e)} className={`px-2 py-0.5 rounded cursor-pointer transition ${activeFilters.has('local') ? 'bg-slate-500 text-white ring-2 ring-slate-400' : 'bg-slate-700 hover:bg-slate-600'}`}>📦 {totalDirect}</span>
      <span onClick={(e) => toggleFilter('lan', e)} className={`px-2 py-0.5 rounded cursor-pointer transition ${activeFilters.has('lan') ? 'bg-purple-600 text-white ring-2 ring-purple-400' : 'bg-purple-900/50 text-purple-300 hover:bg-purple-800/50'}`}>💻 {totalLAN}</span>
      <span onClick={(e) => toggleFilter('internet', e)} className={`px-2 py-0.5 rounded cursor-pointer transition ${activeFilters.has('internet') ? 'bg-green-600 text-white ring-2 ring-green-400' : 'bg-green-900/50 text-green-300 hover:bg-green-800/50'}`}>🌐 {totalInternet}</span>
    </div>
    <div className="flex gap-1 items-center px-2 py-1 border border-slate-600 rounded-lg">
      <span className="text-[10px] text-slate-500 mr-1">État</span>
      <span onClick={(e) => toggleFilter('actifs', e)} className={`px-2 py-0.5 rounded cursor-pointer transition ${activeFilters.has('actifs') ? 'bg-green-600 text-white ring-2 ring-green-400' : 'bg-green-900/50 text-green-300 hover:bg-green-800/50'}`}>✓ {totalEnabled}</span>
      <span onClick={(e) => toggleFilter('disabled', e)} className={`px-2 py-0.5 rounded cursor-pointer transition ${activeFilters.has('disabled') ? 'bg-red-600 text-white ring-2 ring-red-400' : 'bg-red-900/50 text-red-300 hover:bg-red-800/50'}`}>✗ {allServers.length - totalEnabled}</span>
    </div>
    <span onClick={(e) => toggleFilter('heavy', e)} className={`px-2 py-1 rounded cursor-pointer transition ${activeFilters.has('heavy') ? 'bg-orange-600 text-white ring-2 ring-orange-400' : 'bg-orange-900/50 text-orange-300 hover:bg-orange-800/50'}`}>🔥 Heavy: <strong>{Object.entries(resources).filter(([n, r]) => r.weight === 'heavy' && (!registry[n] || registry[n].target === 'local')).length}</strong></span>
  </div>

  {/* Zone 2 — Recherche + Vue + Refresh */}
  <div className="flex items-center justify-between gap-3">
    <div className="relative">
      <input type="text" placeholder="🔍 Rechercher un serveur..." value={deploySearch || ''} onChange={e => setDeploySearch(e.target.value)}
        className="px-3 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-sm focus:border-purple-500 focus:outline-none w-72 pr-8" />
      {deploySearch && <button onClick={() => setDeploySearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-lg leading-none">✕</button>}
    </div>
    <div className="flex items-center gap-2">
      <button onClick={() => {
        const allCats = Object.keys(grouped);
        setCollapsedCats(collapsedCats.size === allCats.length ? new Set() : new Set(allCats));
      }} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs flex items-center gap-1">
        {collapsedCats.size === Object.keys(grouped).length ? <><ChevronsDown size={14} /> Expand</> : <><ChevronsUp size={14} /> Collapse</>}
      </button>
      <button onClick={reloadHealth} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs active:scale-75 transition-transform" title="Rafraîchir santé">🔄 Santé</button>
    </div>
  </div>
  {deploySelected.size > 0 && (
    <div className="flex items-center gap-3 px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600 flex-wrap">
      <span className="text-sm text-slate-300">☑ {deploySelected.size}</span>
      <div className="flex gap-1 items-center px-2 py-1 border border-slate-600 rounded-lg">
        <span className="text-[10px] text-slate-500 mr-1">État</span>
        <button disabled={batchLoading} onClick={async () => {
          setBatchLoading(true);
          const mcpServers = { ...agentContent.mcpServers };
          for (const n of deploySelected) mcpServers[n] = { ...mcpServers[n], disabled: false };
          await saveToGitHub(mcpServers, `feat: enable ${deploySelected.size} servers`);
          setDeploySelected(new Set()); setBatchLoading(false);
        }} className="px-2 py-1 bg-green-600/20 hover:bg-green-600/40 border border-green-500 rounded-md text-xs font-medium active:scale-90 transition-transform disabled:opacity-50">🟢</button>
        <button disabled={batchLoading} onClick={async () => {
          setBatchLoading(true);
          const mcpServers = { ...agentContent.mcpServers };
          const eligible = [...deploySelected].filter(n => (mcpServers[n]?.priority || 'standard') !== 'critical');
          if (!eligible.length) { showNotification('Critiques exclus', 'error'); setBatchLoading(false); return; }
          for (const n of eligible) mcpServers[n] = { ...mcpServers[n], disabled: true };
          await saveToGitHub(mcpServers, `feat: disable ${eligible.length} servers`);
          setDeploySelected(new Set()); setBatchLoading(false);
        }} className="px-2 py-1 bg-red-600/20 hover:bg-red-600/40 border border-red-500 rounded-md text-xs font-medium active:scale-90 transition-transform disabled:opacity-50">🔴</button>
      </div>
      <div className="flex gap-1 items-center px-2 py-1 border border-slate-600 rounded-lg">
        <span className="text-[10px] text-slate-500 mr-1">Ressource</span>
        <button disabled={batchLoading} onClick={async () => {
          setBatchLoading(true);
          try {
            const eligible = [...deploySelected].filter(n => (agentContent.mcpServers[n]?.priority || 'standard') !== 'critical');
            if (!eligible.length) { showNotification('Critiques exclus', 'error'); setBatchLoading(false); return; }
            const updates = eligible.map(n => ({ serverName: n, target: 'local' }));
            const result = await api.batchUpdateTargets(updates, selectedBranch);
            setRegistry(result.registry);
            const mcpServers = { ...agentContent.mcpServers };
            for (const n of eligible) { const cfg = mcpServers[n]; if (cfg._original) { mcpServers[n] = { ...cfg, command: cfg._original.command, args: cfg._original.args, disabled: false }; delete mcpServers[n]._original; } else { mcpServers[n] = { ...cfg, disabled: false }; } }
            await saveToGitHub(mcpServers, `feat: move ${eligible.length} servers to local`);
            for (const n of eligible) { try { await api.serverControl(n, 'stop', selectedBranch); } catch (e) {} }
            await reloadHealth(); setDeploySelected(new Set());
          } catch (e) { showNotification(`Erreur: ${e.message}`, 'error'); }
          setBatchLoading(false);
        }} className="px-2 py-1 bg-slate-600/20 hover:bg-slate-600/40 border border-slate-400 rounded-md text-xs font-medium active:scale-90 transition-transform disabled:opacity-50">📦 Local</button>
        <button disabled={batchLoading} onClick={async () => {
          setBatchLoading(true);
          try {
            const eligible = [...deploySelected].filter(n => { const c = agentContent.mcpServers[n]; return (c.priority || 'standard') !== 'critical' && !c?.args?.some(a => typeof a === 'string' && (a.startsWith('https://') || a.includes('.api.aws'))) && !c?.locked; });
            if (!eligible.length) { showNotification('Aucun éligible', 'error'); setBatchLoading(false); return; }
            const updates = eligible.map(n => ({ serverName: n, target: 'pcalt' }));
            const result = await api.batchUpdateTargets(updates, selectedBranch);
            setRegistry(result.registry);
            const mcpServers = { ...agentContent.mcpServers };
            for (const n of eligible) { const r = result.registry[n]; if (r?.port) { const cfg = mcpServers[n]; mcpServers[n] = { ...cfg, _original: cfg._original || { command: cfg.command, args: cfg.args }, command: 'npx', args: ['mcp-remote', `http://${r.host}:${r.port}/mcp`, '--allow-http'], disabled: false }; } }
            await saveToGitHub(mcpServers, `feat: move ${eligible.length} servers to pcalt`);
            for (const n of eligible) { try { await api.serverControl(n, 'start', selectedBranch); } catch (e) {} }
            await reloadHealth(); setDeploySelected(new Set());
          } catch (e) { showNotification(`Erreur: ${e.message}`, 'error'); }
          setBatchLoading(false);
        }} className="px-2 py-1 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500 rounded-md text-xs font-medium active:scale-90 transition-transform disabled:opacity-50">💻 pcalt</button>
        <button disabled={batchLoading} onClick={async () => {
          setBatchLoading(true);
          const mcpServers = { ...agentContent.mcpServers };
          const allLocked = [...deploySelected].every(n => mcpServers[n]?.locked);
          for (const n of deploySelected) mcpServers[n] = { ...mcpServers[n], locked: !allLocked };
          await saveToGitHub(mcpServers, `feat: ${allLocked ? 'unlock' : 'lock'} ${deploySelected.size} servers`);
          setDeploySelected(new Set()); setBatchLoading(false);
        }} className="px-2 py-1 bg-slate-600/20 hover:bg-slate-600/40 border border-slate-400 rounded-md text-xs font-medium active:scale-90 transition-transform disabled:opacity-50">🔒</button>
      </div>
      <div className="flex gap-1 items-center px-2 py-1 border border-slate-600 rounded-lg">
        <span className="text-[10px] text-slate-500 mr-1">Priorité</span>
        <button disabled={batchLoading} onClick={async () => {
          setBatchLoading(true);
          const mcpServers = { ...agentContent.mcpServers };
          for (const n of deploySelected) mcpServers[n] = { ...mcpServers[n], priority: 'critical' };
          await saveToGitHub(mcpServers, `feat: set ${deploySelected.size} servers as critical`);
          setDeploySelected(new Set()); setBatchLoading(false);
        }} className="px-2 py-1 bg-red-900/20 hover:bg-red-900/40 border border-red-400 rounded-md text-xs font-medium active:scale-90 transition-transform disabled:opacity-50">⭐</button>
        <button disabled={batchLoading} onClick={async () => {
          setBatchLoading(true);
          const mcpServers = { ...agentContent.mcpServers };
          for (const n of deploySelected) mcpServers[n] = { ...mcpServers[n], priority: 'standard' };
          await saveToGitHub(mcpServers, `feat: set ${deploySelected.size} servers as normal`);
          setDeploySelected(new Set()); setBatchLoading(false);
        }} className="px-2 py-1 bg-yellow-900/20 hover:bg-yellow-900/40 border border-yellow-400 rounded-md text-xs font-medium active:scale-90 transition-transform disabled:opacity-50">○</button>
      </div>
      {batchLoading && <span className="text-xs text-purple-300 animate-pulse">⏳</span>}
    </div>
  )}
  {(() => {
    const pcaltServers = allServers.filter(n => registry[n]?.target === 'pcalt' || (agentContent.mcpServers[n]?.args?.includes('mcp-remote') && !agentContent.mcpServers[n]?.args?.some(a => typeof a === 'string' && (a.startsWith('https://') || a.includes('.api.aws')))));
    const pcaltClientsActive = pcaltServers.filter(n => !agentContent.mcpServers[n].disabled).length;
    const pcaltServersUp = pcaltServers.filter(n => health[n] === 'up').length;
    const pcaltIdle = pcaltServersUp - pcaltClientsActive;
    const localServers = allServers.filter(n => !registry[n] || registry[n].target === 'local');
    const localActive = localServers.filter(n => !agentContent.mcpServers[n].disabled).length;
    const localMemMB = localServers.reduce((sum, n) => sum + (resources[n]?.memMB || 0), 0);
    return (
      <div className="flex gap-4 text-xs flex-wrap mb-3">
        <div className="px-3 py-2 bg-purple-900/20 border border-purple-800/50 rounded-lg flex gap-3 items-center">
          <span className="font-semibold text-purple-300">💻 pcalt</span>
          <span>Clients actifs: <strong>{pcaltClientsActive}/{pcaltServers.length}</strong></span>
          <span>Serveurs UP: <strong>{pcaltServersUp}/{pcaltServers.length}</strong></span>
          {pcaltIdle > 0 && <span className="text-yellow-400">⚠️ {pcaltIdle} sans client</span>}
        </div>
        <div className="px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg flex gap-3 items-center">
          <span className="font-semibold text-slate-300">📦 Local</span>
          <span>Actifs: <strong>{localActive}/{localServers.length}</strong></span>
          <span>Conso: <strong>{localMemMB > 1024 ? `${(localMemMB/1024).toFixed(1)} GB` : `${localMemMB} MB`}</strong></span>
        </div>
      </div>
    );
  })()}
  <DragDropContext onDragEnd={onDragEnd}>
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-600 text-slate-400 text-xs">
          <th className="py-2 px-1 w-8"></th>
          <th className="py-2 px-2 w-8">
            <input type="checkbox" onChange={(e) => {
              const visible = Object.values(grouped).flat();
              setDeploySelected(e.target.checked ? new Set(visible) : new Set());
            }} checked={deploySelected.size > 0 && deploySelected.size === Object.values(grouped).flat().length} className="accent-purple-500" />
          </th>
          <th className="text-left py-2 px-3">Serveur ({Object.values(grouped).flat().length})</th>
          <th className="text-left py-2 px-3 w-16 cursor-pointer hover:text-white" onClick={() => setDeploySort(s => ({ key: 'priority', asc: s.key === 'priority' ? !s.asc : true }))}>Priorité {deploySort.key === 'priority' ? (deploySort.asc ? '▲' : '▼') : ''}</th>
          <th className="text-left py-2 px-3 w-12 cursor-pointer hover:text-white" onClick={() => setDeploySort(s => ({ key: 'etat', asc: s.key === 'etat' ? !s.asc : true }))}>État {deploySort.key === 'etat' ? (deploySort.asc ? '▲' : '▼') : ''}</th>
          <th className="text-left py-2 px-3 w-28 cursor-pointer hover:text-white" onClick={() => setDeploySort(s => ({ key: 'ressource', asc: s.key === 'ressource' ? !s.asc : true }))}>Ressource {deploySort.key === 'ressource' ? (deploySort.asc ? '▲' : '▼') : ''}</th>
          <th className="text-left py-2 px-3 w-12 cursor-pointer hover:text-white" title="Consommation Locale" onClick={() => setDeploySort(s => ({ key: 'cl', asc: s.key === 'cl' ? !s.asc : true }))}>CL {deploySort.key === 'cl' ? (deploySort.asc ? '▲' : '▼') : ''}</th>
          <th className="text-left py-2 px-3 w-12">Santé</th>
        </tr>
      </thead>
    </table>
    {Object.entries(grouped).map(([category, servers]) => (
      <div key={category} className="border border-slate-600 rounded-lg overflow-hidden">
        <button onClick={() => { const s = new Set(collapsedCats); s.has(category) ? s.delete(category) : s.add(category); setCollapsedCats(s); }}
          className="w-full flex items-center justify-between px-4 py-2 bg-slate-700/80 hover:bg-slate-700 transition">
          <span className="font-semibold text-sm">{category} <span className="text-slate-400">({servers.length})</span></span>
          <span className="text-slate-400">{collapsedCats.has(category) ? '▶' : '▼'}</span>
        </button>
        {!collapsedCats.has(category) && (
          <Droppable droppableId={category}>
            {(provided, snapshot) => (
              <table className="w-full text-sm">
                <tbody ref={provided.innerRef} {...provided.droppableProps} className={snapshot.isDraggingOver ? 'bg-purple-500/5' : ''}>
                  {servers.map((name, idx) => renderRow(name, idx))}
                  {provided.placeholder}
                </tbody>
              </table>
            )}
          </Droppable>
        )}
      </div>
    ))}
  </DragDropContext>
</div>
  );
  })();
};

export default DeployTab;
