# Comprehensive Product Strategy & Top 10 Enhancements for ParsePilot

## Current Platform Analysis

Based on our parse of the codebase (`apps/web`, `services/processor`, `prisma/schema.prisma`) and the live site ([parsepilotapp.vercel.app](https://parsepilotapp.vercel.app/)):

### Existing Stack & Core Capabilities
1. **Architecture**: Next.js 15 (App Router, Server Actions, React 19), Prisma ORM with PostgreSQL, Redis-backed job queues, and a Python worker service (`services/processor`) running PyMuPDF text extraction + OCR fallback.
2. **Extraction Engine**: Hybrid extraction using rule-based parsing + OpenAI/Gemini/OpenAI-compatible LLMs with fallback and disagreement detection.
3. **Data Integrity & Trust**: Versioned extraction runs (`ExtractionRun`), non-destructive human overrides (`ExtractionField`), arithmetic validation ($Subtotal + Tax = Total$), and duplicate document checksum matching.
4. **Multitenancy & Security**: Role-based access control (`owner`, `admin`, `member`, `viewer`), AES-256 encrypted settings (`AiSettings`), signed private object storage URLs (S3/Supabase), audit logs, and GDPR retention sweeps.
5. **Exports & Billing**: CSV/XLSX exports, permanent live Excel HTTP sync tokens (`/live/:token`), usage ledgers, and Stripe subscription tiers.

---

## Top 10 Features & Enhancements That Would Benefit ParsePilot Most

Below are the 10 highest-value additions designed to transition ParsePilot from a standalone extraction utility into an indispensable enterprise document intelligence platform for finance and operations teams.

---

### 1. Inbound Email-to-Invoice Gateway (`invoices@<slug>.parsepilot.app`)
- **Problem**: Users currently must manually log into the web dashboard or build custom API integrations to upload PDFs. In the real world, 80%+ of vendor invoices arrive as PDF email attachments.
- **Solution**: Provide every workspace with a unique dedicated inbound email address (e.g., `acme-ap@inbound.parsepilot.app`).
- **Mechanism**:
  - Integrate SendGrid Inbound Parse or Postmark Email Webhook to process incoming emails.
  - Automatically parse PDF/image attachments, create `Document` rows, extract email metadata (Sender, Subject, Received Date), and enqueue extraction jobs.
  - Store sender email on the document record for origin tracking.

### 2. Outbound Webhook Engine & Automated Event Notifications
- **Problem**: When documents finish processing or enter `needs_review`, external systems (custom ERPs, Zapier, Slack, Make) have no proactive notification mechanism and must poll `GET /api/v1/documents/:id/status`.
- **Solution**: High-performance webhook engine emitting signed HTTP events (`document.processed`, `document.needs_review`, `export.completed`, `duplicate.detected`).
- **Mechanism**:
  - New `WebhookEndpoint` and `WebhookEvent` Prisma models.
  - HMAC-SHA256 request signing with secret keys and configurable retry policies (exponential backoff).
  - Slack/Microsoft Teams integration for instant alerts when high-value invoices need review.

### 3. Vendor Directory & Fuzzy Matching Engine
- **Problem**: Extraction produces raw string vendor names (e.g., "Atlas Freight GmbH", "Atlas Freight Ltd", "ATLAS FREIGHT"). This creates fragmented vendor records, duplicate entries, and messy exports.
- **Solution**: A canonical Vendor Directory with fuzzy string matching (Levenshtein distance / Trigram similarity).
- **Mechanism**:
  - `Vendor` model storing canonical name, tax ID / VAT number, default payment terms, default GL code, and alias list.
  - Automatic normalization during validation stage: maps extracted vendor string to canonical workspace vendor.

### 4. General Ledger (GL) & Department Cost-Center Auto-Coding
- **Problem**: Finance teams extract invoices to post them into accounting ledgers. Raw extracted fields lack accounting context (GL account code, department/cost center, tax code).
- **Solution**: Rule-based GL Coding Engine.
- **Mechanism**:
  - Rules engine supporting conditional matches (e.g., "If `vendor_name` contains 'AWS' $\rightarrow$ Set GL Account `6100 - Cloud Hosting` & Department `Engineering`").
  - Auto-assign GL codes to invoice header and line items prior to export.

### 5. Interactive PDF Bounding-Box Focus & Split-Screen Review
- **Problem**: Reviewers looking at low-confidence fields must manually search the rendered invoice preview image for where the value was found.
- **Solution**: Exact coordinates (bounding boxes) visual highlighting on PDF page previews when focusing input fields in the review queue.
- **Mechanism**:
  - Python processor extracts bounding boxes $(x_0, y_0, x_1, y_1, page)$ alongside extracted text tokens.
  - Frontend interactive canvas/SVG overlay that highlights source text when hovering or editing a field in `DocumentReview`.

### 6. Direct Accounting Integrations (QuickBooks Online, Xero, NetSuite)
- **Problem**: Exporting CSV/XLSX and manually re-importing into accounting software is friction-heavy and prone to human error.
- **Solution**: 1-Click Sync / Auto-Post verified invoices directly to accounting ERPs as Accounts Payable Bills.
- **Mechanism**:
  - OAuth2 connections to QuickBooks Online & Xero APIs.
  - Auto-create Vendor if missing, post Bill with line items, attachment PDF link, and payment due dates upon marking a document as reviewed.

### 7. Multi-Invoice PDF Splitter & Document Assembly Toolkit
- **Problem**: Vendors often send a single 30-page PDF containing 10 distinct invoices or receipts bundled together. Current pipeline treats 1 file as 1 document.
- **Solution**: Document splitting & merging tool in the dashboard.
- **Mechanism**:
  - Visual thumbnail page selector to split multi-page PDFs into distinct sub-documents or merge separate receipt images into a single document before processing.
  - Automatic split detection using PyMuPDF page-header classification.

### 8. Custom Field & Dynamic Schema Builder
- **Problem**: Schema is currently hardcoded to standard invoice fields. Different industries require custom fields (e.g., Freight Bill Tracking #, Construction Lien Wavier Status, Custom Project Code).
- **Solution**: Per-workspace Custom Field Schema definition.
- **Mechanism**:
  - Workspace admins define custom fields (name, type: text/date/currency/select, validation rules, AI prompt hint).
  - Pass dynamic custom schema into Python AI extraction prompt (`AI_SCHEMA`) and present custom fields in the review UI.

### 9. Multi-Currency Normalization & Live FX Rate Conversion
- **Problem**: International companies receive invoices in EUR, USD, GBP, JPY. Reporting and ledger totals need unified base-currency tracking.
- **Solution**: Real-time & historical exchange rate lookup (e.g., via European Central Bank API).
- **Mechanism**:
  - Store extracted currency alongside converted workspace base currency equivalent (e.g. `total_amount_base_currency` converted as of `issue_date`).
  - Unified financial dashboards in a single chosen currency.

### 10. Multi-Step Approval Workflows & Threshold Governance
- **Problem**: Single-click "Mark as Reviewed" allows any workspace member to approve an invoice of any size without oversight.
- **Solution**: Configurable approval chains (e.g., invoices $> \$5,000$ require Department Lead approval; $> \$25,000$ require CFO sign-off).
- **Mechanism**:
  - `ApprovalPolicy` and `ApprovalStep` models tracking required approvers per workspace based on invoice total thresholds.
  - Audit log recording full approval history before document status advances to `completed` / `ready_for_export`.

---

## Proposed Plan & Roadmap

Below is the structured implementation strategy for rolling out these features in logical, high-impact milestones:

```
┌─────────────────────────────────────────────────────────┐
│ Phase 1: Automation & Data Quality (Features 1, 2, 3)   │
│ - Inbound Email Ingestion, Webhooks, Vendor Directory  │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│ Phase 2: Finance Workflow & UX (Features 4, 5, 8)       │
│ - GL Auto-Coding, Bounding Box Highlights, Custom Schema│
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│ Phase 3: ERP Sync & Enterprise Governance (6, 7, 9, 10) │
│ - QBO/Xero Sync, PDF Splitter, FX Rates, Approvals      │
└─────────────────────────────────────────────────────────┘
```

---

## Verification & Testing Strategy

1. **Unit & Integration Tests**:
   - Backend API tests in `apps/web` (Vitest) for webhooks, email parsing, and vendor matching rules.
   - Python pipeline tests in `services/processor/tests` (Pytest) for custom schemas and multi-page splitting.
2. **Data Consistency**:
   - Verify Prisma schema migrations against PostgreSQL.
   - Benchmark extraction speed and queue throughput under batch email ingestion load.

---

## Required Action to Implement

To begin implementing any or all of these 10 features in the codebase, please approve this plan or switch to **Agent mode**.