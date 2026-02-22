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
    "qa",       
    "resolved"
];

export const TICKET_TYPES = [
    "support",
    "bug",
    "feature",
    "refactor",     
    "task",
    "access",       
    "maintenance",  
    "alert",         
    "hotfix",
    "test"
];

// KNOWLEDGE BASE
export const ARTICLE_CATEGORIES = [
    "Standard Operating Procedure",
    "System Documentation",
    "Developer Documentation",
    "Troubleshooting Guide",
    "General Knowledge",
    "Template"
];

// ASSETS (CMDB)
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
    "iphone",           
    "android phone",    
    "ipad",             
    "android tablet"    
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
    { value: "hosting", label: "Hosting / Cloud", color: "purple" }, 
    { value: "license", label: "Software License", color: "pink" }   
];

// BILLING & FINANCE
export const PAYMENT_METHODS = [
    { value: "bank_transfer", label: "Bank Transfer / EFT" },
    { value: "credit_card", label: "Credit Card (Stripe)" },
    { value: "cash", label: "Cash" },
    { value: "cheque", label: "Cheque" },
    { value: "other", label: "Other" }
];

export const PAYMENT_TERMS = [
    "Due on Receipt",
    "Net 7 Days",
    "Net 14 Days",
    "Net 30 Days"
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