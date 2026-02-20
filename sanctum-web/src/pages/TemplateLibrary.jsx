import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Loading from '../components/ui/Loading';
import {
    Layers, Plus, Upload, Copy, Tag, Zap,
    ChevronRight, LayoutTemplate, Search, Filter
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_META = {
    project:  { label: 'Project',  color: 'text-sanctum-gold  bg-sanctum-gold/10  border-sanctum-gold/30'  },
    ticket:   { label: 'Ticket',   color: 'text-blue-400      bg-blue-400/10       border-blue-400/30'      },
    deal:     { label: 'Deal',     color: 'text-green-400     bg-green-400/10      border-green-400/30'     },
    campaign: { label: 'Campaign', color: 'text-purple-400    bg-purple-400/10     border-purple-400/30'    },
};

const CATEGORY_COLORS = {
    web:            'bg-cyan-500/10    text-cyan-400    border-cyan-500/30',
    infrastructure: 'bg-orange-500/10  text-orange-400  border-orange-500/30',
    onboarding:     'bg-teal-500/10    text-teal-400    border-teal-500/30',
    audit:          'bg-red-500/10     text-red-400     border-red-500/30',
    general:        'bg-slate-500/10   text-slate-400   border-slate-500/30',
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT: Template Card
// ─────────────────────────────────────────────────────────────────────────────

const TemplateCard = ({ template, onNavigate, onClone }) => {
    const typeMeta  = TYPE_META[template.template_type]  || { label: template.template_type,  color: 'text-slate-400 bg-slate-700 border-slate-600' };
    const catColor  = CATEGORY_COLORS[template.category] || CATEGORY_COLORS.general;

    return (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 hover:border-sanctum-gold/50 transition-all group relative overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-black/30 rounded-lg text-2xl">
                    {template.icon || <LayoutTemplate size={24} className="text-sanctum-gold" />}
                </div>
                <div className="flex flex-col items-end gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${typeMeta.color}`}>
                        {typeMeta.label}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs border ${catColor}`}>
                        {template.category}
                    </span>
                </div>
            </div>

            {/* Title & description */}
            <h3
                onClick={() => onNavigate(template.id)}
                className="text-lg font-bold text-white mb-1 group-hover:text-sanctum-gold transition-colors cursor-pointer"
            >
                {template.name}
            </h3>
            {template.cloned_from_name && (
                <p className="text-xs text-slate-500 mb-1 italic">Forked from: {template.cloned_from_name}</p>
            )}
            <p className="text-sm text-slate-400 mb-4 flex-1 line-clamp-2">{template.description || 'No description.'}</p>

            {/* Tags */}
            {template.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                    {template.tags.slice(0, 4).map(tag => (
                        <span key={tag} className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-800 text-slate-400 text-xs rounded">
                            <Tag size={10} />{tag}
                        </span>
                    ))}
                    {template.tags.length > 4 && (
                        <span className="px-1.5 py-0.5 bg-slate-800 text-slate-500 text-xs rounded">+{template.tags.length - 4}</span>
                    )}
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-500 font-mono">
                <span className="flex items-center gap-1.5">
                    <Layers size={11} />
                    {template.section_count ?? 0} sections · {template.item_count ?? 0} items
                </span>
                <span className="flex items-center gap-1.5">
                    <Zap size={11} className={template.times_applied > 0 ? 'text-sanctum-gold' : ''} />
                    {template.times_applied} applied
                </span>
            </div>

            {/* Hover actions */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 flex gap-2 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
                <button
                    onClick={() => onNavigate(template.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-sanctum-gold text-black text-xs font-bold rounded-lg hover:bg-yellow-400 transition-colors"
                >
                    Open <ChevronRight size={14} />
                </button>
                <button
                    onClick={() => onClone(template)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-700 text-white text-xs font-bold rounded-lg hover:bg-slate-600 transition-colors"
                    title="Clone template"
                >
                    <Copy size={14} />
                </button>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function TemplateLibrary() {
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [templates, setTemplates]     = useState([]);
    const [loading, setLoading]         = useState(true);
    const [search, setSearch]           = useState('');
    const [filterType, setFilterType]   = useState('all');
    const [filterCat, setFilterCat]     = useState('all');

    // Modals
    const [showClone, setShowClone]         = useState(false);
    const [cloneTarget, setCloneTarget]     = useState(null);
    const [cloneName, setCloneName]         = useState('');
    const [showImport, setShowImport]       = useState(false);
    const [importJson, setImportJson]       = useState('');
    const [importing, setImporting]         = useState(false);
    const fileRef = useRef(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get('/templates');
            setTemplates(res.data);
        } catch {
            showToast('Failed to load templates', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    // ── Derived filter ───────────────────────────────────────────────────────
    const visible = templates.filter(t => {
        const matchSearch = !search ||
            t.name.toLowerCase().includes(search.toLowerCase()) ||
            t.tags?.some(tag => tag.toLowerCase().includes(search.toLowerCase()));
        const matchType = filterType === 'all' || t.template_type === filterType;
        const matchCat  = filterCat  === 'all' || t.category      === filterCat;
        return matchSearch && matchType && matchCat;
    });

    const categories = [...new Set(templates.map(t => t.category))];
    const types      = [...new Set(templates.map(t => t.template_type))];

    // ── Clone ────────────────────────────────────────────────────────────────
    const openClone = (template) => {
        setCloneTarget(template);
        setCloneName(`${template.name} (Copy)`);
        setShowClone(true);
    };

    const handleClone = async () => {
        if (!cloneName.trim()) return;
        try {
            const res = await api.post(`/templates/${cloneTarget.id}/clone`, { name: cloneName });
            showToast(`Cloned: ${res.data.name}`, 'success');
            setShowClone(false);
            navigate(`/templates/${res.data.id}`);
        } catch {
            showToast('Clone failed', 'error');
        }
    };

    // ── JSON Import ──────────────────────────────────────────────────────────
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => setImportJson(ev.target.result);
        reader.readAsText(file);
    };

    const handleImport = async () => {
        setImporting(true);
        try {
            const payload = JSON.parse(importJson);
            const res = await api.post('/templates/import', payload);
            showToast(`Imported: ${res.data.name}`, 'success');
            setShowImport(false);
            setImportJson('');
            navigate(`/templates/${res.data.id}`);
        } catch (e) {
            showToast(e.message || 'Import failed — check JSON format', 'error');
        } finally {
            setImporting(false);
        }
    };

    // ── Stats bar ────────────────────────────────────────────────────────────
    const totalApplied = templates.reduce((sum, t) => sum + (t.times_applied || 0), 0);

    const actions = (
        <div className="flex gap-2">
            <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-600 transition-colors"
            >
                <Upload size={16} /> Import JSON
            </button>
            <button
                onClick={() => navigate('/templates/new')}
                className="flex items-center gap-2 px-3 py-2 bg-sanctum-gold text-black text-sm font-bold rounded-lg hover:bg-yellow-400 transition-colors"
            >
                <Plus size={16} /> New Template
            </button>
        </div>
    );

    return (
        <Layout
            title="Template Library"
            subtitle="The Blueprint — reusable scaffolds for any entity"
            badge={{ label: `${templates.length} templates`, color: 'blue' }}
            backPath="/"
            actions={actions}
            onRefresh={load}
        >
            {/* Stats bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Total Templates', value: templates.length,                           icon: <Layers size={18} /> },
                    { label: 'Times Applied',   value: totalApplied,                               icon: <Zap size={18} />    },
                    { label: 'Types',           value: types.length,                               icon: <Filter size={18} /> },
                    { label: 'Categories',      value: categories.length,                          icon: <Tag size={18} />    },
                ].map(stat => (
                    <div key={stat.label} className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-center gap-3">
                        <div className="text-sanctum-gold">{stat.icon}</div>
                        <div>
                            <p className="text-2xl font-bold text-white">{stat.value}</p>
                            <p className="text-xs text-slate-400">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search templates or tags..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sanctum-gold/50"
                    />
                </div>
                <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sanctum-gold/50"
                >
                    <option value="all">All Types</option>
                    {types.map(t => <option key={t} value={t}>{TYPE_META[t]?.label || t}</option>)}
                </select>
                <select
                    value={filterCat}
                    onChange={e => setFilterCat(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sanctum-gold/50"
                >
                    <option value="all">All Categories</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>

            {/* Grid */}
            {loading ? (
                <Loading />
            ) : visible.length === 0 ? (
                <div className="text-center py-20 text-slate-500">
                    <Layers size={40} className="mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">No templates found</p>
                    <p className="text-sm mt-1">Try adjusting your filters or create a new template.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {visible.map(t => (
                        <TemplateCard
                            key={t.id}
                            template={t}
                            onNavigate={id => navigate(`/templates/${id}`)}
                            onClone={openClone}
                        />
                    ))}
                </div>
            )}

            {/* Clone Modal */}
            <Modal isOpen={showClone} onClose={() => setShowClone(false)} title="Clone Template">
                <p className="text-sm text-slate-400 mb-4">
                    Cloning <span className="text-white font-medium">{cloneTarget?.name}</span>. Give the clone a new name.
                </p>
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

            {/* Import Modal */}
            <Modal isOpen={showImport} onClose={() => setShowImport(false)} title="Import Template from JSON">
                <p className="text-sm text-slate-400 mb-4">
                    Paste a previously exported template JSON, or upload a <code>.json</code> file.
                </p>
                <div className="flex gap-2 mb-3">
                    <button
                        onClick={() => fileRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-700 text-sm text-white rounded-lg hover:bg-slate-600 transition-colors"
                    >
                        <Upload size={14} /> Upload file
                    </button>
                    <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
                </div>
                <textarea
                    value={importJson}
                    onChange={e => setImportJson(e.target.value)}
                    placeholder='{ "name": "My Template", "template_type": "project", ... }'
                    rows={10}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none focus:border-sanctum-gold/50 resize-none"
                />
                <div className="flex justify-end gap-2 mt-4">
                    <Button variant="ghost" onClick={() => setShowImport(false)}>Cancel</Button>
                    <Button onClick={handleImport} disabled={!importJson.trim() || importing}>
                        {importing ? 'Importing...' : 'Import'}
                    </Button>
                </div>
            </Modal>
        </Layout>
    );
}
