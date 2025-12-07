# HVAC/R Maintenance Scheduler

## Overview

This project is a preventive maintenance scheduling application for HVAC/R contractors. It aims to streamline client contract management, schedule maintenance visits, and track parts inventory. The application provides a dashboard for overdue maintenance, upcoming schedules, and completed work, enhancing productivity and data organization. The business vision is to offer a robust tool for efficient maintenance operations, reduced downtime, and improved client satisfaction.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is built with React and TypeScript, using Vite for development. It features `wouter` for routing, `shadcn/ui` (based on Radix UI) styled with Tailwind CSS following Material Design principles. State management and data fetching are handled by TanStack Query, while React Hook Form and Zod manage forms and validation. The component structure follows an atomic design pattern.

### Backend

The backend is an Express.js server in TypeScript, adhering to a RESTful API design. Data persistence uses a PostgreSQL database (Neon serverless) with Drizzle ORM. The API supports CRUD operations for clients, parts, and client-part relationships. Database schema includes `clients`, `parts`, and `client_parts` tables with foreign key constraints.

### Design System

The application uses a Material Design-inspired typography with the Inter font family. Spacing and layout are consistent, using Tailwind's spacing units and a responsive 12-column grid system (mobile-first). The color system utilizes CSS custom properties for semantic naming. Key UI patterns include stats cards, maintenance cards, and dialog-based forms.

### Key Features & Technical Implementations

- **Data Integrity**: Enforced via foreign key constraints with CASCADE delete.
- **Parts Management**: Automatic and manual seeding of 244 standard parts (idempotent). Comprehensive inventory with custom parts, categorized selection (Filters, Belts, Other), and bulk addition.
- **Client Management**: Alphabetical sorting, client deletion, and "Inactive" status to exclude clients from reports and schedules. CSV import for clients with validation and import statistics.
- **Maintenance Scheduling**: Monthly PM schedule reports, recently completed maintenance with undo option, and automated next due date assignment upon completion.
- **UI/UX Enhancements**: Redesigned maintenance cards for higher density and categorized parts selection for improved user experience.
- **Authentication & Authorization**: Secure login, Role-Based Access Control (RBAC) with Admin and Technician roles. New accounts default to Technician; first user becomes Admin. Admins can promote technicians.
- **Mobile Technician Dashboard**: Optimized view for field technicians with today's/upcoming schedules, client details, parts inventory, and equipment information. Includes tap-to-call/email.
- **Technician System**: Technician-specific pages ("My Schedule", "Daily Parts"), assignment UI on Calendar, and PM visibility limited to assigned technicians.
- **Subscription System (Feature Flagged)**: Tiered model (Free Trial, Silver, Gold, Enterprise) with location limits and usage tracking. Database schema includes `subscription_plans` and user subscription fields. Checks limits during client creation/import. Infrastructure ready for Stripe integration.
- **Route Optimization**: Integrates OpenRouteService API for efficient technician routing. Converts addresses to GPS, calculates optimal visiting order, and visualizes routes on an interactive Leaflet map. Includes starting location input and smart reordering. Requires `OPENROUTESERVICE_API_KEY`.
- **Calendar Cleanup**: Automatic removal of invalid calendar assignments when client PM months are updated, preserving completed jobs.
- **Platform Admin Impersonation**: Secure system for platform administrators to impersonate company admins for support. Features server-side session storage, time limits, mandatory reason logging, and comprehensive audit trails. Includes an impersonation banner in the UI.
- **Client Notes System**: Multiple timestamped notes per client with full CRUD operations. Notes display in client report dialog with add/edit/delete capability.
- **Workflow-First Client Detail Page**: Redesigned client detail page (`/clients/:id`) with workflow-focused layout:
  - Tabs: Overview | Jobs | Locations | Parts | Notes
  - Quick Actions in header: Create Job, Create Invoice, Add Location buttons
  - Jobs tab (`ClientJobsTab`): Displays all jobs for the client with location filter dropdown, job status badges (Completed, Scheduled, Overdue), and location metadata
  - Location filter persisted via URL query params (`?tab=jobs&locationId=xxx`) enabling deep linking
  - Locations tab: "View Jobs" action navigates to Jobs tab with pre-selected location filter
  - Activity Summary placeholder on Overview tab for future metrics
  - API endpoint: `GET /api/customer-companies/:parentId/jobs?locationId=xxx` returns enriched jobs with location names and billing flags
- **QuickBooks Online (QBO) Sync Infrastructure**: Data model supporting QBO Customer/Sub-Customer hierarchy:
  - `customer_companies` table: Parent entities mapping to QBO Customers with billing address, QBO sync fields (qboCustomerId, qboSyncToken, qboLastSyncedAt).
  - `clients` table extended: Added parentCompanyId (FK to customer_companies), billWithParent flag, and QBO sync fields.
  - QBO Mapper utilities (`server/qbo/mappers.ts`): Bidirectional mapping between app entities and QBO payloads.
  - QBO Sync Service (`server/qbo/syncService.ts`): Stub implementation for create/update/deactivate sync operations.
  - API routes for customer companies CRUD with soft delete (deactivate) support.
  - Transactional storage method `createCustomerCompanyWithClient`: Atomic creation of CustomerCompany + Client + ClientParts using db.transaction() for rollback safety.
  - API endpoint `POST /api/clients/with-company`: Creates parent Company and child Location together with upfront validation and proper QBO field mapping.
- **Invoice System with QBO Integration**: Complete invoicing system supporting QuickBooks Online synchronization:
  - `invoices` table: Full invoice data model with status workflow (draft, sent, paid, void, deleted), QBO sync fields (qboInvoiceId, qboSyncToken, qboLastSyncedAt, qboDocNumber), billing references to CustomerCompany or Location.
  - `invoice_lines` table: Detailed line items with description, quantity, unitPrice, lineSubtotal, tax codes, and QBO item references.
  - Billing logic: billWithParent flag determines invoice routing - if true, CustomerRef points to parent Company; if false, points to Location.
  - Location context in parent-billed invoices via ShipAddr and CustomerMemo fields.
  - QBO Mapper functions: mapInvoiceToQBO (build QBO Invoice payload), parseQBOInvoiceResponse (extract sync fields from QBO responses).
  - QBO Sync Service: createInvoiceInQBO, updateInvoiceInQBO, voidInvoiceInQBO, deleteInvoiceInQBO stub methods ready for OAuth integration.
  - API routes: Full CRUD for invoices with multi-tenant companyId scoping, includes invoice lines management.
- **Jobs System**: Complete dispatching system with recurring series support:
  - `jobs` table: Full job data model with status workflow (draft, scheduled, in_progress, on_hold, completed, cancelled, invoiced), priority levels (low, medium, high, urgent), job types (maintenance, repair, inspection, installation, emergency), technician assignment, and scheduling.
  - `recurring_job_series` table: Recurring job templates with frequency (weekly, biweekly, monthly, quarterly, annually), start/end dates, and generation tracking.
  - `recurring_job_phases` table: Multi-phase work templates within recurring series.
  - `company_counters` table: Atomic company-scoped job number sequences (JOB-0001 format).
  - Job status transitions: Draft → Scheduled → In Progress → On Hold/Completed → Cancelled/Invoiced with validation guards.
  - Date range filtering: GET /api/jobs supports startDate and endDate query params for calendar views.
  - Location-based filtering: Jobs linked to Locations (clients) via locationId FK.
  - API endpoints: GET/POST /api/jobs, GET/PATCH/DELETE /api/jobs/:id, POST/GET /api/recurring-series.
  - Frontend: QuickAddJobDialog for job creation, Jobs.tsx list page with status filters and sorting, JobDetailPage.tsx for detailed view and status management.
  - Coexistence: Jobs system works alongside calendarAssignments during migration via optional calendarAssignmentId reference.

## External Dependencies

### Database
- **Neon PostgreSQL**: Serverless PostgreSQL database.
- **Drizzle ORM**: TypeScript ORM for database interactions.

### UI Libraries
- **Radix UI**: Unstyled, accessible component primitives.
- **Tailwind CSS**: Utility-first CSS framework.
- **shadcn/ui**: Pre-built component library configuration.
- **Lucide React**: Icon library.
- **date-fns**: Date manipulation and formatting utility.
- **Leaflet / react-leaflet**: Interactive map visualization.

### Form & Validation
- **React Hook Form**: Performant form state management.
- **Zod**: TypeScript-first schema validation.
- **@hookform/resolvers**: Zod integration for React Hook Form.

### State Management
- **TanStack Query (React Query)**: Server state management, caching, and synchronization.

### Development Tools
- **Vite**: Fast build tool and development server.
- **TypeScript**: Ensures type safety across the application.

### Additional Libraries
- **wouter**: Lightweight client-side routing.
- **class-variance-authority**: Type-safe component variant management.
- **clsx** & **tailwind-merge**: Utilities for conditional class names.
- **OpenRouteService API**: External API for geocoding and route optimization.