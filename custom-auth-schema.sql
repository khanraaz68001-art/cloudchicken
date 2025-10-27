-- Custom Authentication System for Cloud Coop Delivery
-- This creates direct phone number + password authentication without OTP
-- Security Note: RLS is disabled for simplicity. Access control is handled at the application level
-- through role-based authentication in the React components.

-- First, fix the user_profiles table structure for custom auth
-- Remove the auth.users reference and make id a standalone UUID primary key
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;
ALTER TABLE public.user_profiles ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Make sure whatsapp_number has a unique constraint for authentication
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_whatsapp_number_key ON public.user_profiles(whatsapp_number);

-- Create authentication function
CREATE OR REPLACE FUNCTION authenticate_user(phone_number TEXT, user_password TEXT)
RETURNS TABLE(
    id UUID,
    whatsapp_number TEXT,
    name TEXT,
    address TEXT,
    role TEXT,
    created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        up.id,
        up.whatsapp_number,
        up.name,
        up.address,
        up.role,
        up.created_at
    FROM public.user_profiles up
    WHERE up.whatsapp_number = phone_number
    AND up.password_hash = crypt(user_password, up.password_hash);
END;
$$;

-- Create user registration function
CREATE OR REPLACE FUNCTION create_user(
    user_name TEXT,
    phone_number TEXT,
    user_password TEXT
)
RETURNS TABLE(
    id UUID,
    whatsapp_number TEXT,
    name TEXT,
    address TEXT,
    role TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_user_id UUID;
BEGIN
    -- Check if user already exists (qualify column to avoid ambiguity with function output variable)
    IF EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.whatsapp_number = phone_number) THEN
        RAISE EXCEPTION 'User with this WhatsApp number already exists';
    END IF;

    -- Generate new UUID
    new_user_id := gen_random_uuid();
    
    -- Insert new user
    INSERT INTO public.user_profiles (
        id,
        whatsapp_number,
        name,
        role,
        password_hash,
        created_at
    ) VALUES (
        new_user_id,
        phone_number,
        user_name,
        'customer',
        crypt(user_password, gen_salt('bf')),
        NOW()
    );
    
    -- Return the created user
    RETURN QUERY
    SELECT 
        up.id,
        up.whatsapp_number,
        up.name,
        up.address,
        up.role,
        up.created_at
    FROM public.user_profiles up
    WHERE up.id = new_user_id;
END;
$$;

-- Create admin user directly
DO $$
DECLARE
    admin_id UUID := gen_random_uuid();
BEGIN
    -- Insert admin user
    INSERT INTO public.user_profiles (
        id,
        whatsapp_number,
        name,
        role,
        password_hash,
        created_at
    ) VALUES (
        admin_id,
        '9339935948',
        'Admin User',
        'admin',
        crypt('admin123', gen_salt('bf')),
        NOW()
    )
    ON CONFLICT (whatsapp_number) DO UPDATE SET
        role = 'admin',
        password_hash = crypt('admin123', gen_salt('bf'));
    
    RAISE NOTICE 'Admin user created/updated - WhatsApp: 9339935948, Password: admin123';
END $$;

-- Create kitchen staff user
DO $$
DECLARE
    user_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO public.user_profiles (
        id,
        whatsapp_number,
        name,
        role,
        password_hash,
        created_at
    ) VALUES (
        user_id,
        '9876543211',
        'Kitchen Staff',
        'kitchen',
        crypt('kitchen123', gen_salt('bf')),
        NOW()
    )
    ON CONFLICT (whatsapp_number) DO UPDATE SET
        role = 'kitchen',
        password_hash = crypt('kitchen123', gen_salt('bf'));
    
    RAISE NOTICE 'Kitchen user created/updated - WhatsApp: 9876543211, Password: kitchen123';
END $$;

-- Create delivery partner
DO $$
DECLARE
    user_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO public.user_profiles (
        id,
        whatsapp_number,
        name,
        role,
        password_hash,
        created_at
    ) VALUES (
        user_id,
        '9876543212',
        'Delivery Partner',
        'delivery',
        crypt('delivery123', gen_salt('bf')),
        NOW()
    )
    ON CONFLICT (whatsapp_number) DO UPDATE SET
        role = 'delivery',
        password_hash = crypt('delivery123', gen_salt('bf'));
    
    RAISE NOTICE 'Delivery user created/updated - WhatsApp: 9876543212, Password: delivery123';
END $$;

-- Disable RLS temporarily to avoid recursion issues
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.butchered_meat DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.trash_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Anyone can view categories" ON public.categories;
DROP POLICY IF EXISTS "Only admins can manage categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can view stock" ON public.stock;
DROP POLICY IF EXISTS "Only admins can update stock" ON public.stock;
DROP POLICY IF EXISTS "Staff can view butchered meat" ON public.butchered_meat;
DROP POLICY IF EXISTS "Staff can manage butchered meat" ON public.butchered_meat;
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can update orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can view trash records" ON public.trash_records;
DROP POLICY IF EXISTS "Staff can create trash records" ON public.trash_records;
DROP POLICY IF EXISTS "Users can view their order history" ON public.order_status_history;

-- For now, disable RLS completely since we're using custom authentication
-- This allows the application to handle access control at the application level
-- The custom auth functions provide security through password verification

-- Test the authentication
-- SELECT * FROM authenticate_user('9339935948', 'admin123');
-- SELECT * FROM authenticate_user('9876543211', 'kitchen123');
-- SELECT * FROM authenticate_user('9876543212', 'delivery123');