import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { api } from '../lib/api';

const SettingsTab = ({ categories, setCategories, selectedBranch, showNotification }) => {
  const [newName, setNewName] = useState('');
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState('');

  const saveCategories = async (updated, message) => {
    setCategories(updated);
    try {
      await api.saveCategories(updated, selectedBranch, message);
      showNotification('Catégories sauvegardées ✓');
    } catch (e) {
      showNotification(`Erreur: ${e.message}`, 'error');
    }
  };

  const addCategory = async () => {
    const name = newName.trim();
    if (!name || categories[name]) return;
    await saveCategories({ ...categories, [name]: [] }, `feat: add category "${name}"`);
    setNewName('');
  };

  const renameCategory = async (oldName) => {
    const name = editValue.trim();
    if (!name || name === oldName || categories[name]) { setEditingKey(null); return; }
    const updated = {};
    for (const [key, val] of Object.entries(categories)) {
      updated[key === oldName ? name : key] = val;
    }
    await saveCategories(updated, `feat: rename category "${oldName}" → "${name}"`);
    setEditingKey(null);
  };

  const deleteCategory = async (name) => {
    const { [name]: _, ...rest } = categories;
    await saveCategories(rest, `feat: delete category "${name}"`);
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Catégories</h2>
      <div className="space-y-2 mb-4">
        {Object.keys(categories).map(name => (
          <div key={name} className="flex items-center gap-2 bg-slate-700/50 p-3 rounded-lg border border-slate-600">
            {editingKey === name ? (
              <>
                <input value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && renameCategory(name)}
                  className="flex-1 px-3 py-1 bg-slate-900 border border-slate-500 rounded focus:border-purple-500 focus:outline-none" autoFocus />
                <button onClick={() => renameCategory(name)} className="text-green-400 hover:text-green-300"><Check size={18} /></button>
                <button onClick={() => setEditingKey(null)} className="text-slate-400 hover:text-white"><X size={18} /></button>
              </>
            ) : (
              <>
                <span className="flex-1">{name}</span>
                <span className="text-sm text-slate-400">{categories[name].length} serveurs</span>
                <button onClick={() => { setEditingKey(name); setEditValue(name); }} className="text-slate-400 hover:text-purple-400"><Pencil size={16} /></button>
                <button onClick={() => deleteCategory(name)} className="text-slate-400 hover:text-red-400"><Trash2 size={16} /></button>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCategory()}
          placeholder="Nouvelle catégorie (ex: 🔒 Sécurité)" className="flex-1 px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:border-purple-500 focus:outline-none" />
        <button onClick={addCategory} disabled={!newName.trim()} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition flex items-center gap-2 disabled:opacity-50">
          <Plus size={18} /> Ajouter
        </button>
      </div>
    </div>
  );
};

export default SettingsTab;
