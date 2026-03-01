import React, { useState, useEffect } from 'react';
import { Mail, TestTube } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import api from '../../lib/api';

const TEST_EMAIL = 'peter@digitalsanctum.com.au';

/**
 * SendNotificationForm — Full Variant (DOC-012)
 *
 * Props:
 *   accountId  {string}   — Account UUID. Used to fetch billing_email + contacts.
 *   assetName  {string}   — Pre-fills subject as "{assetName} Has Been Renewed".
 *   onChange   {fn(form)} — Fires on every state change. Parent reads form at submit time.
 *   disabled   {bool}     — Greys out the form during parent save operation.
 */
export default function SendNotificationForm({ accountId, assetName, defaultSubject, onChange, disabled = false }) {
    const [form, setForm] = useState({
        to: '',
        cc: [],
        subject: defaultSubject || '',
        message: '',
        recipient_contact_id: null,
        mode: 'search',
        test_mode: false
    });
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(false);

    // Fetch account contacts + billing_email, then seed form
    useEffect(() => {
        if (!accountId) return;
        setLoading(true);
        api.get(`/accounts/${accountId}`)
            .then(res => {
                const accountContacts = res.data.contacts || [];
                setContacts(accountContacts);

                let defaultEmail = res.data.billing_email || '';
                let defaultContactId = null;

                const billingLead = accountContacts.find(c => c.persona === 'Billing Lead');
                const primary = accountContacts.find(c => c.is_primary_contact);

                if (billingLead?.email) {
                    defaultEmail = billingLead.email;
                    defaultContactId = billingLead.id;
                } else if (primary?.email) {
                    defaultEmail = primary.email;
                    defaultContactId = primary.id;
                }

                update({
                    to: defaultEmail,
                    recipient_contact_id: defaultContactId,
                    mode: defaultContactId ? 'search' : 'manual',
                    subject: assetName ? `${assetName} Has Been Renewed` : (form.subject || defaultSubject || '')
                });
            })
            .catch(e => console.error('SendNotificationForm: failed to load account', e))
            .finally(() => setLoading(false));
    }, [accountId]);

    // Keep subject in sync if assetName changes after mount
    useEffect(() => {
        if (assetName) {
            update({ subject: `${assetName} Has Been Renewed` });
        }
    }, [assetName]);

    // Keep subject in sync if defaultSubject arrives after mount
    useEffect(() => {
        if (defaultSubject && !assetName) {
            update({ subject: defaultSubject });
        }
    }, [defaultSubject]);

    const update = (patch) => {
        setForm(prev => {
            const next = { ...prev, ...patch };
            onChange?.(next);
            return next;
        });
    };

    const contactOptions = contacts.map(c => ({
        id: c.id,
        title: c.email,
        identifier: `${c.first_name} ${c.last_name} (${c.persona || 'Contact'})`,
        original: c
    }));

    const selectedContact = contacts.find(c => c.id === form.recipient_contact_id);
    const greetingName = selectedContact?.first_name || null;

    const handleContactSelect = (contact) => {
        update({
            to: contact.title,
            recipient_contact_id: contact.id
        });
    };

    const handleCcAdd = (item) => {
        const email = typeof item === 'string' ? item : item.title;
        if (!email || form.cc.includes(email)) return;
        update({ cc: [...form.cc, email] });
    };

    const handleCcRemove = (email) => {
        update({ cc: form.cc.filter(e => e !== email) });
    };

    const inputCls = `w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm 
        focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors`;

    return (
        <div className={`space-y-4 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>

            {/* Section header */}
            <div className="flex items-center gap-2 pt-1">
                <Mail size={14} className="text-indigo-400" />
                <span className="text-sm font-medium text-slate-300">Client Notification</span>
            </div>

            {/* Test Mode */}
            <label className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                form.test_mode
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
            }`}>
                <div>
                    <span className={`text-xs font-bold uppercase tracking-wider ${
                        form.test_mode ? 'text-amber-400' : 'text-slate-500'
                    }`}>
                        <TestTube size={11} className="inline mr-1" />
                        Test Mode
                    </span>
                    {form.test_mode && (
                        <span className="block text-[10px] text-amber-300 mt-0.5">
                            → {TEST_EMAIL}
                        </span>
                    )}
                </div>
                <input
                    type="checkbox"
                    checked={form.test_mode}
                    onChange={e => update({ test_mode: e.target.checked })}
                    className="accent-amber-500 w-4 h-4"
                />
            </label>

            {/* To field */}
            <div className={form.test_mode ? 'opacity-40 pointer-events-none' : ''}>
                <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">To</label>
                    <button
                        type="button"
                        onClick={() => update({
                            mode: form.mode === 'search' ? 'manual' : 'search',
                            recipient_contact_id: null
                        })}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                        {form.mode === 'search' ? 'Enter Custom Email' : 'Search Contacts'}
                    </button>
                </div>

                {form.mode === 'search' ? (
                    <SearchableSelect
                        items={contactOptions}
                        selectedIds={form.recipient_contact_id ? [form.recipient_contact_id] : []}
                        onSelect={handleContactSelect}
                        labelKey="title"
                        subLabelKey="identifier"
                        placeholder={loading ? 'Loading contacts...' : 'Search contacts...'}
                    />
                ) : (
                    <input
                        type="email"
                        className={inputCls}
                        value={form.to}
                        onChange={e => update({ to: e.target.value, recipient_contact_id: null })}
                        placeholder="client@example.com"
                    />
                )}

                {/* Greeting preview */}
                {greetingName && form.mode === 'search' && (
                    <p className="mt-1.5 text-xs text-emerald-400">
                        ✓ Will greet as: Hi {greetingName},
                    </p>
                )}
            </div>

            {/* CC field */}
            <div className={form.test_mode ? 'opacity-40 pointer-events-none' : ''}>
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                    CC
                </label>
                <SearchableSelect
                    items={contactOptions.filter(c => !form.cc.includes(c.title))}
                    onSelect={handleCcAdd}
                    labelKey="title"
                    subLabelKey="identifier"
                    displaySelected={false}
                    allowCreate
                    placeholder="Add CC recipient..."
                />
                {form.cc.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {form.cc.map(email => (
                            <span
                                key={email}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-700 border border-slate-600 rounded text-xs text-slate-300"
                            >
                                {email}
                                <button
                                    type="button"
                                    onClick={() => handleCcRemove(email)}
                                    className="text-slate-500 hover:text-red-400 transition-colors leading-none"
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Subject */}
            <div>
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                    Subject
                </label>
                <input
                    type="text"
                    className={inputCls}
                    value={form.subject}
                    onChange={e => update({ subject: e.target.value })}
                    placeholder="Email subject..."
                />
            </div>

            {/* Message */}
            <div>
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                    Message <span className="text-slate-600 normal-case font-normal">(optional)</span>
                </label>
                <textarea
                    className={`${inputCls} h-20 resize-none`}
                    value={form.message}
                    onChange={e => update({ message: e.target.value })}
                    placeholder="Add a personal note..."
                />
            </div>
        </div>
    );
}
