import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';

const BacklogTab = ({ showNotification }) => {
  const [input, setInput] = useState('');
  const [issues, setIssues] = useState([]);

  useEffect(() => { loadIssues(); }, []);

  const loadIssues = async () => {
    try {
      const data = await api.getIssues();
      setIssues(data);
    } catch (e) {}
  };

  const handleSubmit = async (e) => {
    if (e.key !== 'Enter' || !input.trim()) return;
    try {
      const issue = await api.createIssue(input.trim());
      setIssues([issue, ...issues]);
      setInput('');
      showNotification(`Issue #${issue.number} créée ✓`);
    } catch (e) {
      showNotification(`Erreur: ${e.message}`, 'error');
    }
  };

  return (
    <div>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleSubmit}
        placeholder="Décrire une idée ou user story... (Entrée pour soumettre)"
        className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg focus:border-purple-500 focus:outline-none mb-6"
      />

      <h3 className="text-sm text-slate-400 mb-3">Issues ouvertes</h3>
      <div className="space-y-2">
        {issues.map(issue => (
          <div key={issue.number} className="flex items-center gap-3 p-2 bg-slate-700/50 rounded border border-slate-600">
            <span className="text-purple-400 text-sm font-mono">#{issue.number}</span>
            <span className="flex-1 text-sm">{issue.title}</span>
            <span className="text-xs text-green-400">{issue.state}</span>
          </div>
        ))}
        {issues.length === 0 && <p className="text-slate-500 text-sm">Aucune issue</p>}
      </div>
    </div>
  );
};

export default BacklogTab;
