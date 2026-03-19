import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../lib/api';
import { Loader2, FileText, Link2, Code, Key, File, Ticket, BookOpen, Building2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import MetadataStrip from '../components/ui/MetadataStrip';

const typeIcon = (type) => {
  const map = { file: File, url: Link2, code_path: Code, document: FileText, credential_ref: Key };
  return map[type] || FileText;
};

const typeColor = (type) => {
  const map = {
    file: 'bg-blue-500/20 text-blue-400',
    url: 'bg-green-500/20 text-green-400',
    code_path: 'bg-purple-500/20 text-purple-400',
    document: 'bg-orange-500/20 text-orange-400',
    credential_ref: 'bg-red-500/20 text-red-400',
  };
  return map[type] || 'bg-white/10 text-slate-300';
};

const ticketStatusColor = (s) => {
  const map = { new: 'text-blue-400', open: 'text-yellow-400', pending: 'text-orange-400', qa: 'text-purple-400', resolved: 'text-green-400' };
  return map[s] || 'text-slate-300';
};

const priorityColor = (p) => {
  const map = { critical: 'text-red-400', high: 'text-orange-400', normal: 'text-slate-300', low: 'text-slate-500' };
  return map[p] || 'text-slate-300';
};

export default function ArtefactDetail() {
  const { artefactId } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [artefact, setArtefact] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchArtefact(); }, [artefactId]);

  const fetchArtefact = async () => {
    try {
      const res = await api.get(`/artefacts/${artefactId}`);
      setArtefact(res.data);
    } catch (e) {
      addToast("Failed to load artefact", "danger");
    } finally { setLoading(false); }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  if (loading) return <Layout title="Artefact Detail"><div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div></Layout>;
  if (!artefact) return <Layout title="Artefact Detail"><p>Artefact not found.</p></Layout>;

  const TypeIcon = typeIcon(artefact.artefact_type);

  // Group links by entity type
  const linkedTickets = (artefact.links || []).filter(l => l.linked_entity_type === 'ticket');
  const linkedArticles = (artefact.links || []).filter(l => l.linked_entity_type === 'article');
  const linkedAccounts = (artefact.links || []).filter(l => l.linked_entity_type === 'account');

  return (
    <Layout
      title={artefact.name}
      breadcrumb={[
        { label: artefact?.account_name, path: artefact?.account_id ? `/clients/${artefact.account_id}` : null },
        { label: 'Artefacts', path: '/artefacts' },
      ]}
      badges={[{ value: artefact.artefact_type, map: 'artefactType' }]}
    >
      <MetadataStrip
        className="mb-4"
        storageKey="ds_metadata_expanded_artefact"
        collapsed={<>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${typeColor(artefact.artefact_type)}`}>{artefact.artefact_type}</span>
          <span className="opacity-40">·</span>
          <span className="opacity-50">{formatDate(artefact.created_at)}</span>
          {artefact.creator_name && <>
            <span className="opacity-40">·</span>
            <span className="opacity-50">{artefact.creator_name}</span>
          </>}
        </>}
        badges={[
          { label: artefact.artefact_type, className: typeColor(artefact.artefact_type) },
        ]}
        dates={[
          { label: 'Created', value: artefact.created_at },
          { label: 'Updated', value: artefact.updated_at },
        ]}
        rows={[
          { label: 'Created By', value: artefact.creator_name || '—' },
          { label: 'Type', value: artefact.artefact_type, mono: true },
          { label: 'Account', value: artefact.account_name || 'Internal' },
        ]}
        id={artefact.id}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT — DETAILS */}
        <div className="lg:col-span-2 space-y-6">

          {/* PROPERTIES */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-4">Properties</h3>
            <div className="grid grid-cols-2 gap-y-4 gap-x-8">
              <div className="flex items-center gap-2">
                <TypeIcon size={14} className="opacity-40" />
                <div>
                  <p className="text-xs opacity-50">Type</p>
                  <p className="text-sm font-mono">{artefact.artefact_type}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Building2 size={14} className="opacity-40" />
                <div>
                  <p className="text-xs opacity-50">Account</p>
                  {artefact.account_id ? (
                    <button onClick={() => navigate(`/clients/${artefact.account_id}`)} className="text-sm text-sanctum-gold hover:underline">
                      {artefact.account_name}
                    </button>
                  ) : (
                    <p className="text-sm opacity-50">Internal</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* URL / PATH */}
          {artefact.url && (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
              <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-3 flex items-center gap-2">
                <Link2 size={14} /> Reference
              </h3>
              {artefact.artefact_type === 'url' ? (
                <a href={artefact.url} target="_blank" rel="noopener noreferrer" className="text-sm text-sanctum-gold hover:underline font-mono break-all">
                  {artefact.url}
                </a>
              ) : (
                <p className="text-sm font-mono opacity-80 break-all">{artefact.url}</p>
              )}
            </div>
          )}

          {/* DESCRIPTION */}
          {artefact.description && (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
              <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-3">Description</h3>
              <p className="text-sm leading-relaxed opacity-80 whitespace-pre-wrap">{artefact.description}</p>
            </div>
          )}
        </div>

        {/* RIGHT — SIDEBAR */}
        <div className="space-y-6">

          {/* LINKED TICKETS */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-3 flex items-center gap-2">
              <Ticket size={14} /> Linked Tickets
            </h3>
            {linkedTickets.length === 0 ? (
              <p className="text-xs opacity-40">No tickets linked.</p>
            ) : (
              <div className="space-y-2">
                {linkedTickets.map(l => (
                  <button
                    key={l.id}
                    onClick={() => navigate(`/tickets/${l.linked_entity_id}`)}
                    className="w-full text-left p-3 bg-black/30 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <span className="text-xs font-bold">#{l.linked_entity_id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* LINKED ARTICLES */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-3 flex items-center gap-2">
              <BookOpen size={14} /> Linked Articles
            </h3>
            {linkedArticles.length === 0 ? (
              <p className="text-xs opacity-40">No articles linked.</p>
            ) : (
              <div className="space-y-2">
                {linkedArticles.map(l => (
                  <button
                    key={l.id}
                    onClick={() => navigate(`/wiki/${l.linked_entity_id}`)}
                    className="w-full text-left p-3 bg-black/30 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <span className="text-xs font-mono opacity-60">{l.linked_entity_id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* LINKED ACCOUNTS */}
          {linkedAccounts.length > 0 && (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
              <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-3 flex items-center gap-2">
                <Building2 size={14} /> Linked Accounts
              </h3>
              <div className="space-y-2">
                {linkedAccounts.map(l => (
                  <button
                    key={l.id}
                    onClick={() => navigate(`/clients/${l.linked_entity_id}`)}
                    className="w-full text-left p-3 bg-black/30 rounded-lg hover:bg-white/5 transition-colors text-sanctum-gold hover:underline text-sm font-bold"
                  >
                    {l.linked_entity_id}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* METADATA */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-3">Metadata</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="opacity-50">Created</span>
                <span>{formatDate(artefact.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-50">Updated</span>
                <span>{formatDate(artefact.updated_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-50">ID</span>
                <span className="font-mono opacity-40 text-[10px]">{artefact.id}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
