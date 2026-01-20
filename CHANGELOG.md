# Changelog

All notable changes to the Sanctum Core platform will be documented in this file.

## [v1.9.0] - 2026-01-20

### Added
- **The Mirror:** Dedicated Client Portal dashboard with restricted views for Tickets and Invoices.
- **The Construct:** Asset Management (CMDB) module with Client/Ticket linking.
- **The Sentinel:** Automated Domain Security Scanner (SSL, DNS, Headers).
- **The Vault:** One-click database backup generation (`.sql` export).
- **The Chronicle:** Wiki Article versioning and history tracking (Copy-on-Write).
- **The Seeker:** Global Command Palette (`Cmd+K`) for Omnisearch navigation.
- **The Quartermaster:** User Administration module for onboarding/offboarding staff.
- **The Scribe:** Smart text wrapping for Markdown editing.

### Changed
- **Architecture:** Complete refactor from Monolithic `main.py` to Modular Router architecture.
- **Data Safety:** Migrated all financial calculations from `float` to `Decimal` types.
- **UI/UX:** Complete refactor of Ticket & Client Detail views into domain-specific sub-components.
- **Feedback:** Replaced browser alerts with `ConfirmationModal` and `Toast` notifications.
- **Knowledge Base:** Separated "Troubleshooting" guides from standard SOPs.

### Security
- Implemented strict Role-Based Access Control (RBAC) for Admin routes.
- Added `pytest` and `vitest` harnesses to gate deployment.

---

## [v1.7.0] - Previous Stable Release
- Initial release of Core ERP features.