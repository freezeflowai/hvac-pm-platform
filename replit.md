# HVAC/R Maintenance Scheduler

## Overview

This is a preventive maintenance scheduling application designed for HVAC/R contractors. The system helps track client contracts, schedule maintenance visits, and manage parts inventory. It provides a dashboard view for monitoring overdue maintenance, upcoming schedules, and completed work. The application follows Material Design principles optimized for productivity and data organization.

## Recent Changes (November 2025)

### Database Migration to PostgreSQL (November 2025)
- **Persistent Storage**: Switched from in-memory storage to PostgreSQL database
- **Data Persistence**: Client, parts, and maintenance data now survives server restarts
- **Database Connection**: Using Neon serverless PostgreSQL with Drizzle ORM
- **Migration Tool**: Database schema changes handled via `npm run db:push`

### Editable Client Parts (November 2025)
- **View Existing Parts**: When editing a client, all current parts are displayed in a "Current Parts" section
- **Edit Quantities**: Change part quantities using number inputs directly in the edit dialog
- **Delete Parts**: Remove parts from a client using the X button next to each part
- **Full Visibility**: No more mystery about what parts a client has - everything is visible and editable

### Monthly PM Schedule Report (November 2025)
- **New Report Tab**: Added "PM Schedule" tab to Reports page alongside Parts Order report
- **Month Selector**: Choose any month to see which clients have preventive maintenance scheduled
- **Client List View**: Shows company name, location, and full PM schedule for each client
- **Visual Schedule**: Badge indicators show all scheduled months, with current selection highlighted
- **Empty State Handling**: Clear messaging when no clients are scheduled for a particular month

### Recently Completed Maintenance View (November 2025)
- **No More Disappearing Jobs**: Completed maintenance now appears in a "Recently Completed (This Month)" section
- **Easy Undo**: Click "Reopen" button to reverse accidental completions
- **Accurate Stats**: Completed count now shows actual number of jobs completed this month
- **Full Details**: Recently completed items show all information (company, location, parts, PM schedule)
- **Seamless Workflow**: Complete and reopen actions work smoothly with toast notifications

### Categorized Parts Selection (November 2025)
- **Separated by Category**: Parts are now organized into three distinct sections when adding to clients
  - **Filters Section**: Shows only filter parts, sorted alphabetically by filterType then size
  - **Belts Section**: Shows only belt parts, sorted alphabetically by beltType then size
  - **Other Parts Section**: Shows only other parts, sorted alphabetically by name
  - Each section has its own "Add Row" button and part dropdown
- **Bulk Addition Across Categories**: Add multiple parts from different categories at once
  - Click "Add Part" button to open the categorized parts panel
  - Click "Add Row" in any section to add a pending part row for that category
  - Select parts from category-specific dropdowns (only shows relevant parts)
  - Click "Add Parts" to commit all pending parts from all categories at once
  - Click "Cancel" to discard all pending parts
- **Improved User Experience**: Clear visual separation makes it easier to find and add the right parts
  - No more scrolling through mixed lists of filters, belts, and other parts
  - Alphabetical sorting within each category for quick lookup
  - Auto-scroll when adding rows ensures new entries are always visible
  - Visible scrollbar for easy navigation back to top of form (wider scrollbar with better contrast)

### Chronological Ordering
- Both parts list and client list now display in chronological order (newest first)
- Added createdAt timestamp to clients and parts tables
- Makes it easy to find recently added items at the top of each list



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

### Client Deletion
- Added delete button (trash icon) to client list table (both desktop and mobile views)
- Implemented confirmation dialog with clear warning about consequences
- Async deletion flow prevents UI from getting stuck
- On success: dialog closes, client removed, queries invalidated, success toast
- On error: dialog stays open, error toast shown, buttons re-enabled for retry
- Backend deletes all client parts and maintenance records before deleting client
- Loading state ("Deleting...") and disabled buttons during deletion prevent duplicate requests

### Parts System Redesign (November 2025)
- Complete redesign of parts inventory system with type-specific fields
- **Filters**: Type dropdown (Pleated, Media, Ecology, Throwaway, Other) + Size field
- **Belts**: Type dropdown (A, B, Other) + Size field
- **Other Parts**: Name + Description fields
- Parts Management now uses tabbed interface (Filters, Belts, Other)
- Bulk addition feature: Add multiple parts at once within each tab
- Add Row button allows building a list of parts before saving
- Duplicate prevention updated for new structure:
  - Filters: Checks filterType + size combination
  - Belts: Checks beltType + size combination
  - Other: Checks name uniqueness
- Bulk creation API endpoint (`POST /api/parts/bulk`) handles multiple parts with partial error reporting
- All displays updated: client parts selection, monthly reports, and parts management
- Monthly reports now include "Other Parts" section with name and description columns

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