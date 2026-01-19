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