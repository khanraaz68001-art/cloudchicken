-- Complete Custom Authentication Schema for Cloud Coop Delivery
-- This completely replaces Supabase Auth with direct phone+password authentication
-- Run this in your Supabase SQL editor to set up the entire system

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Drop existing tables in correct order (foreign key dependencies)
DROP TABLE IF EXISTS public.order_status_history CASCADE;
DROP TABLE IF EXISTS public.trash_records CASCADE;  
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.butchered_meat CASCADE;
DROP TABLE IF EXISTS public.stock CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- 2. Create user_profiles table with custom authentication
CREATE TABLE public.user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  whatsapp_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  role TEXT CHECK (role IN ('customer', 'admin', 'kitchen', 'delivery')) DEFAULT 'customer',
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create categories table (for different chicken weights)
CREATE TABLE public.categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  weight_kg DECIMAL(5,2) NOT NULL,
  rate_per_kg DECIMAL(8,2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create stock table (total available stock)
CREATE TABLE public.stock (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  total_weight_kg DECIMAL(8,2) NOT NULL DEFAULT 0,
  rate_per_kg DECIMAL(8,2) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create butchered_meat table (individual pieces of meat)
CREATE TABLE public.butchered_meat (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES public.categories(id) NOT NULL,
  weight_kg DECIMAL(5,2) NOT NULL,
  status TEXT CHECK (status IN ('available', 'reserved', 'packed', 'delivered', 'trashed')) DEFAULT 'available',
  butchered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create orders table
CREATE TABLE public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) NOT NULL,
  weight_kg DECIMAL(5,2) NOT NULL,
  total_amount DECIMAL(8,2) NOT NULL,
  status TEXT CHECK (status IN ('placed', 'accepted', 'cutting', 'packing', 'out_for_delivery', 'delivered')) DEFAULT 'placed',
  butchered_meat_id UUID REFERENCES public.butchered_meat(id),
  delivery_address TEXT NOT NULL,
  special_instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Create trash_records table (for waste tracking)
CREATE TABLE public.trash_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  butchered_meat_id UUID REFERENCES public.butchered_meat(id) NOT NULL,
  weight_kg DECIMAL(5,2) NOT NULL,
  reason TEXT NOT NULL,
  recorded_by UUID REFERENCES public.user_profiles(id) NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Create order_status_history table (for tracking order status changes)
CREATE TABLE public.order_status_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) NOT NULL,
  status TEXT NOT NULL,
  updated_by UUID REFERENCES public.user_profiles(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Create authentication functions
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

-- 10. Create user registration function
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
    -- Check if user already exists
    IF EXISTS (SELECT 1 FROM public.user_profiles WHERE whatsapp_number = phone_number) THEN
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

-- 11. Create triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers to relevant tables
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_butchered_meat_updated_at BEFORE UPDATE ON public.butchered_meat
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 12. Create business logic functions
CREATE OR REPLACE FUNCTION update_stock_on_butcher()
RETURNS TRIGGER AS $$
DECLARE
    current_stock DECIMAL(8,2);
    meat_weight DECIMAL(8,2);
BEGIN
    -- Get the weight of the butchered meat
    SELECT weight_kg INTO meat_weight FROM public.categories WHERE id = NEW.category_id;
    
    -- Update stock by reducing the weight
    UPDATE public.stock 
    SET total_weight_kg = total_weight_kg - meat_weight,
        updated_at = NOW()
    WHERE id = (SELECT id FROM public.stock LIMIT 1);
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_stock_on_butcher_trigger
    AFTER INSERT ON public.butchered_meat
    FOR EACH ROW EXECUTE FUNCTION update_stock_on_butcher();

-- Track order status changes
CREATE OR REPLACE FUNCTION track_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.order_status_history (order_id, status, updated_by)
        VALUES (NEW.id, NEW.status, NEW.user_id);
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER track_order_status_change_trigger
    AFTER UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION track_order_status_change();

-- 13. Disable RLS (we're using application-level security)
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.butchered_meat DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.trash_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history DISABLE ROW LEVEL SECURITY;

-- 14. Insert initial data
-- Insert initial stock record
INSERT INTO public.stock (total_weight_kg, rate_per_kg) VALUES (0, 450.00);

-- Insert sample categories
INSERT INTO public.categories (name, weight_kg, rate_per_kg) VALUES
('Small Chicken (1kg)', 1.00, 450.00),
('Medium Chicken (1.5kg)', 1.50, 450.00),
('Large Chicken (2kg)', 2.00, 450.00),
('Extra Large Chicken (2.5kg)', 2.50, 450.00),
('Jumbo Chicken (3kg)', 3.00, 450.00);

-- 15. Create default users
-- Create admin user
INSERT INTO public.user_profiles (
    id,
    whatsapp_number,
    name,
    role,
    password_hash,
    created_at
) VALUES (
    gen_random_uuid(),
    '9339935948',
    'Admin User',
    'admin',
    crypt('admin123', gen_salt('bf')),
    NOW()
) ON CONFLICT (whatsapp_number) DO UPDATE SET
    role = 'admin',
    password_hash = crypt('admin123', gen_salt('bf'));

-- Create kitchen staff user
INSERT INTO public.user_profiles (
    id,
    whatsapp_number,
    name,
    role,
    password_hash,
    created_at
) VALUES (
    gen_random_uuid(),
    '9876543211',
    'Kitchen Staff',
    'kitchen',
    crypt('kitchen123', gen_salt('bf')),
    NOW()
) ON CONFLICT (whatsapp_number) DO UPDATE SET
    role = 'kitchen',
    password_hash = crypt('kitchen123', gen_salt('bf'));

-- Create delivery partner
INSERT INTO public.user_profiles (
    id,
    whatsapp_number,
    name,
    role,
    password_hash,
    created_at
) VALUES (
    gen_random_uuid(),
    '9876543212',
    'Delivery Partner',
    'delivery',
    crypt('delivery123', gen_salt('bf')),
    NOW()
) ON CONFLICT (whatsapp_number) DO UPDATE SET
    role = 'delivery',
    password_hash = crypt('delivery123', gen_salt('bf'));

-- 16. Test authentication (uncomment to test)
-- SELECT 'Testing admin login:' as test;
-- SELECT * FROM authenticate_user('9339935948', 'admin123');
-- SELECT 'Testing kitchen login:' as test;
-- SELECT * FROM authenticate_user('9876543211', 'kitchen123');
-- SELECT 'Testing delivery login:' as test;
-- SELECT * FROM authenticate_user('9876543212', 'delivery123');

-- Setup complete! You can now use these credentials:
-- Admin: WhatsApp 9339935948, Password: admin123
-- Kitchen: WhatsApp 9876543211, Password: kitchen123  
-- Delivery: WhatsApp 9876543212, Password: delivery123