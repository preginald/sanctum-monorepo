import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../lib/api';
import { Loader2, ChevronLeft, ChevronRight, Clock, Calendar } from 'lucide-react';

export default function TimesheetView() {
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchWeek(); }, [offset]);

  const fetchWeek = async () => {
    setLoading(true);
    try {
        const res = await api.get(`/timesheets/my-week?offset=${offset}`);
        setData(res.data);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const getDayName = (dateStr) => {
      return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
  };

  return (
    <Layout title="My Timesheet">
      
      {/* HEADER CONTROLS */}
      <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4 bg-slate-900 border border-slate-700 rounded-lg p-1">
              <button onClick={() => setOffset(offset - 1)} className="p-2 hover:bg-white/10 rounded text-white"><ChevronLeft size={20}/></button>
              <div className="text-sm font-bold w-48 text-center flex items-center justify-center gap-2">
                  <Calendar size={16} className="text-sanctum-gold"/>
                  {data ? `${data.start_date} - ${data.end_date}` : 'Loading...'}
              </div>
              <button onClick={() => setOffset(offset + 1)} className="p-2 hover:bg-white/10 rounded text-white"><ChevronRight size={20}/></button>
          </div>
          
          <div className="bg-slate-900 border border-slate-700 rounded-lg px-6 py-2">
              <span className="text-xs uppercase font-bold text-slate-500 mr-2">Total Hours</span>
              <span className="text-xl font-mono font-bold text-white">{data?.total_hours || 0}h</span>
          </div>
      </div>

      {/* GRID */}
      {loading ? (
          <div className="flex justify-center p-20"><Loader2 className="animate-spin text-sanctum-gold" size={48}/></div>
      ) : (
          <div className="grid grid-cols-7 gap-4">
              {data?.days.map((day, i) => (
                  <div key={i} className={`flex flex-col h-[600px] rounded-xl border ${day.hours > 0 ? 'bg-slate-900 border-slate-700' : 'bg-slate-900/50 border-slate-800'}`}>
                      {/* Day Header */}
                      <div className="p-3 border-b border-slate-700 bg-black/20 text-center">
                          <div className="text-sm font-bold text-slate-300">{getDayName(day.date)}</div>
                          <div className={`text-xs font-mono mt-1 ${day.hours >= 8 ? 'text-green-400' : 'text-slate-500'}`}>
                              {day.hours}h
                          </div>
                      </div>

                      {/* Entries */}
                      <div className="flex-1 p-2 space-y-2 overflow-y-auto custom-scrollbar">
                          {day.entries.map(entry => (
                              <div 
                                key={entry.id} 
                                onClick={() => navigate(`/tickets/${entry.ticket_id}`)}
                                className="p-2 bg-blue-900/20 border border-blue-500/20 rounded cursor-pointer hover:bg-blue-900/40 transition-colors group"
                              >
                                  <div className="text-[10px] font-bold text-blue-300 truncate">#{entry.ticket_id}</div>
                                  <div className="text-xs text-white leading-tight my-1 line-clamp-2">{entry.description || "Work"}</div>
                                  <div className="text-[10px] text-right font-mono text-slate-400">{entry.hours}h</div>
                              </div>
                          ))}
                          {day.entries.length === 0 && (
                              <div className="h-full flex items-center justify-center opacity-10">
                                  <Clock size={24} />
                              </div>
                          )}
                      </div>
                  </div>
              ))}
          </div>
      )}
    </Layout>
  );
}
