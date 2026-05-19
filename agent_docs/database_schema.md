# Database Schema

Supabase project: `zycrksvkdpondqpplqce`
Region: (check Supabase Dashboard)
216 migration files (Jan 7 – May 8, 2026)

---

## Core System Tables

### organizations
Primary multi-tenant table. Every other table references `organization_id`.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | |
| slug | text UNIQUE | URL-safe identifier |
| code | text | Auto-generated (trigger) |
| niche | text | `telecom` for P2G |
| plan | text | Subscription plan |
| logo_url | text | |
| enabled_modules | jsonb | Feature flags (`{energy: true, ...}`) |
| commission_matrix | jsonb | Commission tiers config |
| billing_provider | text | `invoicexpress` or `keyinvoice` |
| brevo_api_key | text | Per-org Brevo key |
| form_settings, lead_fields_settings, client_fields_settings, proposal_fields_settings, sale_fields_settings, sales_settings | jsonb | Per-org field configuration |
| trial_ends_at | timestamptz | |
| payment_failed_at | timestamptz | |

### profiles
Auto-created by `on_auth_user_created` trigger when a user signs up.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | FK → auth.users |
| organization_id | uuid | FK → organizations |
| full_name | text | |
| email | text | |
| phone | text | |
| avatar_url | text | |

### user_roles
Global roles (not per-org).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid | FK → auth.users |
| role | app_role | `super_admin`, `admin`, `viewer`, `salesperson` |

### organization_members
Per-org membership and role.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organization_id | uuid | |
| user_id | uuid | |
| role | app_role | |
| is_active | boolean | |
| commission_rate | numeric | |
| profile_id | uuid | FK → organization_profiles |

---

## CRM Tables

### crm_clients
Main client/customer table.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organization_id | uuid | |
| name | text | Required |
| code | text | Auto-generated |
| email | text | Required (UI enforced) |
| phone | text | Required (UI enforced) |
| company | text | |
| nif | text | Personal NIF |
| company_nif | text | Company NIF (normalized, no dots/dashes) |
| billing_target | text | `client` or `company` |
| status | text | `active`, `inactive`, `vip` |
| source | text | `lead`, `referral`, `direct`, `website`, `import`, `other` |
| assigned_to | uuid | FK → auth.users |
| lead_id | uuid | If converted from lead |
| distrito | text | Required (UI enforced) |
| conselho | text | Required (UI enforced). Label: "Concelho" |
| grupo_economico | text | |
| address_line1/2, city, postal_code, country | text | |
| total_proposals | integer | Auto-calculated (trigger) |
| total_sales | integer | Auto-calculated (trigger) |
| total_value | numeric | Auto-calculated (trigger) |
| total_comissao | numeric | Auto-calculated (trigger) |
| total_mwh | numeric | Auto-calculated from CPE consumo_anual (trigger) |
| total_kwp | numeric | From proposals (solar). Hidden for P2G. |
| notes | text | |

### leads

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organization_id | uuid | |
| name, email, phone | text | |
| status | text | Pipeline stage key |
| temperature | text | `cold`, `warm`, `hot` |
| source | text | |
| value | numeric | |
| company_name, company_nif | text | |
| consumo_anual | numeric | |
| assigned_to | uuid | |
| form_id | uuid | |
| automation_enabled | boolean | |
| custom_data | jsonb | Dynamic form fields |

### prospects

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organization_id | uuid | |
| company_name, contact_name, email, phone, nif, cpe | text | |
| annual_consumption_kwh | numeric | |
| segment | text | |
| source | text | `manual`, `import`, `apify` |
| status | text | `new`, `contacted`, `qualified`, `converted`, `archived` |
| assigned_to | uuid | |
| converted_to_lead | boolean | |
| converted_lead_id | uuid | |

### cpes
Electricity delivery points (Codigo Ponto de Entrega).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| client_id | uuid | FK → crm_clients |
| organization_id | uuid | |
| serial_number | text | CPE/CUI code |
| equipment_type | text | e.g., `Energia` |
| comercializador | text | Current energy provider |
| nivel_tensao | text | Voltage level (BTN, BTE, MT, AT, MAT) |
| consumo_anual | numeric(10,2) | Annual consumption in kWh |
| status | text | `active`, `inactive`, `pending` |
| fidelizacao_start | date | Contract start |
| fidelizacao_end | date | Contract end |
| renewal_status | text | `renewed`, `switched`, null |
| notes | text | |

---

## Sales Pipeline Tables

### proposals

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organization_id | uuid | |
| client_id | uuid | FK → crm_clients |
| code | text | Auto-generated |
| status | text | `draft`, `sent`, `accepted`, `rejected`, `expired` |
| proposal_type | text | `energia`, `servicos` |
| proposal_date | date | |
| total_value | numeric | |
| comissao | numeric | |
| consumo_anual | numeric | |
| kwp | numeric | Solar kWp |
| negotiation_type | text | `angariacao`, `retencao`, `win-back` |
| created_by | uuid | |

### proposal_cpes
CPEs attached to a proposal (energy proposals).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| proposal_id | uuid | |
| serial_number | text | |
| consumo_anual | numeric | |
| comissao | numeric | |
| margem | numeric | |
| dbl | numeric | |
| comercializador | text | |
| duracao_contrato | integer | |
| fidelizacao_start/end | date | |
| existing_cpe_id | uuid | Links to `cpes` table |

### sales

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organization_id | uuid | |
| client_id | uuid | |
| proposal_id | uuid | |
| code | text | Auto-generated |
| status | text | `pending`, `active`, `completed`, `cancelled` |
| sale_date | date | |
| activation_date | date | |
| total_value | numeric | |
| comissao | numeric | |
| payment_status | text | |
| proposal_type | text | `energia`, `servicos` |
| has_recurring | boolean | |
| recurring_value | numeric | |

### sale_payments

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| sale_id | uuid | |
| organization_id | uuid | |
| amount | numeric | |
| payment_date | date | |
| payment_method | text | |
| status | text | `pending`, `paid`, `failed` |
| bank_account_id | uuid | FK → bank_accounts |
| invoicexpress_id | integer | |

---

## Finance Tables

### bank_accounts
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organization_id | uuid | |
| name, bank_name, iban, holder_name | text | |
| initial_balance | numeric | |
| is_active, is_default | boolean | |

### bank_account_transactions
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| bank_account_id | uuid | |
| type | text | `credit`, `debit` |
| amount | numeric | |
| running_balance | numeric | Auto-calculated (function) |
| reference_type | text | `payment`, `expense`, `initial_balance` |
| reference_id | uuid | |

### expenses
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organization_id | uuid | |
| description | text | |
| amount | numeric | |
| expense_date | date | |
| category_id | uuid | FK → expense_categories |
| bank_account_id | uuid | |
| receipt_file_url | text | |

### commission_closings / commission_closing_items
Monthly commission period closings with per-user detail lines.

---

## Marketing Tables

### email_templates
Reusable email templates with variable substitution and automation triggers.

### email_campaigns
Bulk email campaigns with scheduling, recipient targeting, and send tracking.

### email_sends
Individual email delivery records. Tracks status, opens, clicks via Brevo.

### email_automations
Event-driven email rules (e.g., send email 24h after lead creation).

---

## Key Triggers

| Trigger | Table | Purpose |
|---------|-------|---------|
| `trg_update_client_total_mwh` | cpes | Recalculates `crm_clients.total_mwh` from CPE consumo_anual |
| `trigger_update_client_proposal_metrics` | proposals | Updates client proposal counts and values |
| `trigger_update_client_sales_metrics` | sales | Updates client sale counts |
| `trigger_set_client_code` | crm_clients | Auto-generates sequential client code |
| `trigger_set_proposal_code` | proposals | Auto-generates sequential proposal code |
| `trigger_set_sale_code` | sales | Auto-generates sequential sale code |
| `trg_sync_sale_payment_status` | sale_payments | Syncs payment status to parent sale |
| `trg_expense_bank_sync` | expenses | Creates bank transaction when expense is created |
| `trg_payment_bank_sync` | sale_payments | Creates bank transaction when payment is recorded |
| `on_auth_user_created` | auth.users | Auto-creates profile record |
| `automation_leads_insert/update` | leads | Triggers email automations on lead events |

---

## Edge Functions (44)

### CRM & Leads
| Function | Purpose |
|----------|---------|
| `submit-lead` | Public lead form submission handler |
| `update-lead` | Public API for lead status updates (webhook) |
| `generate-prospects` | Starts Apify actor for prospect generation |
| `check-prospect-job` | Polls Apify job status |

### Team
| Function | Purpose |
|----------|---------|
| `create-team-member` | Creates auth user + profile + org membership + role |
| `get-team-members` | Lists org team members |
| `manage-team-member` | Updates role, deactivates, bans |

### Email
| Function | Purpose |
|----------|---------|
| `send-template-email` | Sends email via Brevo with template variables |
| `send-proposal-email` | Sends proposal to client |
| `send-invoice-email` | Sends invoice PDF |
| `send-access-email` | Welcome email for new team members |
| `brevo-webhook` | Receives delivery/open/click events from Brevo |
| `sync-email-statuses` | Batch sync of email delivery statuses |
| `process-scheduled-campaigns` | Processes campaigns scheduled for now |
| `sync-campaign-sends` | Syncs campaign send records |

### Finance & Invoicing
| Function | Purpose |
|----------|---------|
| `issue-invoice` | Creates invoice in InvoiceXpress |
| `issue-invoice-receipt` | Creates invoice+receipt combo |
| `cancel-invoice` | Cancels invoice |
| `create-credit-note` | Creates credit note |
| `generate-receipt` | Generates receipt |
| `get-invoice-details` | Fetches invoice data |
| `sync-invoices` | Syncs invoices from InvoiceXpress |
| `sync-credit-notes` | Syncs credit notes |
| `sync-invoicexpress-items` | Syncs product items |
| `update-invoicexpress-item` | Updates product item |
| `keyinvoice-auth` | KeyInvoice API authentication |

### Payments
| Function | Purpose |
|----------|---------|
| `create-checkout` | Creates Stripe checkout session |
| `customer-portal` | Creates Stripe portal session |
| `stripe-webhook` | Handles Stripe events |
| `admin-stripe-stats` | Stripe commission statistics |
| `check-subscription` | Checks org subscription status |
| `check-trial-status` | Checks trial expiration |
| `cleanup-expired-trials` | Cleans up expired trials |

### Automation & Alerts
| Function | Purpose |
|----------|---------|
| `process-automation` | Processes event-triggered automations |
| `process-automation-queue` | Processes queued automation emails |
| `check-renewal-automations` | Checks upcoming renewals, triggers emails |
| `check-reminders` | Sends calendar event reminders |
| `check-fidelization-alerts` | Sends CPE contract expiry alerts |
| `send-push-notification` | Sends web push notifications |
| `notify-finance-request` | Finance request notification emails |
| `notify-request-status` | Request status change emails |

### AI & Integrations
| Function | Purpose |
|----------|---------|
| `otto-chat` | AI chatbot (OpenAI) with P2G energy context |
| `meta-capi-event` | Meta Conversions API event tracking |
| `store-api` | Public e-commerce storefront API |

---

## Enums

| Enum | Values |
|------|--------|
| `app_role` | `super_admin`, `admin`, `viewer`, `salesperson` |
| `rh_absence_status` | `pending`, `approved`, `partially_approved`, `rejected` |
| `rh_absence_type` | `vacation`, `sick_leave`, `appointment`, `personal_leave`, `training`, `other` |

---

## RLS Status

> **TODO:** Verify per-table RLS status in Supabase Dashboard.

Known from migrations:
- `organizations` — RLS enabled
- `profiles` — RLS enabled
- `user_roles` — RLS enabled
- `leads` — RLS enabled
- `forms` — RLS enabled
- `organization_members` — RLS enabled
