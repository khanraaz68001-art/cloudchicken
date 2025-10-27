-- 🔍 DATABASE STRUCTURE CHECKER
-- Run this to see what tables exist and their structure

-- List all tables in the public schema
SELECT 
    'EXISTING TABLES' as info,
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check if specific tables exist
SELECT 
    'TABLE EXISTENCE CHECK' as info,
    'stock_summary' as table_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_summary') 
        THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as status
UNION ALL
SELECT 
    'TABLE EXISTENCE CHECK' as info,
    'user_profiles' as table_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') 
        THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as status
UNION ALL
SELECT 
    'TABLE EXISTENCE CHECK' as info,
    'individual_chickens' as table_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'individual_chickens') 
        THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as status
UNION ALL
SELECT 
    'TABLE EXISTENCE CHECK' as info,
    'stock_batches' as table_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_batches') 
        THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as status
UNION ALL
SELECT 
    'TABLE EXISTENCE CHECK' as info,
    'products' as table_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') 
        THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as status
UNION ALL
SELECT 
    'TABLE EXISTENCE CHECK' as info,
    'product_categories' as table_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_categories') 
        THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as status
UNION ALL
SELECT 
    'TABLE EXISTENCE CHECK' as info,
    'enhanced_waste_records' as table_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'enhanced_waste_records') 
        THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as status
UNION ALL
SELECT 
    'TABLE EXISTENCE CHECK' as info,
    'orders' as table_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') 
        THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as status;

-- Check available functions
SELECT 
    'AVAILABLE FUNCTIONS' as info,
    routine_name as function_name,
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('add_stock_batch', 'butcher_chicken', 'record_waste', 'get_waste_summary', 'update_stock_summary')
ORDER BY routine_name;

-- If stock_summary table exists, show its structure
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_summary') THEN
        -- This will show in the query results if run separately
        RAISE NOTICE 'stock_summary table exists - check columns with: SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ''stock_summary'';';
    ELSE
        RAISE NOTICE 'stock_summary table does not exist - need to create it';
    END IF;
END $$;

-- Show columns of stock_summary if it exists (run this separately if needed)
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'stock_summary' 
-- ORDER BY ordinal_position;