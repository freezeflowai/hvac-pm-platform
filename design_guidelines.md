# HVAC/R Maintenance Scheduler - Design Guidelines

## Design Approach: Design System-Based (Material Design for Productivity)

**Rationale:** This is a utility-focused productivity tool where efficiency, clarity, and data organization are paramount. Material Design provides the robust patterns needed for dashboard layouts, data tables, and calendar interfaces while maintaining professional aesthetics suitable for contractor workflows.

## Typography

**Font Stack:** Inter (via Google Fonts CDN)
- **Headings:** 
  - H1: 2xl (24px), semibold - Dashboard title, page headers
  - H2: xl (20px), semibold - Section headers
  - H3: lg (18px), medium - Card titles, modal headers
- **Body:** base (16px), normal - All content, form labels
- **Small:** sm (14px), normal - Metadata, helper text, table data
- **Numeric Data:** tabular-nums for consistent alignment

## Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, and 8 consistently
- Component padding: p-4 or p-6
- Section margins: mb-6 or mb-8
- Card gaps: gap-4 or gap-6
- Form field spacing: space-y-4

**Grid Structure:**
- Dashboard: 12-column grid with responsive breakpoints
- Main content: max-w-7xl container with px-4 sm:px-6 lg:px-8
- Calendar: Full-width within container
- Cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3

## Component Library

### Navigation
**Top Navigation Bar:**
- Full-width header with company branding (left)
- Primary actions: "Add Client" button (right)
- Simple, professional layout with subtle bottom border

**Sidebar Navigation (Optional for future expansion):**
- Dashboard, Clients, Calendar, Reports

### Dashboard Components

**Stats Cards (3-4 cards in row):**
- Large metric number (text-3xl, bold)
- Descriptive label below (text-sm)
- Subtle icon (Heroicons) top-right
- Light background with border

**Maintenance Lists:**
- Grouped by status: Overdue (priority), This Week, This Month
- Each item shows: Client name, location, schedule type, due date
- Quick action: Mark Complete button
- Visual distinction for overdue items

**Calendar View:**
- Month view as default
- Color-coded dots for different schedule types
- Click dates to see scheduled maintenance
- Compact, information-dense layout

### Forms & Inputs

**Add/Edit Client Form:**
- Modal overlay with centered card
- Fields: Company Name (required), Location (required), Schedule Type (dropdown)
- Large, clear input fields with labels above
- Action buttons: Cancel (secondary) and Save (primary) aligned right

**Schedule Type Dropdown:**
- Options: Monthly, Quarterly, Semi-Annual, Custom
- Clear selection indicator

### Data Display

**Client List/Table:**
- Searchable header with filter dropdown
- Columns: Company Name, Location, Schedule Type, Next Due, Actions
- Row hover state for interactivity
- Responsive: cards on mobile, table on desktop

**Status Indicators:**
- Overdue: Red accent
- Due Soon (within 7 days): Yellow/amber accent  
- Upcoming: Neutral/gray
- Completed: Green checkmark icon

### Buttons & Actions

**Primary Actions:** Solid background, medium size (px-4 py-2)
**Secondary Actions:** Outlined border, same size
**Icon Buttons:** For quick actions (edit, delete, mark complete)
**Icon Library:** Heroicons (via CDN)

## Visual Hierarchy

**Information Priority:**
1. Overdue maintenance (most prominent)
2. Upcoming maintenance (secondary prominence)
3. Completed/archived (least prominent)

**Card Elevation:**
- Flat design with subtle borders (border-gray-200)
- Minimal shadows (shadow-sm on hover)
- Clean, professional aesthetic

## Responsive Behavior

**Mobile (< 768px):**
- Stack stats cards vertically
- Convert tables to card layouts
- Simplified calendar view
- Full-width modals

**Tablet (768px - 1024px):**
- 2-column card grids
- Condensed table layouts

**Desktop (> 1024px):**
- 3-4 column card grids
- Full table views
- Multi-panel dashboard

## Animations

**Minimal, Purposeful Animations:**
- Smooth transitions for modals (200ms ease)
- Subtle hover states on interactive elements
- No distracting page transitions or scroll effects

## Images

**No hero images needed** - This is a data-focused application where screen space should prioritize functional content. Focus on clean layouts and clear data visualization.

## Key Design Principles

1. **Clarity First:** Information should be immediately scannable
2. **Efficient Workflows:** Minimize clicks to complete common tasks
3. **Professional Aesthetic:** Clean, trustworthy design suitable for business use
4. **Data Density:** Show relevant information without overwhelming
5. **Mobile-Capable:** Contractors may check schedules on-site