import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Loading from '../components/ui/Loading';
import {
    Layers, Plus, Copy, Download, Zap, Tag,
    Pencil, Trash2, ChevronDown, ChevronRight,
    CheckCircle, Clock, AlertTriangle, Users, Link2,
    ArrowUp, ArrowDown
} from 'lucide-react';
// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const PRIORITY_BADGE = {
    low:      'bg-slate-700     text-slate-300',
    normal:   'bg-blue-500/20   text-blue-300',
    high:     'bg-orange-500/20 text-orange-300',
    critical: 'bg-red-500/20    text-red-300',
};
const TYPE_BADGE = {
    task:        'bg-slate-700    text-slate-300',
    feature:     'bg-teal-500/20  text-teal-300',
    bug:         'bg-red-500/20   text-red-300',
    maintenance: 'bg-yellow-500/20 text-yellow-300',
};
// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT: Inline-editable section row
// ─────────────────────────────────────────────────────────────────────────────

const SectionRow = ({ section, allSections, sectionIndex, sectionCount, onAddItem, onDeleteSection, onDeleteItem, onMoveSection }) => {
    const [open, setOpen] = useState(true);
    const [addingItem, setAddingItem] = useState(false);
    const [newItem, setNewItem] = useState({ subject: '', description: '', item_type: 'task', priority: 'normal', config: { dependencies: [] } });
    const [showItemDesc, setShowItemDesc] = useState(false);
    const [showDeps, setShowDeps] = useState(false);
    const { addToast } = useToast();
    const handleAddItem = async () => {
        if (!newItem.subject.trim()) return;
        try {
            await onAddItem(section.id, { ...newItem, sequence: section.items.length + 1 });
            setNewItem({ subject: '', description: '', item_type: 'task', priority: 'normal', config: { dependencies: [] } });
            setShowItemDesc(false);
            setAddingItem(false);
        } catch {
            addToast('Failed to add item', 'error');
        }
    };
    return (
        <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
            {/* Section header */}
            <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-800/50 transition-colors"
                onClick={() => setOpen(o => !o)}
            >
                <div className="flex items-center gap-3 min-w-0">
                    {open ? <ChevronDown size={16} className="text-slate-400 flex-shrink-0" /> : <ChevronRight size={16} className="text-slate-400 flex-shrink-0" />}
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{section.name}</span>
                            <span className="text-xs text-slate-500 font-mono">{section.items?.length || 0} items</span>
                        </div>
                        {section.description && (
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{section.description}</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-0.5 mr-1">
                        <button
                            onClick={() => onMoveSection(sectionIndex, sectionIndex - 1)}
                            disabled={sectionIndex === 0}
                            className="p-1 text-slate-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors rounded"
                            title="Move section up"
                        >
                            <ArrowUp size={12} />
                        </button>
                        <button
                            onClick={() => onMoveSection(sectionIndex, sectionIndex + 1)}
                            disabled={sectionIndex === sectionCount - 1}
                            className="p-1 text-slate-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors rounded"
                            title="Move section down"
                        >
                            <ArrowDown size={12} />
                        </button>
                    </div>
                    <button
                        onClick={() => setAddingItem(a => !a)}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors"
                    >
                        <Plus size={12} /> Add item
                    </button>
                    <button
                        onClick={() => onDeleteSection(section.id)}
                        className="p-1 text-slate-500 hover:text-red-400 transition-colors rounded"
                        title="Delete section"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
            {/* Items */}
            {open && (
                <div className="border-t border-slate-800">
                    {section.items?.map((item, idx) => (
                        <div
                            key={item.id}
                            className="flex items-start gap-3 px-5 py-3 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors group"
                        >
                            <span className="text-xs text-slate-600 font-mono mt-0.5 w-5 text-right flex-shrink-0">{idx + 1}</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-200">{item.subject}</p>
                                {item.description && (
                                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.description}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                {item.config?.dependencies?.length > 0 && (
                                    <span className="text-sanctum-gold" title={`${item.config.dependencies.length} dep(s)`}><Link2 size={12} /></span>
                                )}
                                <span className={`px-1.5 py-0.5 rounded text-xs ${TYPE_BADGE[item.item_type] || TYPE_BADGE.task}`}>
                                    {item.item_type}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-xs ${PRIORITY_BADGE[item.priority] || PRIORITY_BADGE.normal}`}>
                                    {item.priority}
                                </span>
                                <button
                                    onClick={() => onDeleteItem(item.id)}
                                    className="p-1 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 rounded"
                                    title="Delete item"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* Add item inline form */}
                    {addingItem && (
                        <div className="px-5 py-3 bg-black/20 space-y-2 border-t border-slate-800">
                            <div className="flex flex-wrap gap-2 items-end">
                                <div className="flex-1 min-w-[200px]">
                                    <input
                                        value={newItem.subject}
                                        onChange={e => setNewItem(p => ({ ...p, subject: e.target.value }))}
                                        onKeyDown={e => e.key === 'Enter' && !showItemDesc && handleAddItem()}
                                        placeholder="Item subject..."
                                        autoFocus
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sanctum-gold/50"
                                    />
                                </div>
                                <select
                                    value={newItem.item_type}
                                    onChange={e => setNewItem(p => ({ ...p, item_type: e.target.value }))}
                                    className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                                >
                                    {['task', 'feature', 'bug', 'maintenance'].map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <select
                                    value={newItem.priority}
                                    onChange={e => setNewItem(p => ({ ...p, priority: e.target.value }))}
                                    className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                                >
                                    {['low', 'normal', 'high', 'critical'].map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <button
                                    onClick={() => setShowItemDesc(d => !d)}
                                    className={`px-2 py-1.5 text-xs rounded-lg border transition-colors ${showItemDesc ? 'bg-slate-600 border-slate-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-white'}`}
                                    title="Add description"
                                >
                                    <Pencil size={12} />
                                </button>
                                <button
                                    onClick={() => setShowDeps(d => !d)}
                                    className={`px-2 py-1.5 text-xs rounded-lg border transition-colors ${showDeps ? 'bg-slate-600 border-slate-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-white'}`}
                                    title="Add dependencies"
                                >
                                    <Link2 size={12} />
                                </button>
                                <div className="flex gap-1">
                                    <button onClick={handleAddItem} className="px-3 py-1.5 bg-sanctum-gold text-black text-xs font-bold rounded-lg hover:bg-yellow-400">Add</button>
                                    <button onClick={() => { setAddingItem(false); setShowItemDesc(false); }} className="px-3 py-1.5 bg-slate-700 text-white text-xs rounded-lg hover:bg-slate-600">Cancel</button>
                                </div>
                            </div>
                            {showItemDesc && (
                                <textarea
                                    value={newItem.description}
                                    onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))}
                                    placeholder="Item description (optional)..."
                                    rows={2}
                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sanctum-gold/50 resize-none"
                                />
                            )}
                            {showDeps && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-400 font-medium">Dependencies</span>
                                        <button
                                            onClick={() => {
                                                const deps = [...(newItem.config?.dependencies || [])];
                                                deps.push({ section_seq: section.sequence, item_seq: 1, relation_type: 'blocks' });
                                                setNewItem(p => ({ ...p, config: { ...p.config, dependencies: deps } }));
                                            }}
                                            className="text-xs text-sanctum-gold hover:text-yellow-400"
                                        >+ Add dependency</button>
                                    </div>
                                    {(newItem.config?.dependencies || []).map((dep, di) => (
                                        <div key={di} className="flex gap-2 items-center">
                                            <select
                                                value={`${dep.section_seq}-${dep.item_seq}`}
                                                onChange={e => {
                                                    const [ss, is] = e.target.value.split('-').map(Number);
                                                    const deps = [...(newItem.config?.dependencies || [])];
                                                    deps[di] = { ...deps[di], section_seq: ss, item_seq: is };
                                                    setNewItem(p => ({ ...p, config: { ...p.config, dependencies: deps } }));
                                                }}
                                                className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none"
                                            >
                                                {(allSections || []).flatMap(s =>
                                                    (s.items || []).map(it => (
                                                        <option key={`${s.sequence}-${it.sequence}`} value={`${s.sequence}-${it.sequence}`}>
                                                            S{s.sequence}.{it.sequence} — {it.subject}
                                                        </option>
                                                    ))
                                                )}
                                            </select>
                                            <select
                                                value={dep.relation_type}
                                                onChange={e => {
                                                    const deps = [...(newItem.config?.dependencies || [])];
                                                    deps[di] = { ...deps[di], relation_type: e.target.value };
                                                    setNewItem(p => ({ ...p, config: { ...p.config, dependencies: deps } }));
                                                }}
                                                className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none"
                                            >
                                                <option value="blocks">blocks</option>
                                                <option value="relates_to">relates_to</option>
                                                <option value="duplicates">duplicates</option>
                                            </select>
                                            <button
                                                onClick={() => {
                                                    const deps = (newItem.config?.dependencies || []).filter((_, i) => i !== di);
                                                    setNewItem(p => ({ ...p, config: { ...p.config, dependencies: deps } }));
                                                }}
                                                className="text-slate-500 hover:text-red-400"
                                            ><Trash2 size={12} /></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {section.items?.length === 0 && !addingItem && (
                        <div className="px-5 py-4 text-xs text-slate-600 italic">No items yet — click "Add item" to begin.</div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function TemplateDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [template, setTemplate]           = useState(null);
    const [applications, setApplications]   = useState([]);
    const [loading, setLoading]             = useState(true);
    // Modals
    const [showApply, setShowApply]         = useState(false);
    const [applyForm, setApplyForm]         = useState({ account_id: '', project_name: '', project_description: '' });
    const [accounts, setAccounts]           = useState([]);
    const [applying, setApplying]           = useState(false);
    const [showClone, setShowClone]         = useState(false);
    const [cloneName, setCloneName]         = useState('');
    const [showAddSection, setShowAddSection] = useState(false);
    const [newSectionName, setNewSectionName] = useState('');
    const [newSectionDesc, setNewSectionDesc] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const [tpl, apps] = await Promise.all([
                api.get(`/templates/${id}`),
                api.get(`/templates/${id}/applications`),
            ]);
            setTemplate(tpl.data);
            setApplications(apps.data);
        } catch {
            addToast('Failed to load template', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [id]);

    const loadAccounts = async () => {
        try {
            const res = await api.get('/accounts');
            setAccounts(res.data);
        } catch {
            addToast('Failed to load accounts', 'error');
        }
    };

    const handleExport = async () => {
        try {
            const res = await api.get(`/templates/${id}/export`);
            const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${template.name.replace(/\s+/g, '_').toLowerCase()}_template.json`;
            a.click();
            URL.revokeObjectURL(url);
            addToast('Template exported', 'success');
        } catch {
            addToast('Export failed', 'error');
        }
    };

    const handleClone = async () => {
        try {
            const res = await api.post(`/templates/${id}/clone`, { name: cloneName });
            addToast(`Cloned: ${cloneName}`, 'success');
            setShowClone(false);
            navigate(`/templates/${res.data.id}`);
        } catch {
            addToast('Clone failed', 'error');
        }
    };

    const openApply = () => {
        loadAccounts();
        setApplyForm({ account_id: '', project_name: template?.name || '', project_description: template?.description || '' });
        setShowApply(true);
    };
    const handleApply = async () => {
        if (!applyForm.account_id) { addToast('Select a client', 'error'); return; }
        setApplying(true);
        try {
            const res = await api.post(`/templates/${id}/apply`, applyForm);
            addToast(`Project created: ${res.data.entity_name} (${res.data.milestones_created} milestones, ${res.data.tickets_created} tickets)`, 'success');
            setShowApply(false);
            navigate(`/projects/${res.data.entity_id}`);
        } catch {
            addToast('Apply failed', 'error');
        } finally {
            setApplying(false);
        }
    };
    // ── Sections & Items ─────────────────────────────────────────────────────
    const handleAddSection = async () => {
        if (!newSectionName.trim()) return;
        try {
            await api.post(`/templates/${id}/sections`, {
                name: newSectionName,
                description: newSectionDesc || null,
                sequence: (template.sections?.length || 0) + 1,
            });
            setNewSectionName('');
            setNewSectionDesc('');
            setShowAddSection(false);
            load();
        } catch {
            addToast('Failed to add section', 'error');
        }
    };
    const handleAddItem = async (sectionId, item) => {
        await api.post(`/templates/sections/${sectionId}/items`, item);
        load();
    };
    const handleDeleteSection = async (sectionId) => {
        if (!confirm('Delete this section and all its items?')) return;
        try {
            await api.delete(`/templates/sections/${sectionId}`);
            load();
        } catch {
            addToast('Failed to delete section', 'error');
        }
    };
    const handleMoveSection = async (fromIndex, toIndex) => {
        const sections = [...template.sections];
        const [moved] = sections.splice(fromIndex, 1);
        sections.splice(toIndex, 0, moved);
        const updated = sections.map((s, i) => ({ id: s.id, sequence: i + 1 }));
        try {
            await Promise.all(updated.map(s =>
                api.put(`/templates/sections/${s.id}`, { sequence: s.sequence })
            ));
            load();
        } catch {
            addToast('Failed to reorder sections', 'error');
        }
    };
    const handleDeleteItem = async (itemId) => {
        try {
            await api.delete(`/templates/items/${itemId}`);
            load();
        } catch {
            addToast('Failed to delete item', 'error');
        }
    };
    const handleToggleActive = async () => {
        try {
            await api.put(`/templates/${id}`, { is_active: !template.is_active });
            load();
            addToast(template.is_active ? 'Template deactivated' : 'Template activated', 'success');
        } catch {
            addToast('Failed to update template', 'error');
        }
    };

    if (loading) return <Loading />;
    if (!template) return <div className="text-red-400 p-8">Template not found</div>;

    const itemCount = template.sections?.reduce((s, sec) => s + (sec.items?.length || 0), 0) || 0;

    const actions = (
        <div className="flex gap-2">
            <button
                onClick={handleExport}
                className="flex items-center gap-2 px-3 py-2 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-600 transition-colors"
            >
                <Download size={16} /> Export JSON
            </button>
            <button
                onClick={() => { setCloneName(`${template.name} (Copy)`); setShowClone(true); }}
                className="flex items-center gap-2 px-3 py-2 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-600 transition-colors"
            >
                <Copy size={16} /> Clone
            </button>
            {template.template_type === 'project' && (
                <button
                    onClick={openApply}
                    className="flex items-center gap-2 px-3 py-2 bg-sanctum-gold text-black text-sm font-bold rounded-lg hover:bg-yellow-400 transition-colors"
                >
                    <Zap size={16} /> Apply Template
                </button>
            )}
        </div>
    );

    return (
        <Layout
            title={template.name}
            subtitle={`${template.template_type} template • ${template.category}`}
            badge={{ label: template.is_active ? 'Active' : 'Inactive', color: template.is_active ? 'green' : 'gray' }}
            breadcrumb={[{ label: 'Templates', path: '/templates' }]}
            actions={actions}
            onRefresh={load}
        >
            {/* Cloned-from notice */}
            {template.cloned_from_name && (
                <div className="mb-6 flex items-center gap-2 px-4 py-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-sm text-blue-300">
                    <Copy size={14} /> Forked from: <span className="font-medium">{template.cloned_from_name}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* ── Left: Sections & Items ──────────────────────────────── */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                            Sections & Items
                        </h2>
                        <button
                            onClick={() => setShowAddSection(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-white text-xs rounded-lg hover:bg-slate-600 transition-colors"
                        >
                            <Plus size={13} /> Add Section
                        </button>
                    </div>

                    {template.sections?.length === 0 ? (
                        <div className="text-center py-12 text-slate-600">
                            <Layers size={32} className="mx-auto mb-3 opacity-30" />
                            <p>No sections yet. Add one to start building the template.</p>
                        </div>
                    ) : (
                        template.sections.map((section, idx) => (
                            <SectionRow
                                key={section.id}
                                section={section}
                                allSections={template.sections}
                                sectionIndex={idx}
                                sectionCount={template.sections.length}
                                onAddItem={handleAddItem}
                                onDeleteSection={handleDeleteSection}
                                onDeleteItem={handleDeleteItem}
                                onMoveSection={handleMoveSection}
                            />
                        ))
                    )}
                </div>

                {/* ── Right: Sidebar ──────────────────────────────────────── */}
                <div className="space-y-4 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto scrollbar-thin">

                    {/* Stats */}
                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Stats</h3>
                        <div className="space-y-3">
                            {[
                                { label: 'Sections',      value: template.sections?.length || 0, icon: <Layers size={14} /> },
                                { label: 'Items',         value: itemCount,                       icon: <CheckCircle size={14} /> },
                                { label: 'Times Applied', value: template.times_applied || 0,     icon: <Zap size={14} className={template.times_applied > 0 ? 'text-sanctum-gold' : ''} /> },
                            ].map(s => (
                                <div key={s.label} className="flex items-center justify-between">
                                    <span className="flex items-center gap-2 text-sm text-slate-400">{s.icon}{s.label}</span>
                                    <span className="text-white font-mono font-bold">{s.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Tags */}
                    {template.tags?.length > 0 && (
                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
                            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Tags</h3>
                            <div className="flex flex-wrap gap-2">
                                {template.tags.map(tag => (
                                    <span key={tag} className="flex items-center gap-1 px-2 py-1 bg-slate-800 text-slate-300 text-xs rounded">
                                        <Tag size={10} />{tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Application History */}
                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                            Application History
                        </h3>
                        {applications.length === 0 ? (
                            <p className="text-xs text-slate-600 italic">Never applied yet.</p>
                        ) : (
                            <div className="space-y-2">
                                {applications.slice(0, 8).map(app => (
                                    <div key={app.id} className="flex items-start justify-between gap-2 text-xs">
                                        <div className="flex items-center gap-1.5 text-slate-400">
                                            <Users size={11} />
                                            <span className="font-mono text-slate-500 truncate">{app.entity_id?.slice(0, 8)}…</span>
                                        </div>
                                        <span className="text-slate-600 flex-shrink-0">
                                            {new Date(app.applied_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                ))}
                                {applications.length > 8 && (
                                    <p className="text-xs text-slate-600">+{applications.length - 8} more</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Danger zone */}
                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Manage</h3>
                        <button
                            onClick={handleToggleActive}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 border border-slate-600 text-sm text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
                        >
                            <AlertTriangle size={14} />
                            {template.is_active ? 'Deactivate Template' : 'Activate Template'}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Apply Modal ─────────────────────────────────────────────── */}
            <Modal isOpen={showApply} onClose={() => setShowApply(false)} title="Apply Template">
                <p className="text-sm text-slate-400 mb-4">
                    This will create a new project with all milestones and tickets scaffolded from this template.
                </p>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Client Account</label>
                        <select
                            value={applyForm.account_id}
                            onChange={e => setApplyForm(p => ({ ...p, account_id: e.target.value }))}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sanctum-gold/50"
                        >
                            <option value="">— Select a client —</option>
                            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    </div>
                    <Input
                        label="Project Name (optional override)"
                        value={applyForm.project_name}
                        onChange={e => setApplyForm(p => ({ ...p, project_name: e.target.value }))}
                        placeholder={template.name}
                    />
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Project Description</label>
                        <textarea
                            value={applyForm.project_description}
                            onChange={e => setApplyForm(p => ({ ...p, project_description: e.target.value }))}
                            placeholder="Describe the project scope..."
                            rows={3}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sanctum-gold/50 resize-none"
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <Button variant="ghost" onClick={() => setShowApply(false)}>Cancel</Button>
                    <Button onClick={handleApply} disabled={!applyForm.account_id || applying}>
                        {applying ? 'Creating...' : `Create Project`}
                    </Button>
                </div>
            </Modal>
            {/* ── Clone Modal ─────────────────────────────────────────────── */}
            <Modal isOpen={showClone} onClose={() => setShowClone(false)} title="Clone Template">
                <Input
                    label="New Template Name"
                    value={cloneName}
                    onChange={e => setCloneName(e.target.value)}
                    autoFocus
                />
                <div className="flex justify-end gap-2 mt-4">
                    <Button variant="ghost" onClick={() => setShowClone(false)}>Cancel</Button>
                    <Button onClick={handleClone} disabled={!cloneName.trim()}>Clone</Button>
                </div>
            </Modal>
            {/* ── Add Section Modal ────────────────────────────────────────── */}
            <Modal isOpen={showAddSection} onClose={() => { setShowAddSection(false); setNewSectionDesc(''); }} title="Add Section">
                <div className="space-y-4">
                    <Input
                        label="Section Name"
                        value={newSectionName}
                        onChange={e => setNewSectionName(e.target.value)}
                        placeholder="e.g. Discovery & Scoping"
                        autoFocus
                    />
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Description (optional)</label>
                        <textarea
                            value={newSectionDesc}
                            onChange={e => setNewSectionDesc(e.target.value)}
                            placeholder="What this phase covers..."
                            rows={2}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sanctum-gold/50 resize-none"
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                    <Button variant="ghost" onClick={() => { setShowAddSection(false); setNewSectionDesc(''); }}>Cancel</Button>
                    <Button onClick={handleAddSection} disabled={!newSectionName.trim()}>Add Section</Button>
                </div>
            </Modal>
        </Layout>
    );
}
