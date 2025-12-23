-- ================================================================
-- CRITICAL PERFORMANCE INDEXES FOR MULTI-TENANT SAAS
-- ================================================================
-- Run this migration BEFORE going to production
-- These indexes are essential for query performance as data grows
-- ================================================================

-- CLIENTS TABLE
-- Most queries filter by companyId + inactive status
CREATE INDEX IF NOT EXISTS idx_clients_company_active 
  ON clients(company_id, inactive) 
  WHERE inactive = false;

-- For location lookups by name
CREATE INDEX IF NOT EXISTS idx_clients_company_name 
  ON clients(company_id, company_name);

-- For parent company queries
CREATE INDEX IF NOT EXISTS idx_clients_parent_company 
  ON clients(parent_company_id) 
  WHERE parent_company_id IS NOT NULL;

-- JOBS TABLE
-- Most common query: jobs by company and status
CREATE INDEX IF NOT EXISTS idx_jobs_company_status 
  ON jobs(company_id, status) 
  WHERE is_active = true;

-- For scheduled jobs queries
CREATE INDEX IF NOT EXISTS idx_jobs_company_scheduled 
  ON jobs(company_id, scheduled_start) 
  WHERE is_active = true;

-- For location-specific job queries
CREATE INDEX IF NOT EXISTS idx_jobs_location 
  ON jobs(location_id) 
  WHERE is_active = true;

-- For technician schedule queries
CREATE INDEX IF NOT EXISTS idx_jobs_technicians 
  ON jobs USING GIN (assigned_technician_ids);

-- CALENDAR ASSIGNMENTS TABLE
-- Primary query pattern: company + date range
CREATE INDEX IF NOT EXISTS idx_calendar_company_date 
  ON calendar_assignments(company_id, scheduled_date);

-- For client-specific assignment queries
CREATE INDEX IF NOT EXISTS idx_calendar_client 
  ON calendar_assignments(client_id, scheduled_date);

-- For completion status queries
CREATE INDEX IF NOT EXISTS idx_calendar_completion 
  ON calendar_assignments(company_id, completed, scheduled_date);

-- INVOICES TABLE
-- Most common: invoices by company and status
CREATE INDEX IF NOT EXISTS idx_invoices_company_status 
  ON invoices(company_id, status) 
  WHERE is_active = true;

-- For job-invoice linkage
CREATE INDEX IF NOT EXISTS idx_invoices_job 
  ON invoices(job_id) 
  WHERE job_id IS NOT NULL AND is_active = true;

-- For location billing queries
CREATE INDEX IF NOT EXISTS idx_invoices_location 
  ON invoices(location_id) 
  WHERE is_active = true;

-- For date-based invoice queries
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date 
  ON invoices(company_id, issue_date) 
  WHERE is_active = true;

-- INVOICE LINES TABLE
-- Lines are always queried by invoice
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice 
  ON invoice_lines(invoice_id, line_number);

-- JOB PARTS TABLE
-- Parts are always queried by job
CREATE INDEX IF NOT EXISTS idx_job_parts_job 
  ON job_parts(job_id, sort_order) 
  WHERE is_active = true;

-- For product linkage queries
CREATE INDEX IF NOT EXISTS idx_job_parts_product 
  ON job_parts(product_id) 
  WHERE is_active = true;

-- PARTS TABLE (PRODUCTS/SERVICES)
-- Most queries: by company with active filter
CREATE INDEX IF NOT EXISTS idx_parts_company_active 
  ON parts(company_id, is_active) 
  WHERE is_active = true;

-- For search queries by name/SKU
CREATE INDEX IF NOT EXISTS idx_parts_search 
  ON parts(company_id, name) 
  WHERE is_active = true;

-- USERS TABLE
-- Company lookups (already have index from FK, but explicit is better)
CREATE INDEX IF NOT EXISTS idx_users_company 
  ON users(company_id, disabled) 
  WHERE disabled = false;

-- Email lookups (already unique, but compound for performance)
CREATE INDEX IF NOT EXISTS idx_users_email_company 
  ON users(email, company_id);

-- EQUIPMENT TABLE
-- Equipment is always queried by client
CREATE INDEX IF NOT EXISTS idx_equipment_client 
  ON equipment(client_id, is_active) 
  WHERE is_active = true;

-- CLIENT PARTS TABLE
-- Client parts queries
CREATE INDEX IF NOT EXISTS idx_client_parts_client 
  ON client_parts(client_id);

CREATE INDEX IF NOT EXISTS idx_client_parts_part 
  ON client_parts(part_id);

-- JOB EQUIPMENT TABLE
-- Job equipment lookups
CREATE INDEX IF NOT EXISTS idx_job_equipment_job 
  ON job_equipment(job_id);

CREATE INDEX IF NOT EXISTS idx_job_equipment_equipment 
  ON job_equipment(equipment_id);

-- JOB TEMPLATES TABLE
-- Template queries by company and type
CREATE INDEX IF NOT EXISTS idx_job_templates_company_type 
  ON job_templates(company_id, job_type) 
  WHERE is_active = true;

-- Default template lookups
CREATE INDEX IF NOT EXISTS idx_job_templates_default 
  ON job_templates(company_id, job_type, is_default_for_job_type) 
  WHERE is_active = true AND is_default_for_job_type = true;

-- JOB TEMPLATE LINE ITEMS TABLE
-- Always queried by template
CREATE INDEX IF NOT EXISTS idx_job_template_lines_template 
  ON job_template_line_items(template_id, sort_order);

-- TECHNICIAN PROFILES TABLE
-- userId is PK, but good to have explicit index
CREATE INDEX IF NOT EXISTS idx_technician_profiles_user 
  ON technician_profiles(user_id);

-- WORKING HOURS TABLE
-- Always queried by user
CREATE INDEX IF NOT EXISTS idx_working_hours_user 
  ON working_hours(user_id, day_of_week);

-- AUDIT LOGS TABLE
-- Audit queries by company and time
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_time 
  ON company_audit_logs(company_id, created_at DESC);

-- For user-specific audit trails
CREATE INDEX IF NOT EXISTS idx_audit_logs_user 
  ON company_audit_logs(user_id, created_at DESC);

-- COMPANY COUNTERS TABLE
-- Company ID is already unique, but explicit index helps
CREATE INDEX IF NOT EXISTS idx_company_counters_company 
  ON company_counters(company_id);

-- ================================================================
-- ANALYZE TABLES
-- ================================================================
-- Update table statistics for query planner
ANALYZE clients;
ANALYZE jobs;
ANALYZE calendar_assignments;
ANALYZE invoices;
ANALYZE invoice_lines;
ANALYZE job_parts;
ANALYZE parts;
ANALYZE users;
ANALYZE equipment;
ANALYZE job_templates;
ANALYZE job_template_line_items;

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================
-- Run these after migration to verify indexes were created:

-- List all indexes on critical tables:
-- SELECT tablename, indexname, indexdef 
-- FROM pg_indexes 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('clients', 'jobs', 'invoices', 'parts')
-- ORDER BY tablename, indexname;

-- Check index usage (run after some production traffic):
-- SELECT 
--   schemaname,
--   tablename,
--   indexname,
--   idx_scan as index_scans,
--   idx_tup_read as tuples_read,
--   idx_tup_fetch as tuples_fetched
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY idx_scan DESC;