import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { RefreshCw, Calendar, AlertTriangle } from 'lucide-react';
import api from '../../lib/api';
import SendNotificationForm from './SendNotificationForm';

export default function RenewalModal({ isOpen, onClose, renewalAsset, onConfirm, isManual = false }) {
    const [newExpiry, setNewExpiry] = useState('');
    const [sendForm, setSendForm] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (renewalAsset?.suggested_expires_at) {
            setNewExpiry(renewalAsset.suggested_expires_at);
        }
        setError(null);
        setSendForm(null);
    }, [renewalAsset]);

    const handleConfirm = async () => {
        if (!newExpiry) { setError('New expiry date is required.'); return; }
        setIsSaving(true);
        setError(null);
        try {
            const payload = { expires_at: newExpiry };
            if (isManual && sendForm) {
                payload.send_renewal_notification = true;
                payload.to_email = sendForm.test_mode ? 'peter@digitalsanctum.com.au' : sendForm.to;
                payload.cc_emails = sendForm.test_mode ? [] : sendForm.cc;
                payload.subject = sendForm.test_mode ? `[TEST] ${sendForm.subject}` : sendForm.subject;
                payload.message = sendForm.message;
                payload.recipient_contact_id = sendForm.test_mode ? null : sendForm.recipient_contact_id;
            }
            const res = await api.put(`/assets/${renewalAsset.asset_id}`, payload);
            onConfirm?.(res.data);
            onClose();
        } catch (e) {
            setError(e.response?.data?.detail || 'Failed to update asset.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!renewalAsset) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="" maxWidth="max-w-lg">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                    <RefreshCw size={20} className="text-indigo-400" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-white">Confirm Renewal</h2>
                    <p className="text-sm text-slate-400">Update the expiry date for this asset</p>
                </div>
            </div>

            {/* Asset Summary */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 mb-5 space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Asset</span>
                    <span className="text-white font-medium">{renewalAsset.asset_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Type</span>
                    <span className="text-slate-300 capitalize">{renewalAsset.asset_type}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Current Expiry</span>
                    <span className="text-orange-400 font-medium">
                        {new Date(renewalAsset.current_expires_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                </div>
                {renewalAsset.billing_frequency && (
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Frequency</span>
                        <span className="text-slate-300 capitalize">{renewalAsset.billing_frequency}</span>
                    </div>
                )}
            </div>

            {/* New Expiry Input */}
            <div className="mb-5">
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    <Calendar size={14} className="inline mr-1.5 text-indigo-400" />
                    New Expiry Date
                </label>
                <input
                    type="date"
                    value={newExpiry}
                    onChange={e => setNewExpiry(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                />
            </div>

            {/* Client Notification — Full Variant (DOC-012) — manual flow only */}
            {isManual && (
                <div className="mb-5 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                    <SendNotificationForm
                        accountId={renewalAsset.account_id}
                        assetName={renewalAsset.asset_name}
                        onChange={setSendForm}
                        disabled={isSaving}
                    />
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">
                    <AlertTriangle size={14} />
                    {error}
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end">
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-600 hover:border-slate-500 rounded-lg transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleConfirm}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
                >
                    <RefreshCw size={14} className={isSaving ? 'animate-spin' : ''} />
                    {isSaving ? 'Saving...' : 'Confirm Renewal'}
                </button>
            </div>
        </Modal>
    );
}
