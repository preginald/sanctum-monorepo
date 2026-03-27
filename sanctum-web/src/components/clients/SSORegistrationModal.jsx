import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { Loader2 } from 'lucide-react';
import api from '../../lib/api';
import SSOCredentialReveal from './SSOCredentialReveal';

export default function SSORegistrationModal({ isOpen, onClose, account, onRegistered }) {
  const [form, setForm] = useState({
    display_name: '',
    redirect_uris: '',
    scopes: 'openid profile email',
    grant_types: 'authorization_code refresh_token',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [credentials, setCredentials] = useState(null);

  useEffect(() => {
    if (isOpen && account) {
      const defaultUri = account.website
        ? `${account.website.replace(/\/$/, '')}/auth/callback`
        : '';
      setForm({
        display_name: account.name || '',
        redirect_uris: defaultUri,
        scopes: 'openid profile email',
        grant_types: 'authorization_code refresh_token',
      });
      setError(null);
      setCredentials(null);
    }
  }, [isOpen, account]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const uris = form.redirect_uris
      .split('\n')
      .map(u => u.trim())
      .filter(Boolean);

    if (uris.length === 0) {
      setError('At least one redirect URI is required.');
      setLoading(false);
      return;
    }

    try {
      const res = await api.post(`/accounts/${account.id}/sso/register`, {
        display_name: form.display_name,
        redirect_uris: uris,
        scopes: form.scopes,
        grant_types: form.grant_types,
      });
      setCredentials(res.data);
    } catch (err) {
      const detail = err.response?.data?.detail || 'Registration failed. Please try again.';
      setError(typeof detail === 'object' ? JSON.stringify(detail) : detail);
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    setCredentials(null);
    onRegistered();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={credentials ? handleDone : onClose} title={credentials ? 'SSO Client Registered' : 'Register SSO Client'} maxWidth="max-w-lg">
      {credentials ? (
        <SSOCredentialReveal
          clientId={credentials.client_id}
          clientSecret={credentials.client_secret}
          onDone={handleDone}
        />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-500/40 rounded text-sm text-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs uppercase tracking-wider opacity-50 block mb-1">Display Name</label>
            <input
              className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white"
              value={form.display_name}
              onChange={e => setForm({ ...form, display_name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider opacity-50 block mb-1">
              Redirect URIs <span className="opacity-50">(one per line)</span>
            </label>
            <textarea
              className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white font-mono"
              rows={3}
              value={form.redirect_uris}
              onChange={e => setForm({ ...form, redirect_uris: e.target.value })}
              placeholder="https://example.com/auth/callback"
              required
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider opacity-50 block mb-1">Scopes</label>
            <input
              className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white font-mono"
              value={form.scopes}
              onChange={e => setForm({ ...form, scopes: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider opacity-50 block mb-1">Grant Types</label>
            <input
              className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white font-mono"
              value={form.grant_types}
              onChange={e => setForm({ ...form, grant_types: e.target.value })}
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-colors disabled:opacity-50"
            >
              {loading && <Loader2 className="animate-spin" size={16} />}
              Register Client
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
