# SYSTEM CONTEXT INJECTION: START PHASE 59

**Project:** Sanctum Core v2.2
**Current Phase:** **Phase 59: The Sentinel (Security & Compliance)**
**Status:** Ready for Architecture

## 1. RECENT VICTORIES (Context)
*   **The Signal (Phase 57):** Complete. "Grand Unification" of notifications implemented. `EventBus` uses a `NotificationRouter` to dispatch to `NotificationService`. Logic supports M:N contacts (Ticket Contacts + Billing Email) and distinguishes between Registered Users (Portal+Email) and External Contacts (Email Only).
*   **The Mirror (Phase 58):** Complete. Client Portal is fully functional.
    *   **Dashboard:** Shows Security Score (Placeholder), Active Requests, Invoices.
    *   **Tickets:** Read/Write access for clients (Comments/Stream).
    *   **Assets:** Read-only inventory (`/portal/assets`).
    *   **Projects:** Timeline and progress tracking (`/portal/projects/:id`).

## 2. ARCHITECTURAL STATE
*   **Notifications:** `notifications` table acts as a queue (`user_id` nullable, `event_payload` JSON).
*   **Contacts:** `Ticket` model uses `ticket_contacts` (M:N). `Contact` model has `notification_preferences`.
*   **Audits:** `AuditReport` model exists in `models.py` but is currently a shell (`content` JSON field).

## 3. IMMEDIATE OBJECTIVE: THE SENTINEL
**Goal:** Operationalise the Security Audit Engine to drive NRR (Net Recurring Revenue) via remediation projects.

**Requirements:**
1.  **Audit Builder:** Admin UI to create "Security Audits" based on templates (e.g., Essential 8, NIST).
2.  **Scoring Engine:** Logic to calculate the "Security Score" (0-100) based on audit results (Pass/Fail/Partial).
3.  **Client Visibility:** Expose a detailed "Report Card" in the Client Portal (clicking the 0/100 score).
4.  **Sales Integration:** Failed audit items should easily convert into **Deals** or **Projects**.

**Next Step:** Architect the `AuditTemplate` and `AuditSubmission` schemas and the Scoring Algorithm.
