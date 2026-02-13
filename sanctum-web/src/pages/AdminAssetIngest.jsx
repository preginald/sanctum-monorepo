import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../lib/api';
import { Terminal, Copy, Check, ShieldCheck, Monitor, Smartphone, Apple } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function AdminAssetIngest() {
    const [accounts, setAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState('');
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(null);
    const { addToast } = useToast();

    useEffect(() => {
        api.get('/accounts').then(res => {
            setAccounts(res.data);
            setLoading(false);
        });
    }, []);

    const account = accounts.find(a => a.id === selectedAccount);
    const apiBase = window.location.origin.replace('5173', '8000') + '/api/ingest/asset';
    const token = account?.ingest_token || 'YOUR_TOKEN_HERE';

    const copyToClipboard = (text, key) => {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
        addToast("Script copied to clipboard", "success");
    };

    const scripts = {
        windows: `$token = "${token}"
$api = "${apiBase}/$token"
$sys = Get-CimInstance Win32_ComputerSystem
$os = Get-CimInstance Win32_OperatingSystem
$cpu = Get-CimInstance Win32_Processor
$bios = Get-CimInstance Win32_BIOS
$chassis = (Get-CimInstance Win32_SystemEnclosure).ChassisTypes
$type = if ($chassis -match "9|10|14") { "laptop" } else { "workstation" }
$payload = @{
    name = $sys.Name; asset_type = $type; serial_number = $bios.SerialNumber
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
        <Layout title="Asset Ingest Agent">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl">
                    <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                        <ShieldCheck className="text-sanctum-blue" />
                        1. Select Client Context
                    </h2>
                    <select 
                        className="w-full p-3 bg-black/40 border border-slate-600 rounded-lg text-white"
                        value={selectedAccount}
                        onChange={(e) => setSelectedAccount(e.target.value)}
                    >
                        <option value="">-- Choose a Client --</option>
                        {accounts.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                </div>

                {selectedAccount && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4">
                        {/* WINDOWS CARD */}
                        <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                            <div className="p-4 bg-blue-600/10 border-b border-blue-500/20 flex justify-between items-center">
                                <div className="flex items-center gap-2 font-bold text-blue-400">
                                    <Monitor size={18} /> Windows (PowerShell)
                                </div>
                                <button onClick={() => copyToClipboard(scripts.windows, 'win')} className="p-2 hover:bg-white/10 rounded">
                                    {copied === 'win' ? <Check size={16} className="text-green-400"/> : <Copy size={16}/>}
                                </button>
                            </div>
                            <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto h-48 bg-black/20">
                                {scripts.windows}
                            </pre>
                        </div>

                        {/* LINUX CARD */}
                        <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                            <div className="p-4 bg-orange-600/10 border-b border-orange-500/20 flex justify-between items-center">
                                <div className="flex items-center gap-2 font-bold text-orange-400">
                                    <Terminal size={18} /> Linux (Bash)
                                </div>
                                <button onClick={() => copyToClipboard(scripts.linux, 'nix')} className="p-2 hover:bg-white/10 rounded">
                                    {copied === 'nix' ? <Check size={16} className="text-green-400"/> : <Copy size={16}/>}
                                </button>
                            </div>
                            <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto h-48 bg-black/20">
                                {scripts.linux}
                            </pre>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}