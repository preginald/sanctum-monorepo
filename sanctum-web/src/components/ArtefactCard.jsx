import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';
import { FileText, Link2, Code, Key, File, Plus, X, Loader2 } from 'lucide-react';

const typeIcon = (type) => {
  const map = { file: File, url: Link2, code_path: Code, document: FileText, credential_ref: Key };
  const Icon = map[type] || FileText;
  return <Icon size={14} className="opacity-40 shrink-0" />;
};

const ARTEFACT_TYPES = ['file', 'url', 'code_path', 'document', 'credential_ref'];

export default function ArtefactCard({ entityType, entityId, artefacts = [], onUpdate }) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', artefact_type: 'url' });

  const handleUnlink = async (artefactId) => {
    try {
      await api.delete(`/artefacts/${artefactId}/link/${entityType}/${entityId}`);
      addToast("Artefact unlinked", "success");
      onUpdate?.();
    } catch (e) {
      addToast(e.response?.data?.detail || "Failed to unlink", "danger");
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      // Create artefact
      const res = await api.post('/artefacts', {
        name: form.name,
        artefact_type: form.artefact_type,
        url: form.url || null,
      });
      // Link it
      await api.post(`/artefacts/${res.data.id}/link`, {
        entity_type: entityType,
        entity_id: String(entityId),
      });
      addToast("Artefact created and linked", "success");
      setForm({ name: '', url: '', artefact_type: 'url' });
      setShowCreate(false);
      onUpdate?.();
    } catch (e) {
      addToast(e.response?.data?.detail || "Failed to create artefact", "danger");
    } finally { setCreating(false); }
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 flex items-center gap-2">
          <FileText size={14} /> Artefacts
        </h3>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="text-xs opacity-40 hover:opacity-100 transition-opacity"
          title="Add artefact"
        >
          {showCreate ? <X size={14} /> : <Plus size={14} />}
        </button>
      </div>

      {/* Quick create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="mb-3 space-y-2">
          <input
            type="text"
            placeholder="Name"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full bg-black/30 border border-slate-600 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-sanctum-gold"
          />
          <input
            type="text"
            placeholder="URL / path (optional)"
            value={form.url}
            onChange={e => setForm({ ...form, url: e.target.value })}
            className="w-full bg-black/30 border border-slate-600 rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-sanctum-gold"
          />
          <select
            value={form.artefact_type}
            onChange={e => setForm({ ...form, artefact_type: e.target.value })}
            className="w-full bg-black/30 border border-slate-600 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-sanctum-gold"
          >
            {ARTEFACT_TYPES.map(t => (
              <option key={t} value={t}>{t.replace('_', ' ')}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={creating || !form.name.trim()}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded text-xs font-bold bg-sanctum-gold/20 text-sanctum-gold hover:bg-sanctum-gold/30 disabled:opacity-30 transition-colors"
          >
            {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Create & Link
          </button>
        </form>
      )}

      {/* Artefact list */}
      {artefacts.length === 0 && !showCreate ? (
        <p className="text-xs opacity-40">No artefacts linked.</p>
      ) : (
        <div className="space-y-2">
          {artefacts.map(a => (
            <div
              key={a.id}
              className="flex items-center gap-2 p-2 bg-black/30 rounded-lg group"
            >
              {typeIcon(a.artefact_type)}
              <button
                onClick={() => navigate(`/artefacts/${a.id}`)}
                className="flex-1 text-left text-xs text-sanctum-gold hover:underline truncate"
              >
                {a.name}
              </button>
              <button
                onClick={() => handleUnlink(a.id)}
                className="opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity"
                title="Unlink"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
