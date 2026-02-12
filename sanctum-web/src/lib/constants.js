// CRM
export const CONTACT_PERSONAS = [
    "Primary Contact",
    "Billing Lead",
    "Technical Lead",
    "Executive Sponsor",
    "Internal Champion",
    "Gatekeeper",
    "End User"
];

export const DEAL_STAGES = [
    "Infiltration",
    "Accession",
    "Negotiation",
    "Closed Won",
    "Lost"
];

// OPERATIONS (TICKETS)
export const TICKET_PRIORITIES = [
    "low",
    "normal",
    "high",
    "critical"
];

export const TICKET_STATUSES = [
    "new",
    "open",
    "pending",
    "qa",       // Added QA status
    "resolved"
];

export const TICKET_TYPES = [
    "support",
    "bug",
    "feature",
    "refactor",     // NEW
    "task",
    "access",       // New: Access Requests
    "maintenance",  // New: Scheduled Work
    "alert",         // New: Automated Alerts
    "hotfix",
    "test" // [cite: 11] Added new type
];

// KNOWLEDGE BASE
export const ARTICLE_CATEGORIES = [
    "sop",
    "template",
    "wiki",
    "troubleshooting" // NEW
];

// ASSETS (CMDB)
// UPDATED: Added Digital Asset Types
export const ASSET_TYPES = [
    "server",
    "workstation",
    "laptop",
    "network",
    "firewall",
    "printer",
    "software",
    "license",
    "domain",
    "hosting web",
    "hosting email",
    "saas",
    "security software",
    // MOBILE DEVICES
    "iphone",           // NEW
    "android phone",    // NEW
    "ipad",             // NEW
    "android tablet"    // NEW
];

export const ASSET_STATUSES = [
    "draft",
    "active",
    "maintenance",
    "storage",
    "retired",
    "lost"
];

// CATALOG / PRODUCTS
export const PRODUCT_TYPES = [
    { value: "service", label: "Service (Labor)", color: "info" },
    { value: "hardware", label: "Hardware (Goods)", color: "warning" },
    { value: "hosting", label: "Hosting / Cloud", color: "purple" }, // NEW
    { value: "license", label: "Software License", color: "pink" }   // NEW
];

// AUTOMATION
export const AUTOMATION_EVENTS = [
    { value: "ticket_created", label: "Ticket Created" },
    { value: "ticket_resolved", label: "Ticket Resolved" },
    { value: "deal_won", label: "Deal Won" },
    { value: "invoice_overdue", label: "Invoice Overdue" }
];

export const AUTOMATION_ACTIONS = [
    { value: "send_email", label: "Send Email" },
    { value: "create_notification", label: "In-App Notification" },
    { value: "log_info", label: "Log Info (Debug)" },
    { value: "webhook", label: "Call Webhook" }
];
