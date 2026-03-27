import React, { useState } from 'react';
import { Copy, Check, AlertTriangle } from 'lucide-react';

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-HTTPS contexts
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-1">
      <label className="text-xs uppercase tracking-wider opacity-50">{label}</label>
      <div className="flex items-center gap-2 bg-slate-800 border border-slate-600 rounded px-3 py-2">
        <code className="flex-1 text-sm font-mono text-white break-all select-all">{value}</code>
        <button
          onClick={handleCopy}
          className="shrink-0 p-1 rounded hover:bg-slate-700 transition-colors"
          title={copied ? 'Copied' : 'Copy to clipboard'}
        >
          {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} className="text-slate-400" />}
        </button>
      </div>
    </div>
  );
}

export default function SSOCredentialReveal({ clientId, clientSecret, onDone }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-3 bg-red-900/30 border border-red-500/40 rounded-lg">
        <AlertTriangle size={20} className="text-red-400 shrink-0 mt-0.5" />
        <div className="text-sm text-red-200">
          <strong>The client secret will not be shown again.</strong> Copy it now and store it securely.
          If you lose it, you can generate a new one using "Rotate Secret".
        </div>
      </div>

      <CopyField label="Client ID" value={clientId} />
      <CopyField label="Client Secret" value={clientSecret} />

      <div className="pt-2">
        <button
          onClick={onDone}
          className="w-full px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
