# HVAC/R Maintenance Scheduler

## Overview

This project is a preventive maintenance scheduling application designed for HVAC/R contractors. Its primary purpose is to streamline the management of client contracts, schedule maintenance visits, and track parts inventory. The application aims to enhance productivity and data organization through a dashboard that provides an overview of overdue maintenance, upcoming schedules, and completed work. The business vision is to provide a robust tool for contractors to efficiently manage their maintenance operations, reduce downtime, and improve client satisfaction.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is built with React and TypeScript, utilizing Vite for fast development and bundling. It employs `wouter` for client-side routing. The UI is constructed using `shadcn/ui`, which is based on Radix UI primitives, styled with Tailwind CSS, and follows Material Design principles. State management and data fetching are handled by TanStack Query, while form management and validation are implemented with React Hook Form and Zod. The component structure follows an atomic design pattern, with reusable UI components and dedicated feature and page components.

### Backend Architecture

The backend is an Express.js server developed with TypeScript, adhering to a RESTful API design. Data persistence is managed using a PostgreSQL database (via Neon serverless) and Drizzle ORM for type-safe interactions. The API provides endpoints for CRUD operations on clients, parts inventory, and client-part relationships. The database schema includes tables for `clients`, `parts`, and `client_parts`, with foreign key constraints ensuring data integrity.

### Design System Decisions

The application uses a Material Design-inspired typography hierarchy with the Inter font family. Spacing and layout are consistent, employing Tailwind's spacing units and a 12-column responsive grid system with a mobile-first approach. The color system uses CSS custom properties for semantic naming and theme tokens. Key component patterns include stats cards, maintenance cards, and dialog-based forms for data entry and management.

### Technical Implementations

- **Data Integrity**: Foreign key constraints with CASCADE delete ensure referential integrity in the database.
- **Automatic Parts Seeding**: The application automatically seeds 244 standard parts (106 belts A/B sizes 18-70, 138 filters with Media/Pleated/Throwaway types in various sizes with x1/x2 thickness variants) on every server startup. The seeding is idempotent, safely skipping parts that already exist. This ensures production deployments have the complete parts inventory immediately available.
- **Parts Inventory**: Comprehensive parts inventory with support for custom parts. Parts are categorized for easier selection (Filters, Belts, Other).
- **Persistent Storage**: Migration from in-memory storage to PostgreSQL ensures data persistence across server restarts.
- **Editable Client Parts**: Clients' associated parts can be viewed, quantities edited, and parts deleted directly within the edit interface.
- **Monthly PM Schedule Report**: A dedicated report tab allows viewing of preventive maintenance schedules for any given month, showing client details and visual schedule indicators.
- **Recently Completed Maintenance**: A section for recently completed maintenance with an "undo" (reopen) option and accurate completion tracking.
- **Categorized Parts Selection**: Parts selection is organized into categories (Filters, Belts, Other) with distinct dropdowns and bulk addition capabilities for improved UX.
- **Client Management**: Alphabetical sorting by company name across all client lists, maintenance schedules, and search results. Client deletion with confirmation and robust state management for forms and dialogs.
- **Inactive Clients**: Clients can be marked as "Inactive" for on-call/as-needed service. Inactive clients are completely excluded from all reports (parts order reports, PM schedule reports) and scheduling displays.
- **Maintenance Completion**: Toggle functionality to mark maintenance as complete, recording completion in `maintenanceRecords`, with options to reopen and adjust next due dates.
- **UI Compaction**: Redesigned maintenance cards to increase client density on screen by reducing padding, consolidating information, and using icon-only buttons.
- **Parts System Redesign**: A complete overhaul of the parts inventory system, introducing type-specific fields for filters, belts, and other parts, a tabbed management interface, and updated duplicate prevention logic.
- **Client Portal Authentication**: Dual authentication system with separate Passport strategies for contractors ("contractor-local") and clients ("client-local"). Uses discriminated union types (BaseAuthUser, ContractorAuthUser, ClientPortalAuthUser) with type guards (isContractor, isClient) for type-safe authentication flows.
- **Client Portal Access**: Contractors can enable portal access for clients. Portal login requires clients.portalEnabled = true. Client users (client_users table) authenticate separately from contractors with clientId-scoped access.
- **Client Portal API**: Dedicated portal endpoints (/api/portal/*) for client login, maintenance records, equipment, and parts. All endpoints use isClientAuthenticated middleware and bypass userId validation for client-scoped data access.
- **Client Portal Management UI**: Contractors can manage client portal access via the AddClientDialog. Features include: portal enable/disable toggle, create/delete portal users with email/password, confirmation dialogs for destructive actions, and comprehensive error handling (403 portal disabled, 409 duplicate email). Client users list shows email and creation date.
- **Client Portal Frontend**: Separate authentication context (PortalAuthProvider) and protected routes for client portal. Login page at /portal/login with email/password authentication. Dashboard at /portal/dashboard features three tabs: Maintenance (completed service history), Equipment (registered HVAC/R equipment), and Parts (parts inventory with quantities). All data views are read-only with loading and empty states.

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