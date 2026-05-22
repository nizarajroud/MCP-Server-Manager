import React, { useState } from 'react';
import { X, ArrowRightLeft, Copy } from 'lucide-react';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const MoveServerModal = ({ serverNames, sourceAgent, agents, selectedBranch, onClose, onSuccess }) => {
  const [destAgent, setDestAgent] = useState('');
  const [mode, setMode] = useState('move');
  const [loading, setLoading] = useState(false);

  const availableAgents = agents.filter(a => a.name !== sourceAgent);

  const handleSubmit = async () => {
    if (!destAgent) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/move-server`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverNames, sourceAgent, destAgent, branch: selectedBranch, mode })
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess(data);
      } else {
        onSuccess({ error: data.error });
      }
    } catch (e) {
      onSuccess({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-600 rounded-xl p-6 w-full max-w-md shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Déplacer / Copier</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        <p className="text-sm text-slate-400 mb-4">
          {serverNames.length} serveur{serverNames.length > 1 ? 's' : ''} sélectionné{serverNames.length > 1 ? 's' : ''} depuis <span className="text-purple-300">{sourceAgent}</span>
        </p>

        <div className="mb-4">
          <label className="block text-sm text-slate-400 mb-1">Agent de destination</label>
          <select value={destAgent} onChange={e => setDestAgent(e.target.value)}
            className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:border-purple-500 focus:outline-none">
            <option value="">-- Choisir --</option>
            {availableAgents.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
          </select>
        </div>

        <div className="mb-6 flex gap-4">
          <label className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border ${mode === 'move' ? 'border-purple-500 bg-purple-500/10' : 'border-slate-600'}`}>
            <input type="radio" name="mode" value="move" checked={mode === 'move'} onChange={() => setMode('move')} className="hidden" />
            <ArrowRightLeft size={16} /> Déplacer
          </label>
          <label className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border ${mode === 'copy' ? 'border-purple-500 bg-purple-500/10' : 'border-slate-600'}`}>
            <input type="radio" name="mode" value="copy" checked={mode === 'copy'} onChange={() => setMode('copy')} className="hidden" />
            <Copy size={16} /> Copier
          </label>
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition">Annuler</button>
          <button onClick={handleSubmit} disabled={!destAgent || loading}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition disabled:opacity-50">
            {loading ? 'En cours...' : mode === 'move' ? 'Déplacer' : 'Copier'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoveServerModal;
