# HVAC/R Maintenance Scheduler

## Overview

This is a preventive maintenance scheduling application designed for HVAC/R contractors. The system helps track client contracts, schedule maintenance visits, and manage parts inventory. It provides a dashboard view for monitoring overdue maintenance, upcoming schedules, and completed work. The application follows Material Design principles optimized for productivity and data organization.

## Recent Changes (November 2025)

### Dashboard Simplification
- Removed "Due this week" section from dashboard
- Dashboard now shows only two categories: "Overdue" and "Due in the month"
- Stats grid updated to show 3 cards instead of 4

### Parts Editing Bug Fix
- Fixed bug where editing client parts stopped working after the first edit attempt
- Added `initializedRef` guard to prevent useEffect from resetting state while dialog is open

### Maintenance Completion Tracking
- Implemented maintenance completion toggle functionality
- Each completion is recorded in `maintenanceRecords` table with clientId, dueDate, and completedAt timestamp
- Completion status API (`/api/maintenance/statuses`) returns both completion state and the completedDueDate
- Toggle endpoint (`/api/maintenance/:clientId/toggle`) accepts dueDate in request body to support proper undo
- "Complete" button marks maintenance as complete and advances nextDue to the next scheduled month
- "Reopen" button uncomplets the maintenance and restores nextDue to the completed cycle
- Frontend tracks completed dueDate separately to ensure reopening affects the correct maintenance cycle

### Parts Report Auto-Refresh
- Fixed issue where monthly parts report didn't update after adding/editing clients
- Reports query now invalidates when clients are created or updated

### UI Compaction for Better Client Density
- Redesigned maintenance cards to show ~40-50% more clients on screen:
  - Reduced card padding and spacing
  - Moved location to same line as company name
  - Removed redundant due date display (already shown in section header)
  - Changed "Months:" to "PM Schedule:" for clearer terminology
  - Made edit button icon-only to save space
  - Added responsive button text (desktop: "Complete"/"Reopen", mobile: "Done"/"Undo")
  - Reduced spacing between cards for better density

### Parts Dialog State Management Fix
- Fixed recurring parts editing bug by adding key prop to AddClientDialog
- Key changes based on client ID and mode (`edit-${clientId}` or `new-client`)
- Forces React to remount dialog component when switching between clients or modes
- Prevents stale state issues with parts selection that were occurring on subsequent edits
- All dialog state (clientParts, showAddPart, selectedPartId, etc.) properly resets on each open

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React with TypeScript for type-safe component development
- Vite as the build tool and development server
- Wouter for client-side routing (lightweight React Router alternative)

**UI Component System**
- shadcn/ui component library built on Radix UI primitives
- Tailwind CSS for styling with custom design tokens
- Material Design-inspired design system for productivity-focused interfaces
- Inter font family via Google Fonts CDN

**State Management & Data Fetching**
- TanStack Query (React Query) for server state management
- Custom query client with optimistic updates and caching strategies
- Form state managed with React Hook Form and Zod validation

**Component Structure**
- Atomic design pattern with reusable UI components in `client/src/components/ui`
- Feature components in `client/src/components` (Header, MaintenanceCard, ClientListTable, etc.)
- Page components in `client/src/pages`
- Path aliases configured for clean imports (@/, @shared/, @assets/)

### Backend Architecture

**Server Framework**
- Express.js server with TypeScript
- RESTful API design pattern
- JSON request/response format
- Custom logging middleware for API requests

**Data Layer**
- Drizzle ORM for type-safe database interactions
- PostgreSQL database (via Neon serverless adapter)
- In-memory storage fallback for development (MemStorage class)
- Schema-first approach with Zod validation

**API Structure**
- `/api/clients` - CRUD operations for client management
- `/api/parts` - Parts inventory management
- `/api/clients/:id/parts` - Client-part relationship management
- Type-safe request/response contracts shared between client and server

**Database Schema**
- `users` - User authentication (prepared for future auth implementation)
- `clients` - Client company information and maintenance schedules
- `parts` - Parts inventory (filters, belts) with type and size
- `client_parts` - Many-to-many relationship linking clients to their required parts

### Design System Decisions

**Typography**
- Material Design-inspired hierarchy with Inter font
- Tabular numbers for consistent numeric data alignment
- Semantic heading levels (H1 for dashboard titles, H2 for sections, H3 for cards)

**Spacing & Layout**
- Consistent Tailwind spacing units (2, 4, 6, 8) for predictable visual rhythm
- 12-column responsive grid system
- Max-width container (max-w-7xl) for optimal reading experience
- Mobile-first responsive breakpoints

**Color System**
- CSS custom properties for theme tokens (light/dark mode ready)
- Semantic color naming (primary, secondary, destructive, muted, accent)
- Separate border colors for elevated UI clarity
- Elevate system using transparency overlays for hover/active states

**Component Patterns**
- Stats cards with large metrics and icons for dashboard KPIs
- Maintenance cards showing client info, next due date, and parts list
- Search and filter functionality for client management
- Dialog-based forms for creating/editing clients and managing parts

### Development Workflow

**Type Safety**
- Shared TypeScript types between client and server via `shared/` directory
- Drizzle schema generates TypeScript types
- Zod schemas for runtime validation matching database schema
- React Hook Form resolver integration for form validation

**Development Server**
- Vite dev server with HMR for fast frontend development
- Express middleware mode integration
- Replit-specific plugins for development tooling
- Separate build outputs for client (dist/public) and server (dist)

## External Dependencies

### Database
- **Neon PostgreSQL** - Serverless PostgreSQL database
- **Drizzle ORM** - TypeScript ORM with migrations support
- **connect-pg-simple** - PostgreSQL session store (prepared for authentication)

### UI Libraries
- **Radix UI** - Unstyled, accessible component primitives (dialogs, dropdowns, tooltips, etc.)
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Pre-built component library configuration
- **Lucide React** - Icon library for consistent iconography
- **date-fns** - Date manipulation and formatting

### Form & Validation
- **React Hook Form** - Performant form state management
- **Zod** - TypeScript-first schema validation
- **@hookform/resolvers** - Zod integration for React Hook Form

### State Management
- **TanStack Query (React Query)** - Server state management, caching, and synchronization

### Development Tools
- **Vite** - Fast build tool and dev server
- **TypeScript** - Type safety across the stack
- **ESBuild** - Fast JavaScript bundler for production builds
- **Replit plugins** - Development environment integrations (cartographer, dev banner, runtime error overlay)

### Additional Libraries
- **wouter** - Lightweight client-side routing
- **class-variance-authority** - Type-safe component variant management
- **clsx** & **tailwind-merge** - Conditional class name utilities
- **embla-carousel-react** - Carousel component implementation
- **cmdk** - Command palette component