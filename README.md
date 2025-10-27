# Cloud Coop Delivery - Chicken Management System

A comprehensive chicken delivery management system built with React, TypeScript, Tailwind CSS, and Supabase. This system handles the complete workflow from stock management to order delivery.

## Features

### Customer Features
- **WhatsApp-based Authentication**: Sign up and login using WhatsApp number and password
- **Menu Browsing**: View available chicken categories with dynamic pricing
- **Order Placement**: Place orders with custom weight requirements
- **Order Tracking**: Real-time tracking of order status from placement to delivery
- **Address Management**: Save delivery address for quick future orders

### Admin Features
- **Stock Management**: Update total stock weight and pricing
- **Category Management**: Create and manage chicken weight categories
- **Butchering Process**: Record when chickens are butchered from stock
- **Inventory Tracking**: Monitor all butchered meat and their status
- **Waste Management**: Record and track waste/trash from processing

### Kitchen Features
- **Order Management**: View and process incoming orders
- **Meat Assignment**: Assign specific butchered meat to orders
- **Status Updates**: Update order status through the preparation process
- **WhatsApp Integration**: Send status updates to customers via WhatsApp

### Delivery Partner Features
- **Delivery Queue**: View orders ready for delivery
- **Customer Communication**: Call customers or send WhatsApp messages
- **Map Integration**: Open delivery addresses in Google Maps
- **Delivery Confirmation**: Mark orders as delivered

## Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Authentication, Real-time)
- **Routing**: React Router DOM
- **UI Components**: shadcn/ui
- **State Management**: React Context API
- **Build Tool**: Vite

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone <your-repo-url>
cd cloud-coop-delivery
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Project Settings > API
3. Copy your project URL and anon key

### 3. Environment Configuration

1. Copy `.env.example` to `.env`
2. Fill in your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Database Setup

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Run the SQL commands from `database-schema.sql` file
4. This will create all necessary tables, triggers, and security policies

### 5. Create Admin and Kitchen Users

After running the database schema, you can create admin and kitchen users:

```sql
-- Create admin user (run after creating user in Supabase Auth)
SELECT create_admin_user('user_id_from_auth', 'admin_phone_number', 'Admin Name');

-- Create kitchen user (run after creating user in Supabase Auth)  
SELECT create_kitchen_user('user_id_from_auth', 'kitchen_phone_number', 'Kitchen Staff Name');
```

### 6. Run the Application

```bash
npm run dev
```

## System Workflow

1. **Stock Management**: Admin adds chicken stock with weight and pricing
2. **Category Setup**: Admin creates categories (1kg, 1.5kg, 2kg, etc.)
3. **Butchering**: Admin records when chickens are butchered from stock
4. **Customer Orders**: Customers place orders specifying weight needed
5. **Kitchen Processing**: Kitchen staff accepts orders, assigns meat, updates status
6. **Delivery**: Delivery partners complete orders
7. **Waste Tracking**: Staff records any waste/unusable parts

## WhatsApp Integration

The system includes WhatsApp integration for:
- Order status notifications
- Delivery updates  
- Customer communication
- Pre-filled message templates

## User Roles

- **Customer**: Menu access, order placement, order tracking
- **Admin**: Full system access, stock management, all dashboards
- **Kitchen**: Order processing, meat assignment, status updates
- **Delivery**: Delivery queue, order completion, customer communication

## Database Schema

Key tables: `user_profiles`, `categories`, `stock`, `butchered_meat`, `orders`, `trash_records`, `order_status_history`

Security: Row Level Security (RLS) enabled with role-based access control.
