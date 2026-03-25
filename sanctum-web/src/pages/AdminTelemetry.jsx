import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import MetadataStrip from '../components/ui/MetadataStrip';
import api from '../lib/api';
import { Loader2 } from 'lucide-react';

const LIMIT = 50;

const GROUP_LABELS = {
  tool_name: 'Tool',
  agent_persona: 'Agent Persona',
  cost_tier: 'Cost Tier',
};

const WINDOW_OPTIONS = [
  { value: '1d', label: '1 day' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

function formatBytes(val) {
  if (val == null) return '\u2014';
  return val > 1024 ? `${(val / 1024).toFixed(1)} KB` : `${Math.round(val)} B`;
}

function formatDatetime(iso) {
  if (!iso) return '\u2014';
  const d = new Date(iso);
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function AdminTelemetry() {
  const [searchParams, setSearchParams] = useSearchParams();
  const timeWindow = searchParams.get('window') || '7d';
  const groupBy = searchParams.get('group_by') || 'tool_name';
  const logOffset = parseInt(searchParams.get('offset') || '0', 10);

  // Local state for text inputs (debounced before writing to URL)
  const [logToolInput, setLogToolInput] = useState(searchParams.get('log_tool') || '');
  const [logPersonaInput, setLogPersonaInput] = useState(searchParams.get('log_persona') || '');
  const [logSessionInput, setLogSessionInput] = useState(searchParams.get('log_session') || '');

  const debouncedTool = useDebounce(logToolInput, 300);
  const debouncedPersona = useDebounce(logPersonaInput, 300);
  const debouncedSession = useDebounce(logSessionInput, 300);

  // Data state
  const [stats, setStats] = useState([]);
  const [calls, setCalls] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [callsLoading, setCallsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Sync debounced text filters back to URL (and reset offset)
  const prevFiltersRef = useRef({ tool: debouncedTool, persona: debouncedPersona, session: debouncedSession });
  useEffect(() => {
    const prev = prevFiltersRef.current;
    if (prev.tool !== debouncedTool || prev.persona !== debouncedPersona || prev.session !== debouncedSession) {
      prevFiltersRef.current = { tool: debouncedTool, persona: debouncedPersona, session: debouncedSession };
      setSearchParams(p => {
        const next = new URLSearchParams(p);
        debouncedTool ? next.set('log_tool', debouncedTool) : next.delete('log_tool');
        debouncedPersona ? next.set('log_persona', debouncedPersona) : next.delete('log_persona');
        debouncedSession ? next.set('log_session', debouncedSession) : next.delete('log_session');
        next.delete('offset');
        return next;
      }, { replace: true });
    }
  }, [debouncedTool, debouncedPersona, debouncedSession, setSearchParams]);

  // Read final filter values from URL for API calls
  const logTool = searchParams.get('log_tool') || '';
  const logPersona = searchParams.get('log_persona') || '';
  const logSession = searchParams.get('log_session') || '';

  // Fetch stats
  useEffect(() => {
    setStatsLoading(true);
    api.get('/mcp/telemetry/stats', { params: { window: timeWindow, group_by: groupBy } })
      .then(r => setStats(r.data))
      .catch(() => setStats([]))
      .finally(() => setStatsLoading(false));
  }, [timeWindow, groupBy, refreshKey]);

  // Fetch calls
  useEffect(() => {
    setCallsLoading(true);
    const params = { window: timeWindow, limit: LIMIT, offset: logOffset };
    if (logTool) params.tool_name = logTool;
    if (logPersona) params.agent_persona = logPersona;
    if (logSession) params.session_id = logSession;
    api.get('/mcp/telemetry/calls', { params })
      .then(r => setCalls(r.data))
      .catch(() => setCalls([]))
      .finally(() => setCallsLoading(false));
  }, [timeWindow, logTool, logPersona, logSession, logOffset, refreshKey]);

  // Param setters
  const setParam = useCallback((key, val, resetOffset = false) => {
    setSearchParams(p => {
      const next = new URLSearchParams(p);
      val ? next.set(key, val) : next.delete(key);
      if (resetOffset) next.delete('offset');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // MetadataStrip summary
  const totalCalls = stats.reduce((s, r) => s + r.call_count, 0);
  const totalErrors = stats.reduce((s, r) => s + (r.error_count || 0), 0);

  const selectClass = 'bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sanctum-gold';
  const inputClass = 'bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-sanctum-gold placeholder:text-slate-500';

  return (
    <Layout
      onRefresh={() => setRefreshKey(k => k + 1)}
      title="MCP Telemetry"
    >
      <MetadataStrip
        storageKey="telemetry-meta"
        collapsed={
          <>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-sanctum-gold/10 text-sanctum-gold border border-sanctum-gold/20">{timeWindow}</span>
            <span className="text-slate-400">grouped by</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-white/10 text-slate-300">{GROUP_LABELS[groupBy]}</span>
            <span className="text-slate-500">{totalCalls.toLocaleString()} calls</span>
          </>
        }
        badges={[
          { label: timeWindow, mono: true },
          { label: GROUP_LABELS[groupBy], className: 'bg-cyan-500/20 text-cyan-400' },
        ]}
        rows={[
          { label: 'Total Calls', value: totalCalls.toLocaleString() },
          { label: 'Total Errors', value: totalErrors.toLocaleString(), gold: totalErrors > 0 },
          { label: 'Last Refresh', value: new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) },
        ]}
        className="mb-6"
      />

      {/* === STATS SECTION === */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Aggregated Stats</h2>
          <select value={timeWindow} onChange={e => setParam('window', e.target.value, true)} className={selectClass}>
            {WINDOW_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={groupBy} onChange={e => setParam('group_by', e.target.value)} className={selectClass}>
            {Object.entries(GROUP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {statsLoading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-8"><Loader2 className="animate-spin" size={16} /> Loading stats...</div>
        ) : stats.length === 0 ? (
          <div className="text-slate-500 text-sm py-8">No telemetry data for this window.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{GROUP_LABELS[groupBy]}</TableHead>
                <TableHead className="text-right">Calls</TableHead>
                <TableHead className="text-right">Avg Latency</TableHead>
                <TableHead className="text-right">P95 Latency</TableHead>
                <TableHead className="text-right">Avg Response</TableHead>
                <TableHead className="text-right">Errors</TableHead>
                <TableHead className="text-right">Token Est.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{r.tool_name}</TableCell>
                  <TableCell className="text-right">{r.call_count.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{r.avg_latency_ms}ms</TableCell>
                  <TableCell className="text-right">{r.p95_latency_ms != null ? `${r.p95_latency_ms}ms` : '\u2014'}</TableCell>
                  <TableCell className="text-right">{formatBytes(r.avg_response_bytes)}</TableCell>
                  <TableCell className={`text-right ${r.error_count > 0 ? 'text-red-400' : ''}`}>
                    {r.error_count}{r.error_rate > 0 ? ` (${r.error_rate}%)` : ''}
                  </TableCell>
                  <TableCell className="text-right">{r.total_token_estimate != null ? r.total_token_estimate.toLocaleString() : '\u2014'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* === CALL LOG SECTION === */}
      <div>
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">Call Log</h2>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <input
            type="text"
            placeholder="Filter tool name..."
            value={logToolInput}
            onChange={e => setLogToolInput(e.target.value)}
            className={inputClass}
          />
          <input
            type="text"
            placeholder="Filter agent persona..."
            value={logPersonaInput}
            onChange={e => setLogPersonaInput(e.target.value)}
            className={inputClass}
          />
          <input
            type="text"
            placeholder="Filter session ID..."
            value={logSessionInput}
            onChange={e => setLogSessionInput(e.target.value)}
            className={inputClass}
          />
        </div>

        {callsLoading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-8"><Loader2 className="animate-spin" size={16} /> Loading calls...</div>
        ) : calls.length === 0 ? (
          <div className="text-slate-500 text-sm py-8">No call records found.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Tool</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Latency</TableHead>
                <TableHead className="text-right">Bytes</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="text-xs whitespace-nowrap">{formatDatetime(c.called_at)}</TableCell>
                  <TableCell className="font-mono text-xs">{c.tool_name}</TableCell>
                  <TableCell className="text-xs">{c.agent_persona || '\u2014'}</TableCell>
                  <TableCell className="text-xs">{c.cost_tier || '\u2014'}</TableCell>
                  <TableCell className="text-right text-xs">{c.latency_ms}ms</TableCell>
                  <TableCell className="text-right text-xs">{c.response_bytes != null ? formatBytes(c.response_bytes) : '\u2014'}</TableCell>
                  <TableCell>
                    <span className={`text-xs font-bold ${c.status === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                      {c.status}
                    </span>
                    {c.status === 'error' && c.error_message && (
                      <span className="text-[10px] text-red-300/70 ml-2" title={c.error_message}>
                        {c.error_message.length > 40 ? c.error_message.slice(0, 40) + '...' : c.error_message}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        {calls.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-slate-500">
            Showing {logOffset + 1}&ndash;{logOffset + calls.length}
          </span>
          <div className="flex gap-2">
            <button
              disabled={logOffset === 0}
              onClick={() => setParam('offset', String(Math.max(0, logOffset - LIMIT)))}
              className="px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded disabled:opacity-30 hover:bg-slate-700 transition-colors"
            >
              Prev
            </button>
            <button
              disabled={calls.length < LIMIT}
              onClick={() => setParam('offset', String(logOffset + LIMIT))}
              className="px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded disabled:opacity-30 hover:bg-slate-700 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
        )}
      </div>
    </Layout>
  );
}
