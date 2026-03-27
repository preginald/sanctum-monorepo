import React, { useState } from 'react';
import { Shield, Copy, Check, RotateCw, Trash2, Loader2 } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import SSORegistrationModal from './SSORegistrationModal';
import SSOCredentialReveal from './SSOCredentialReveal';
import ConfirmationModal from '../ui/ConfirmationModal';

export default function SSOSection({ account, onUpdate }) {
  const { addToast } = useToast();
  const [showRegModal, setShowRegModal] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [rotatedCreds, setRotatedCreds] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasSso = !!account?.oauth_client_id;

  const handleRotate = async () => {
    setRotating(true);
    try {
      const res = await api.post(`/accounts/${account.id}/sso/rotate-secret`);
      setRotatedCreds(res.data);
      addToast('Client secret rotated', 'success');
    } catch (err) {
      const detail = err.response?.data?.detail || 'Rotation failed';
      addToast(typeof detail === 'object' ? JSON.stringify(detail) : detail, 'danger');
    } finally {
      setRotating(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/accounts/${account.id}/sso`);
      addToast('SSO client removed', 'info');
      setConfirmDelete(false);
      onUpdate();
    } catch (err) {
      const detail = err.response?.data?.detail || 'Deletion failed';
      addToast(typeof detail === 'object' ? JSON.stringify(detail) : detail, 'danger');
    } finally {
      setDeleting(false);
    }
  };

  const copyClientId = async () => {
    try {
      await navigator.clipboard.writeText(account.oauth_client_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // noop
    }
  };

  return (
    <>
      <SSORegistrationModal
        isOpen={showRegModal}
        onClose={() => setShowRegModal(false)}
        account={account}
        onRegistered={onUpdate}
      />

      <ConfirmationModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Remove SSO Client?"
        message="This will delete the OIDC client from Sanctum Auth and revoke all associated tokens. This action cannot be undone."
        isDangerous={true}
      />

      <div className="p-5 bg-slate-900 border border-slate-700 rounded-xl">
        <h3 className="text-xs font-bold uppercase tracking-widest opacity-50 mb-3 flex items-center gap-2">
          <Shield size={12} /> Single Sign-On
        </h3>

        {rotatedCreds ? (
          <SSOCredentialReveal
            clientId={rotatedCreds.client_id}
            clientSecret={rotatedCreds.client_secret}
            onDone={() => { setRotatedCreds(null); onUpdate(); }}
          />
        ) : hasSso ? (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider opacity-40 block mb-1">Client ID</label>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono text-white break-all select-all">{account.oauth_client_id}</code>
                <button onClick={copyClientId} className="shrink-0 p-1 rounded hover:bg-slate-800 transition-colors" title="Copy">
                  {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-slate-500" />}
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleRotate}
                disabled={rotating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 border border-amber-500/30 text-xs font-bold transition-colors disabled:opacity-50"
              >
                {rotating ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
                Rotate Secret
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/30 text-xs font-bold transition-colors disabled:opacity-50"
              >
                {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Remove SSO
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowRegModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30 text-sm font-bold transition-colors"
          >
            <Shield size={16} />
            Enable SSO
          </button>
        )}
      </div>
    </>
  );
}
