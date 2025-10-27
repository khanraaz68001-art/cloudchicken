-- Cloud Coop Delivery Database Schema
-- Run these commands in your Supabase SQL editor

-- Enable Row Level Security (RLS) for all tables
-- This will be configured for each table

-- 1. Create custom user profiles table (extends Supabase auth.users)
CREATE TABLE public.user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  whatsapp_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  role TEXT CHECK (role IN ('customer', 'admin', 'kitchen', 'delivery')) DEFAULT 'customer',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create categories table (for different chicken weights)
CREATE TABLE public.categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, -- e.g., "2kg Chicken", "3kg Chicken"
  weight_kg DECIMAL(5,2) NOT NULL,
  rate_per_kg DECIMAL(8,2), -- Optional rate per kg for this category
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create stock table (total available stock)
CREATE TABLE public.stock (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  total_weight_kg DECIMAL(8,2) NOT NULL DEFAULT 0,
  rate_per_kg DECIMAL(8,2) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial stock record
INSERT INTO public.stock (total_weight_kg, rate_per_kg) VALUES (0, 0);

-- 4. Create butchered_meat table (individual pieces of meat)
CREATE TABLE public.butchered_meat (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES public.categories(id) NOT NULL,
  weight_kg DECIMAL(5,2) NOT NULL,
  status TEXT CHECK (status IN ('available', 'reserved', 'packed', 'delivered', 'trashed')) DEFAULT 'available',
  butchered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create orders table
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

-- 6. Create trash_records table (for waste tracking)
CREATE TABLE public.trash_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  butchered_meat_id UUID REFERENCES public.butchered_meat(id) NOT NULL,
  weight_kg DECIMAL(5,2) NOT NULL,
  reason TEXT NOT NULL, -- e.g., "bones", "unusable parts"
  recorded_by UUID REFERENCES public.user_profiles(id) NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Create order_status_history table (for tracking order status changes)
CREATE TABLE public.order_status_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) NOT NULL,
  status TEXT NOT NULL,
  updated_by UUID REFERENCES public.user_profiles(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create updated_at trigger function
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

-- Create function to update stock when meat is butchered
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

-- Create trigger to update stock when meat is butchered
CREATE TRIGGER update_stock_on_butcher_trigger
    AFTER INSERT ON public.butchered_meat
    FOR EACH ROW EXECUTE FUNCTION update_stock_on_butcher();

-- Create function to track order status changes
CREATE OR REPLACE FUNCTION track_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert into order_status_history when status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.order_status_history (order_id, status, updated_by)
        VALUES (NEW.id, NEW.status, NEW.user_id);
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for order status tracking
CREATE TRIGGER track_order_status_change_trigger
    AFTER UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION track_order_status_change();

-- Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.butchered_meat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trash_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- User Profiles Policies
CREATE POLICY "Users can view their own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.user_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Categories Policies
CREATE POLICY "Anyone can view categories" ON public.categories
    FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Only admins can manage categories" ON public.categories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Stock Policies
CREATE POLICY "Authenticated users can view stock" ON public.stock
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can update stock" ON public.stock
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Butchered Meat Policies
CREATE POLICY "Staff can view butchered meat" ON public.butchered_meat
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'kitchen')
        )
    );

CREATE POLICY "Staff can manage butchered meat" ON public.butchered_meat
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'kitchen')
        )
    );

-- Orders Policies
CREATE POLICY "Users can view their own orders" ON public.orders
    FOR SELECT USING (
        user_id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'kitchen', 'delivery')
        )
    );

CREATE POLICY "Users can create their own orders" ON public.orders
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff can update orders" ON public.orders
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'kitchen', 'delivery')
        )
    );

-- Trash Records Policies
CREATE POLICY "Staff can view trash records" ON public.trash_records
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'kitchen')
        )
    );

CREATE POLICY "Staff can create trash records" ON public.trash_records
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'kitchen')
        )
    );

-- Order Status History Policies
CREATE POLICY "Users can view their order history" ON public.order_status_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.orders o 
            WHERE o.id = order_id AND (
                o.user_id = auth.uid() OR 
                EXISTS (
                    SELECT 1 FROM public.user_profiles 
                    WHERE id = auth.uid() AND role IN ('admin', 'kitchen', 'delivery')
                )
            )
        )
    );

-- Insert sample categories
INSERT INTO public.categories (name, weight_kg, rate_per_kg) VALUES
('Small Chicken (1kg)', 1.00, 450.00),
('Medium Chicken (1.5kg)', 1.50, 450.00),
('Large Chicken (2kg)', 2.00, 450.00),
('Extra Large Chicken (2.5kg)', 2.50, 450.00),
('Jumbo Chicken (3kg)', 3.00, 450.00);

-- Create admin user function (to be called after creating auth user)
CREATE OR REPLACE FUNCTION create_admin_user(
    user_id UUID,
    phone TEXT,
    user_name TEXT
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.user_profiles (id, whatsapp_number, name, role)
    VALUES (user_id, phone, user_name, 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create kitchen user function
CREATE OR REPLACE FUNCTION create_kitchen_user(
    user_id UUID,
    phone TEXT,
    user_name TEXT
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.user_profiles (id, whatsapp_number, name, role)
    VALUES (user_id, phone, user_name, 'kitchen');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;