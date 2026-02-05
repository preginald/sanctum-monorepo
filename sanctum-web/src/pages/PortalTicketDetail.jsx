import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api'; 
import { formatDate, formatCurrency } from '../lib/formatters';
import { ArrowLeft, FileText, Download, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const PortalTicketDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  
  const [ticket, setTicket] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [ticketRes, invoiceRes] = await Promise.all([
        api.get(`/portal/tickets/${id}`),
        api.get(`/portal/tickets/${id}/invoices`)
      ]);
      setTicket(ticketRes.data);
      setInvoices(invoiceRes.data);
    } catch (error) {
      console.error("Failed to fetch portal data", error);
      if (error.response && (error.response.status === 403 || error.response.status === 404)) {
        navigate('/portal');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = async (invoiceId) => {
    setDownloading(invoiceId);
    try {
      const response = await api.get(`/portal/invoices/${invoiceId}/download`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Invoice_${invoiceId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      addToast("Invoice downloaded", "success");
    } catch (error) {
      console.error("Download failed", error);
      addToast("Failed to download invoice", "error");
    } finally {
      setDownloading(null);
    }
  };

  if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-white"><Loader2 className="animate-spin" /></div>;
  if (!ticket) return null;

  // --- DYNAMIC BRANDING LOGIC (MATCHING DASHBOARD) ---
  const isNaked = ticket.brand_affinity === 'nt';
  const theme = {
    bg: isNaked ? 'bg-slate-50' : 'bg-slate-900',
    card: isNaked ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-800 border-slate-700',
    textMain: isNaked ? 'text-slate-900' : 'text-white',
    textSub: isNaked ? 'text-slate-500' : 'text-slate-400',
    accent: isNaked ? 'text-naked-pink' : 'text-sanctum-gold',
    btn: isNaked ? 'bg-naked-pink hover:bg-pink-600 text-white' : 'bg-sanctum-gold hover:bg-yellow-500 text-slate-900',
    statusTag: (status) => {
        if (status === 'resolved') return 'bg-green-500/20 text-green-500';
        if (status === 'new') return 'bg-blue-500/20 text-blue-500';
        return 'bg-yellow-500/20 text-yellow-600';
    }
  };

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.textMain} p-8`}>
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header / Nav */}
        <button 
          onClick={() => navigate('/portal')}
          className={`flex items-center ${theme.textSub} hover:${theme.textMain} transition-colors`}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </button>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">Ticket #{ticket.id}</h1>
              <span className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider ${theme.statusTag(ticket.status)}`}>
                {ticket.status}
              </span>
            </div>
            <h2 className={`text-xl ${theme.textSub}`}>{ticket.subject}</h2>
          </div>
          <div className={`text-sm ${theme.textSub} font-mono`}>
             Opened {formatDate(ticket.created_at)}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Main Content: Description & Resolution */}
          <div className="md:col-span-2 space-y-6">
            <div className={`p-6 rounded-xl border ${theme.card}`}>
              <h3 className="text-xs font-bold uppercase tracking-widest opacity-50 mb-4">Description</h3>
              <div className={`prose max-w-none ${isNaked ? 'prose-slate' : 'prose-invert'} whitespace-pre-wrap leading-relaxed`}>
                {ticket.description}
              </div>
            </div>

            {ticket.resolution && (
              <div className={`p-6 rounded-xl border border-green-500/20 bg-green-500/5`}>
                <div className="flex items-center gap-2 mb-4 text-green-500">
                  <CheckCircle className="w-5 h-5" />
                  <h3 className="text-xs font-bold uppercase tracking-widest">Resolution</h3>
                </div>
                <div className={`prose max-w-none ${isNaked ? 'prose-slate' : 'prose-invert'} whitespace-pre-wrap`}>
                  {ticket.resolution}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar: Invoices */}
          <div className="space-y-6">
            <div className={`rounded-xl border ${theme.card} overflow-hidden`}>
              <div className={`p-4 border-b ${isNaked ? 'border-slate-200' : 'border-slate-700'} flex items-center justify-between`}>
                <h3 className="font-bold text-sm uppercase tracking-widest opacity-70 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Related Invoices
                </h3>
              </div>
              
              {invoices.length === 0 ? (
                <div className={`p-8 text-center ${theme.textSub} text-sm`}>
                  No invoices linked to this ticket.
                </div>
              ) : (
                <div className={`divide-y ${isNaked ? 'divide-slate-200' : 'divide-slate-700'}`}>
                  {invoices.map((inv) => (
                    <div key={inv.id} className={`p-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors`}>
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-mono font-bold">
                          {formatCurrency(inv.total_amount)}
                        </span>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                          inv.status === 'paid' ? 'bg-green-500/20 text-green-500' : 'bg-orange-500/20 text-orange-500'
                        }`}>
                          {inv.status}
                        </span>
                      </div>
                      <div className={`text-xs ${theme.textSub} mb-3`}>
                        Due: {formatDate(inv.due_date)}
                      </div>
                      
                      {inv.pdf_generated ? (
                        <button
                          onClick={() => handleDownloadInvoice(inv.id)}
                          disabled={downloading === inv.id}
                          className={`w-full flex items-center justify-center gap-2 text-xs py-2 rounded font-medium transition-colors border ${
                            isNaked 
                              ? 'border-slate-300 hover:bg-slate-100 text-slate-700' 
                              : 'border-slate-600 hover:bg-slate-700 text-slate-300'
                          } disabled:opacity-50`}
                        >
                          {downloading === inv.id ? (
                            <span className="animate-pulse">Downloading...</span>
                          ) : (
                            <>
                              <Download className="w-3 h-3" />
                              Download PDF
                            </>
                          )}
                        </button>
                      ) : (
                        <div className={`text-xs ${theme.textSub} italic text-center py-1`}>
                          PDF generating...
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className={`p-4 rounded-xl border border-blue-500/20 bg-blue-500/5`}>
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <div className={`text-sm ${isNaked ? 'text-blue-900' : 'text-blue-200'}`}>
                  <p className="font-bold mb-1">Have questions?</p>
                  <p className="opacity-80">
                    If you have queries about this ticket or invoice, please reply to the notification email.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortalTicketDetail;