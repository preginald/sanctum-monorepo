import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api'; 
import { formatDate, formatCurrency } from '../lib/formatters';
import { ArrowLeft, FileText, Download, CheckCircle, AlertCircle, Loader2, Server, MessageSquare, Send, BookOpen } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const PortalTicketDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  
  const [ticket, setTicket] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);
  
  // REPLY STATE
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  // Scroll to bottom when comments load or update
  useEffect(() => {
    if (ticket?.comments) scrollToBottom();
  }, [ticket?.comments]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

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

  const handlePostComment = async (e) => {
      e.preventDefault();
      if (!replyText.trim()) return;
      
      setSending(true);
      try {
          await api.post(`/portal/tickets/${id}/comments`, { body: replyText });
          setReplyText('');
          fetchData(); // Reload to see new message
          addToast("Reply sent", "success");
      } catch (e) {
          addToast("Failed to send reply", "danger");
      } finally {
          setSending(false);
      }
  };

  if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-white"><Loader2 className="animate-spin" /></div>;
  if (!ticket) return null;

  // --- DYNAMIC BRANDING LOGIC ---
  const isNaked = ticket.brand_affinity === 'nt';
  const theme = {
    bg: isNaked ? 'bg-slate-50' : 'bg-slate-900',
    card: isNaked ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-800 border-slate-700',
    textMain: isNaked ? 'text-slate-900' : 'text-white',
    textSub: isNaked ? 'text-slate-500' : 'text-slate-400',
    accent: isNaked ? 'text-naked-pink' : 'text-sanctum-gold',
    btn: isNaked ? 'bg-naked-pink hover:bg-pink-600 text-white' : 'bg-sanctum-gold hover:bg-yellow-500 text-slate-900',
    inputBg: isNaked ? 'bg-white border-slate-300 text-slate-900' : 'bg-black/20 border-slate-600 text-white',
    messageMe: isNaked ? 'bg-naked-pink text-white' : 'bg-sanctum-gold text-slate-900',
    messageOther: isNaked ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-slate-200',
    statusTag: (status) => {
        if (status === 'resolved') return 'bg-green-500/20 text-green-500';
        if (status === 'new') return 'bg-blue-500/20 text-blue-500';
        return 'bg-yellow-500/20 text-yellow-600';
    }
  };

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.textMain} p-8`}>
      <div className="max-w-6xl mx-auto space-y-8">
        
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT COLUMN: Main Content & Stream */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* RESOLUTION ALERT */}
            {ticket.resolution && (
              <div className={`p-6 rounded-xl border border-green-500/20 bg-green-500/5 mb-6`}>
                <div className="flex items-center gap-2 mb-4 text-green-500">
                  <CheckCircle className="w-5 h-5" />
                  <h3 className="text-xs font-bold uppercase tracking-widest">Resolution</h3>
                </div>
                <div className={`prose max-w-none ${isNaked ? 'prose-slate' : 'prose-invert'} whitespace-pre-wrap`}>
                  {ticket.resolution}
                </div>
              </div>
            )}

            {/* DESCRIPTION CARD */}
            <div className={`p-6 rounded-xl border ${theme.card}`}>
              <h3 className="text-xs font-bold uppercase tracking-widest opacity-50 mb-4">Initial Request</h3>
              <div className={`prose max-w-none ${isNaked ? 'prose-slate' : 'prose-invert'} whitespace-pre-wrap leading-relaxed`}>
                {ticket.description}
              </div>
            </div>

            {/* CONVERSATION STREAM */}
            <div className={`p-6 rounded-xl border ${theme.card}`}>
                <h3 className="text-xs font-bold uppercase tracking-widest opacity-50 mb-6 flex items-center gap-2">
                    <MessageSquare size={16} /> Conversation
                </h3>
                
                <div className="space-y-6 mb-8">
                    {ticket.comments?.length > 0 ? ticket.comments.map(comment => (
                        <div key={comment.id} className={`flex ${comment.is_me ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl p-4 ${comment.is_me ? theme.messageMe : theme.messageOther}`}>
                                <div className="flex justify-between items-baseline gap-4 mb-1">
                                    <span className="text-xs font-bold opacity-80">
                                        {comment.is_me ? 'You' : comment.author_name}
                                    </span>
                                    <span className="text-[10px] opacity-50 font-mono">
                                        {new Date(comment.created_at).toLocaleString()}
                                    </span>
                                </div>
                                <div className="whitespace-pre-wrap text-sm">
                                    {comment.body}
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="text-center opacity-30 italic text-sm py-4">No comments yet.</div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* REPLY BOX */}
                {ticket.status !== 'resolved' && (
                    <form onSubmit={handlePostComment} className="relative">
                        <textarea 
                            className={`w-full p-4 pr-12 rounded-xl border focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-all text-sm min-h-[100px] ${theme.inputBg} ${isNaked ? 'focus:ring-pink-500' : 'focus:ring-yellow-500'}`}
                            placeholder="Type your reply here..."
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            onKeyDown={e => {
                                if(e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handlePostComment(e);
                                }
                            }}
                        />
                        <button 
                            type="submit" 
                            disabled={sending || !replyText.trim()}
                            className={`absolute right-3 bottom-3 p-2 rounded-lg transition-colors ${sending || !replyText.trim() ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10'}`}
                        >
                            {sending ? <Loader2 size={20} className="animate-spin text-slate-400"/> : <Send size={20} className={isNaked ? 'text-pink-600' : 'text-sanctum-gold'}/>}
                        </button>
                    </form>
                )}
                {ticket.status === 'resolved' && (
                    <div className="text-center p-4 bg-black/5 dark:bg-white/5 rounded-lg border border-black/5 dark:border-white/5 text-sm opacity-70">
                        This ticket is resolved. Replies are disabled.
                    </div>
                )}
            </div>
          </div>

          {/* RIGHT COLUMN: Sidebar (Invoices & Assets) */}
          <div className="space-y-6">
            
            {/* INVOICES CARD */}
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

            {/* LINKED ARTICLES CARD */}
            {ticket.articles?.length > 0 && (
              <div className={`rounded-xl border ${theme.card} overflow-hidden`}>
                <div className={`p-4 border-b ${isNaked ? 'border-slate-200' : 'border-slate-700'} flex items-center justify-between`}>
                  <h3 className="font-bold text-sm uppercase tracking-widest opacity-70 flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Knowledge Articles
                  </h3>
                </div>
                <div className={`divide-y ${isNaked ? 'divide-slate-200' : 'divide-slate-700'}`}>
                  {ticket.articles.map(article => (
                    <a 
                      key={article.id}
                      href={`/wiki/${article.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-4 flex items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors block"
                    >
                      <div className={`p-2 rounded ${isNaked ? 'bg-slate-100' : 'bg-white/5'}`}>
                        <BookOpen size={16} className="opacity-50"/>
                      </div>
                      <div>
                        <div className="font-bold text-sm">{article.title}</div>
                        <div className="text-xs opacity-50 uppercase">{article.identifier || article.category}</div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* ASSETS CARD */}
            <div className={`rounded-xl border ${theme.card} overflow-hidden`}>
              <div className={`p-4 border-b ${isNaked ? 'border-slate-200' : 'border-slate-700'} flex items-center justify-between`}>
                <h3 className="font-bold text-sm uppercase tracking-widest opacity-70 flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  Affected Assets
                </h3>
              </div>
              
              {ticket.assets?.length > 0 ? (
                  <div className={`divide-y ${isNaked ? 'divide-slate-200' : 'divide-slate-700'}`}>
                      {ticket.assets.map(asset => (
                          <div key={asset.id} className="p-4 flex items-center gap-3">
                              <div className={`p-2 rounded ${isNaked ? 'bg-slate-100' : 'bg-white/5'}`}>
                                  <Server size={16} className="opacity-50"/>
                              </div>
                              <div>
                                  <div className="font-bold text-sm">{asset.name}</div>
                                  <div className="text-xs opacity-50 uppercase">{asset.type} • {asset.status}</div>
                              </div>
                          </div>
                      ))}
                  </div>
              ) : (
                  <div className={`p-8 text-center ${theme.textSub} text-sm`}>
                      No assets linked.
                  </div>
              )}
            </div>
            
            {/* SUPPORT BOX */}
            <div className={`p-4 rounded-xl border border-blue-500/20 bg-blue-500/5`}>
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <div className={`text-sm ${isNaked ? 'text-blue-900' : 'text-blue-200'}`}>
                  <p className="font-bold mb-1">Need help?</p>
                  <p className="opacity-80">
                    Replies to this ticket are monitored by our support team.
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