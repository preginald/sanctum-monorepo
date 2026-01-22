import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { Loader2, CheckCircle } from 'lucide-react';

export default function ResolveModal({ isOpen, onClose, onResolve, loading, initialValue = ''  }) {
  const [resolution, setResolution] = useState('');

  useEffect(() => {
      if (isOpen && initialValue) {
          setResolution(initialValue);
      } else if (isOpen && !initialValue) {
          setResolution('');
      }
  }, [isOpen, initialValue]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onResolve(resolution);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Resolve Ticket">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-lg text-sm text-blue-200">
          <strong>Protocol Check:</strong> Please document the solution. This will be searchable in the future to help other technicians.
        </div>

        <div>
          <label className="text-xs opacity-50 block mb-1">Resolution Details (Markdown Supported)</label>
          <textarea 
            autoFocus
            required
            className="w-full p-4 h-48 bg-slate-800 border border-slate-600 rounded text-white font-mono text-sm leading-relaxed"
            placeholder="e.g. Fixed by updating the API endpoint to use Decimal types..."
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white text-sm"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={loading || !resolution.trim()} 
            className="flex items-center gap-2 px-6 py-2 rounded bg-green-600 hover:bg-green-500 text-white font-bold text-sm shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={16} className="animate-spin"/> : <><CheckCircle size={16}/> Confirm Resolution</>}
          </button>
        </div>
      </form>
    </Modal>
  );
}