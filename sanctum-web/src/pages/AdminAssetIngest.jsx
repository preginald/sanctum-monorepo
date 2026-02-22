import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../lib/api';
import { Terminal, Copy, Check, ShieldCheck, Monitor } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function AdminAssetIngest() {
    const [accounts, setAccounts] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
    const [selectedAccount, setSelectedAccount] = useState('');
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(null);
    const { addToast } = useToast();

    useEffect(() => {
        api.get('/accounts').then(res => {
            setAccounts(res.data);
            setLoading(false);
        });
    }, [refreshKey]);

    // 1. Ensure we compare as strings to avoid type mismatches
    const account = accounts.find(a => String(a.id) === String(selectedAccount));
    
    const apiBase = `${window.location.origin}/api/ingest/asset`;
    
    // 2. Add a check to see if the token actually exists on the object
    const token = account?.ingest_token || (selectedAccount ? 'TOKEN_NOT_FOUND_IN_DB' : 'SELECT_A_CLIENT');

    const copyToClipboard = (text, key) => {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
        addToast("Agent script copied!", "success");
    };

    const scripts = {
        windows: `$token = "${token}"
$api = "${apiBase}/$token"
$sys = Get-CimInstance Win32_ComputerSystem
$os = Get-CimInstance Win32_OperatingSystem
$cpu = Get-CimInstance Win32_Processor
$bios = Get-CimInstance Win32_BIOS
$payload = @{
    name = $sys.Name; asset_type = "workstation"; serial_number = $bios.SerialNumber
    specs = @{ os = $os.Caption; cpu = $cpu.Name; ram = "$([math]::Round($sys.TotalPhysicalMemory / 1GB))GB"; model = "$($sys.Manufacturer) $($sys.Model)" }
}
Invoke-RestMethod -Uri $api -Method Post -Body ($payload | ConvertTo-Json) -ContentType "application/json"`,

        linux: `TOKEN="${token}"
API="${apiBase}/$TOKEN"
PAYLOAD=$(cat <<EOF
{
  "name": "$(hostname)",
  "asset_type": "workstation",
  "specs": { 
    "os": "$(grep PRETTY_NAME /etc/os-release | cut -d'"' -f2)", 
    "cpu": "$(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2 | xargs)",
    "ram": "$(free -g | awk '/^Mem:/{print $2"GB"}')"
  }
}
EOF
)
curl -X POST "$API" -H "Content-Type: application/json" -d "$PAYLOAD"`
    };

    return (
        <Layout onRefresh={() => setRefreshKey(prev => prev + 1)} title="The Ingest Agent">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow-2xl">
                    <h2 className="text-xl font-bold flex items-center gap-2 mb-4 text-sanctum-blue">
                        <ShieldCheck /> 1. Select Client Context
                    </h2>
                    <select 
                        className="w-full p-3 bg-black/40 border border-slate-600 rounded-lg text-white focus:border-sanctum-blue outline-none transition-all"
                        value={selectedAccount}
                        onChange={(e) => setSelectedAccount(e.target.value)}
                    >
                        <option value="">-- Choose a Client to Generate Tokenized Script --</option>
                        {accounts.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                </div>

                {selectedAccount && (
                    <div className="grid grid-cols-1 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* LINUX/BASH */}
                        <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                            <div className="p-4 bg-orange-600/10 border-b border-orange-500/20 flex justify-between items-center">
                                <div className="flex items-center gap-2 font-bold text-orange-400">
                                    <Terminal size={18} /> Linux / macOS (Bash)
                                </div>
                                <button onClick={() => copyToClipboard(scripts.linux, 'nix')} className="flex items-center gap-2 px-3 py-1 bg-orange-500/20 hover:bg-orange-500/40 rounded-lg text-xs transition-all">
                                    {copied === 'nix' ? <Check size={14}/> : <Copy size={14}/>} 
                                    {copied === 'nix' ? 'Copied' : 'Copy Script'}
                                </button>
                            </div>
                            <pre className="p-6 text-[11px] font-mono text-slate-300 overflow-x-auto bg-black/40 leading-relaxed">
                                {scripts.linux}
                            </pre>
                        </div>

                        {/* WINDOWS/POWERSHELL */}
                        <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                            <div className="p-4 bg-blue-600/10 border-b border-blue-500/20 flex justify-between items-center">
                                <div className="flex items-center gap-2 font-bold text-blue-400">
                                    <Monitor size={18} /> Windows (PowerShell)
                                </div>
                                <button onClick={() => copyToClipboard(scripts.windows, 'win')} className="flex items-center gap-2 px-3 py-1 bg-blue-500/20 hover:bg-blue-500/40 rounded-lg text-xs transition-all">
                                    {copied === 'win' ? <Check size={14}/> : <Copy size={14}/>} 
                                    {copied === 'win' ? 'Copied' : 'Copy Script'}
                                </button>
                            </div>
                            <pre className="p-6 text-[11px] font-mono text-slate-300 overflow-x-auto bg-black/40 leading-relaxed">
                                {scripts.windows}
                            </pre>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}