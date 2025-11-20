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
- **Automatic Parts Seeding**: The application automatically seeds 244 standard parts (106 belts A/B sizes 18-70, 138 filters with Media/Pleated/Throwaway types in various sizes with x1/x2 thickness variants) when new users sign up. The seeding is idempotent, safely skipping parts that already exist.
- **Manual Parts Seeding**: A "Seed Standard Parts" button is available in the Parts Management page, allowing existing users to manually seed the 244 standard parts. This is particularly useful after publishing the app or for users who signed up before the seeding feature was added. The operation is idempotent and safe to run multiple times.
- **Parts Inventory**: Comprehensive parts inventory with support for custom parts. Parts are categorized for easier selection (Filters, Belts, Other).
- **Persistent Storage**: Migration from in-memory storage to PostgreSQL ensures data persistence across server restarts.
- **Editable Client Parts**: Clients' associated parts can be viewed, quantities edited, and parts deleted directly within the edit interface.
- **Monthly PM Schedule Report**: A dedicated report tab allows viewing of preventive maintenance schedules for any given month, showing client details and visual schedule indicators.
- **Recently Completed Maintenance**: A section for recently completed maintenance with an "undo" (reopen) option and accurate completion tracking.
- **Categorized Parts Selection**: Parts selection is organized into categories (Filters, Belts, Other) with distinct dropdowns and bulk addition capabilities for improved UX.
- **Client Management**: Alphabetical sorting by company name across all client lists, maintenance schedules, and search results. Client deletion with confirmation and robust state management for forms and dialogs.
- **Inactive Clients**: Clients can be marked as "Inactive" for on-call/as-needed service. Inactive clients are completely excluded from all reports (parts order reports, PM schedule reports) and scheduling displays.
- **Maintenance Completion**: Toggle functionality to mark maintenance as complete, recording completion in `maintenanceRecords`, with options to reopen and adjust next due dates. When a PM is marked complete, the system automatically creates a calendar assignment for the next scheduled due date, preventing clients from appearing as "unscheduled" after completion.
- **UI Compaction**: Redesigned maintenance cards to increase client density on screen by reducing padding, consolidating information, and using icon-only buttons.
- **Parts System Redesign**: A complete overhaul of the parts inventory system, introducing type-specific fields for filters, belts, and other parts, a tabbed management interface, and updated duplicate prevention logic.
- **CSV Import**: Clients can be imported via CSV file with an import button in the client list. The import includes basic parsing, validation, automatic nextDue calculation, and detailed import statistics. Note: Best for simple client lists; avoid complex text with line breaks for reliability.
- **Authentication**: Fixed login bug where users had to enter credentials twice. Login now properly waits for user state to be set before redirecting using useEffect, ensuring smooth single-attempt authentication.
- **Mobile Technician Dashboard**: A dedicated mobile-optimized view for field technicians to access their schedules and view client information. Features include:
  - Today's schedule prominently displayed with client details
  - 7-day upcoming schedule view with assignments grouped by date
  - Touch-friendly card interface with large tap targets
  - Client detail modal showing parts inventory and equipment information
  - Fully accessible with keyboard navigation and screen reader support
  - Responsive design optimized for mobile devices with proper breakpoints
  - Quick access to client contact information (phone, email, address) with tap-to-call/email functionality
- **Role-Based Access Control**: Secure implementation of admin and technician roles with complete separation of privileges:
  - Backend: All mutating operations (POST/PUT/DELETE/PATCH) protected by requireAdmin middleware returning 403 for technicians
  - Frontend: ProtectedRoute component automatically redirects technicians to /technician dashboard and prevents access to admin pages
  - Signup: New accounts created as technicians by default; first user becomes admin automatically
  - User Management: Admins can promote technicians to admin via the Admin page user management interface
  - Security: No privilege escalation vulnerabilities; technicians have strict read-only access to schedules and client data
  - Technician Experience: Full read-only access to schedules, client information, parts inventory, and equipment details via mobile-optimized dashboard
- **Subscription System (Feature Flag Controlled)**: Tiered subscription model with location limits and usage tracking:
  - **Subscription Tiers**: Free Trial (30 days, 10 locations), Silver ($40/month, 100 locations), Gold ($70/month, 200 locations), Enterprise (quote-based, unlimited locations)
  - **Database Schema**: `subscription_plans` table stores tier definitions; user subscription info tracked in `users` table fields (subscriptionPlan, subscriptionStatus, trialEndsAt)
  - **Backend Services**: `subscriptionService.ts` handles plan assignment, limit checking, usage calculation, and trial expiration tracking
  - **API Endpoints**: `/api/subscriptions/plans` (list plans), `/api/subscriptions/usage` (current usage), `/api/subscriptions/can-add-location` (check limits), `/api/admin/users/:userId/subscription` (admin override)
  - **Limit Enforcement**: Client creation and import operations check subscription limits; returns 403 with detailed error when limits exceeded
  - **Feature Flag**: Controlled by `ENABLE_SUBSCRIPTIONS` environment variable; when disabled, no limits enforced (legacy behavior)
  - **Admin Controls**: Admins can manually assign subscription plans to users via admin endpoints
  - **Trial Management**: New users automatically assigned 30-day trial; trial expiration tracked and enforced on client operations
  - **Stripe Integration Ready**: Infrastructure prepared for Stripe payment integration (client, webhook handlers, service layer) but payments not yet implemented
  - **Usage Tracking**: Real-time location count based on active (non-inactive) clients; percentage calculation against plan limits
- **Route Optimization**: Intelligent route planning for technician visits using OpenRouteService API:
  - **Geocoding**: Automatically converts client addresses (address, city, province, postal code) to GPS coordinates
  - **Route Calculation**: Uses OpenRouteService optimization API to calculate the most efficient visiting order for scheduled clients
  - **Calendar Integration**: "Optimize Route" button on Calendar page allows admins to optimize the current month's schedule
  - **Visual Feedback**: Shows total distance, travel time, and optimized client order before applying changes
  - **Smart Reordering**: Preserves existing day assignments while reordering clients to follow the optimal route
  - **Rate Limiting**: Built-in 1.5s delay between geocoding requests to respect OpenRouteService free tier limits (40 req/min)
  - **Environment Variable**: Requires `OPENROUTESERVICE_API_KEY` environment variable for production use
  - **API Endpoints**: `/api/routes/optimize` (calculate optimal route), `/api/routes/geocode` (single address geocoding)
  - **Error Handling**: Gracefully handles missing addresses, geocoding failures, and API errors with user-friendly messages

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