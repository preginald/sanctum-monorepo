#!/bin/bash
# Ticket #185 — Add profile avatar link to Layout header

TARGET=~/Dev/DigitalSanctum/sanctum-web/src/components/Layout.jsx

echo "🔧 Adding profile avatar to header..."

python3 << 'PYEOF'
path = "/home/preginald/Dev/DigitalSanctum/sanctum-web/src/components/Layout.jsx"
with open(path, 'r') as f:
    content = f.read()

old = """            <button onClick={logout} className="p-2 hover:bg-white/10 rounded-full text-red-400 opacity-70 hover:opacity-100">
                <LogOut size={18} />
            </button>"""

new = """            <button onClick={() => navigate('/profile')} className="flex items-center gap-2 p-1.5 hover:bg-white/10 rounded-lg transition-colors group" title="Profile">
                <div className="w-7 h-7 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-[10px] font-bold text-slate-300 group-hover:border-sanctum-gold group-hover:text-sanctum-gold transition-colors">
                    {user?.full_name?.split(' ').map(n => n[0]).join('').slice(0,2) || '?'}
                </div>
            </button>
            <button onClick={logout} className="p-2 hover:bg-white/10 rounded-full text-red-400 opacity-70 hover:opacity-100">
                <LogOut size={18} />
            </button>"""

if old in content:
    content = content.replace(old, new)
    with open(path, 'w') as f:
        f.write(content)
    print("  ✓ Profile avatar added to header")
else:
    print("  ✗ Could not find logout button block")
PYEOF

# VERIFY
echo ""
echo "=== Verification ==="
grep -n "navigate.*profile\|full_name.*split" "$TARGET"
echo ""
cd ~/Dev/DigitalSanctum/sanctum-web && npx vite build 2>&1 | tail -3
