import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database Types
export type User = {
  id: string
  whatsapp_number: string
  name: string
  address?: string
  role: 'customer' | 'admin' | 'kitchen' | 'delivery'
  created_at: string
  password_hash?: string
}

export type Category = {
  id: string
  name: string
  weight_kg: number
  rate_per_kg: number
  created_at: string
}

export type Stock = {
  id: string
  total_weight_kg: number
  rate_per_kg: number
  updated_at: string
}

export type ButcheredMeat = {
  id: string
  category_id: string
  weight_kg: number
  status: 'available' | 'packed' | 'delivered' | 'trashed'
  butchered_at: string
  categories: Category
}

export type Order = {
  id: string
  user_id: string
  weight_kg: number
  total_amount: number
  status:
    | 'pending'
    | 'placed'
    | 'accepted'
    | 'confirmed'
    | 'cutting'
    | 'preparing'
    | 'packing'
    | 'ready'
    | 'out_for_delivery'
    | 'delivered'
    | 'cancelled'
  butchered_meat_id?: string
  delivery_address: string
  created_at: string
  updated_at: string
  users: User
  butchered_meat?: ButcheredMeat
}

export type TrashRecord = {
  id: string
  butchered_meat_id: string
  weight_kg: number
  reason: string
  recorded_at: string
  butchered_meat: ButcheredMeat
}