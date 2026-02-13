// ASSET INTELLIGENCE CONFIGURATION

// 1. DYNAMIC FIELD DEFINITIONS
export const SPEC_FIELDS = {
    // COMPUTING
    'workstation': [
        { key: 'os', label: 'OS Version', placeholder: 'Windows 11 Pro' },
        { key: 'cpu', label: 'Processor', placeholder: 'Intel i7-12700' },
        { key: 'ram', label: 'RAM', placeholder: '16GB' },
        { key: 'storage', label: 'Storage', placeholder: '512GB SSD' },
        { key: 'model', label: 'Model No.', placeholder: 'Dell OptiPlex 7090' }
    ],
    'laptop': [
        { key: 'os', label: 'OS Version', placeholder: 'macOS Sonoma' },
        { key: 'cpu', label: 'Processor', placeholder: 'M2 Pro' },
        { key: 'ram', label: 'RAM', placeholder: '16GB' },
        { key: 'storage', label: 'Storage', placeholder: '1TB SSD' },
        { key: 'model', label: 'Model No.', placeholder: 'MacBook Pro 14"' }
    ],
    'server': [
        { key: 'os', label: 'OS / Hypervisor', placeholder: 'Windows Server 2022' },
        { key: 'cpu', label: 'CPU Cores', placeholder: '2x Xeon Gold (32 Cores)' },
        { key: 'ram', label: 'RAM', placeholder: '128GB ECC' },
        { key: 'storage', label: 'RAID Config', placeholder: 'RAID 10 (4x 4TB)' },
        { key: 'role', label: 'Primary Role', placeholder: 'Domain Controller / File' }
    ],
    // MOBILE
    'iphone': [
        { key: 'os', label: 'iOS Version', placeholder: 'iOS 17.4' },
        { key: 'model', label: 'Model', placeholder: 'iPhone 15 Pro' },
        { key: 'storage', label: 'Capacity', placeholder: '256GB' },
        { key: 'imei', label: 'IMEI', placeholder: '3530...' },
        { key: 'carrier', label: 'Carrier', placeholder: 'Telstra / Verizon' }
    ],
    'android phone': [
        { key: 'os', label: 'Android Version', placeholder: 'Android 14' },
        { key: 'model', label: 'Model', placeholder: 'Samsung S24 Ultra' },
        { key: 'storage', label: 'Capacity', placeholder: '256GB' },
        { key: 'imei', label: 'IMEI', placeholder: '3530...' },
        { key: 'carrier', label: 'Carrier', placeholder: 'Telstra / Verizon' }
    ],
    'ipad': [
        { key: 'os', label: 'iPadOS Version', placeholder: 'iPadOS 17' },
        { key: 'model', label: 'Model', placeholder: 'iPad Air 5th Gen' },
        { key: 'storage', label: 'Capacity', placeholder: '64GB' },
        { key: 'wifi_only', label: 'Connectivity', placeholder: 'Wi-Fi + Cellular' }
    ],
    'android tablet': [
        { key: 'os', label: 'Android Version', placeholder: 'Android 13' },
        { key: 'model', label: 'Model', placeholder: 'Galaxy Tab S9' },
        { key: 'storage', label: 'Capacity', placeholder: '128GB' },
        { key: 'wifi_only', label: 'Connectivity', placeholder: 'Wi-Fi Only' }
    ],
    // PERIPHERALS
    'printer': [
        { key: 'model', label: 'Model', placeholder: 'HP LaserJet Pro M404n' },
        { key: 'ip_address', label: 'IP Address', placeholder: '192.168.1.50' },
        { key: 'toner_type', label: 'Toner / Ink Model', placeholder: 'HP 58A Black' },
        { key: 'connection', label: 'Connection', placeholder: 'Ethernet / USB' }
    ],
    // NETWORK
    'firewall': [
        { key: 'firmware', label: 'Firmware Version', placeholder: 'v7.4.3' },
        { key: 'model', label: 'Model', placeholder: 'FortiGate 60F' },
        { key: 'management_url', label: 'Management URL', placeholder: 'https://192.168.1.1:8443' },
        { key: 'licenses', label: 'Active Services', placeholder: 'IPS, AV, Web Filter' }
    ],
    'network': [
        { key: 'firmware', label: 'Firmware', placeholder: 'UniFi OS 3.2' },
        { key: 'model', label: 'Model', placeholder: 'USW-Pro-24-PoE' },
        { key: 'poe_budget', label: 'PoE Budget', placeholder: '400W' }
    ],
    // DIGITAL / SECURITY
    'security software': [
        { key: 'license_key', label: 'License Key', placeholder: 'XXXX-XXXX-XXXX-XXXX' },
        { key: 'seats_total', label: 'Total Seats', placeholder: '5' },
        { key: 'seats_used', label: 'Used Seats', placeholder: '4' },
        { key: 'admin_url', label: 'Management Portal', placeholder: 'https://cl.trendmicro.com...' }
    ],
    'saas': [
        { key: 'seats', label: 'Seat Count', placeholder: '15 Users' },
        { key: 'admin_url', label: 'Login URL', placeholder: 'https://admin.microsoft.com' },
        { key: 'plan', label: 'Plan Level', placeholder: 'Business Premium' }
    ],
    'hosting web': [
        { key: 'url', label: 'Website URL', placeholder: 'https://client.com' },
        { key: 'server_ip', label: 'Server IP', placeholder: '203.0.113.1' },
        { key: 'control_panel', label: 'CP URL', placeholder: 'https://server.com:2083' }
    ],
    'hosting email': [
        { key: 'mail_server', label: 'Mail Server', placeholder: 'mail.client.com' },
        { key: 'webmail_url', label: 'Webmail URL', placeholder: 'https://webmail.client.com' },
        { key: 'accounts', label: 'Active Accounts', placeholder: '10' }
    ]
};

// 2. PLACEHOLDER LOGIC
export const getAssetPlaceholder = (type) => {
    switch (type) {
        // Digital
        case 'domain': return 'e.g. digitalsanctum.com.au';
        case 'hosting web': return 'e.g. Corporate Website';
        case 'hosting email': return 'e.g. Google Workspace / M365';
        case 'saas': return 'e.g. Xero / Salesforce';
        case 'software': return 'e.g. Adobe Creative Cloud';
        case 'license': return 'e.g. AutoCAD 2024';
        case 'security software': return 'e.g. CrowdStrike Falcon';
        
        // Mobile
        case 'iphone': return 'e.g. CEO iPhone 15';
        case 'android phone': return 'e.g. Site Manager Pixel';
        case 'ipad': return 'e.g. Reception Kiosk iPad';
        case 'android tablet': return 'e.g. Warehouse Tablet';
        
        // Hardware
        case 'laptop': return 'e.g. J.Smith MacBook Pro';
        case 'workstation': return 'e.g. Reception PC';
        case 'server': return 'e.g. FILE-SRV-01';
        case 'printer': return 'e.g. Office Canon MFP';
        case 'firewall': return 'e.g. GATEWAY-01';
        case 'network': return 'e.g. Core Switch';
        
        default: return 'e.g. Asset Name';
    }
};

// 3. VENDOR LABEL LOGIC
export const getVendorLabel = (type) => {
    if (type === 'hosting web' || type === 'hosting email') return "Hosting Provider";
    if (type === 'saas') return "Platform Provider";
    return "Vendor / Registrar";
};

// 4. VENDOR PLACEHOLDER LOGIC
export const getVendorPlaceholder = (type) => {
    if (type === 'hosting web' || type === 'hosting email') return "e.g. Digital Sanctum VPS / Google";
    if (type === 'saas') return "e.g. Microsoft";
    if (type === 'software') return "e.g. Adobe";
    return "e.g. GoDaddy / VentraIP";
};

// 5. LIFECYCLE DETECTION
export const isLifecycleAsset = (type) => {
    return ['domain', 'hosting web', 'hosting email', 'license', 'software', 'saas', 'security software'].includes(type);
};

// 6. ICON HELPER (Optional, requires Lucide imports in component, so usually kept in component or separate UI util)
// Kept in component for simplicity of JSX imports