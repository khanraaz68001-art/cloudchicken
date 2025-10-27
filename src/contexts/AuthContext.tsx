import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase, User } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  userProfile: User | null
  loading: boolean
  signIn: (whatsappNumber: string, password: string) => Promise<{ error?: string }>
  signUp: (name: string, whatsappNumber: string, password: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  refreshUserProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is logged in from localStorage
    const storedUser = localStorage.getItem('cloudcoop_user')
    if (storedUser) {
      const userData = JSON.parse(storedUser)
      setUser(userData)
      setUserProfile(userData)
    }
    setLoading(false)
  }, [])

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching user profile:', error)
      return null
    }
  }

  const signIn = async (whatsappNumber: string, password: string) => {
    try {
      setLoading(true)
      
      // Call custom authentication function
      const { data, error } = await supabase.rpc('authenticate_user', {
        phone_number: whatsappNumber,
        user_password: password
      })

      if (error) throw error
      
      if (!data || data.length === 0) {
        return { error: 'Invalid WhatsApp number or password' }
      }

      const userData = data[0]
      
      // Store user data
      setUser(userData)
      setUserProfile(userData)
      localStorage.setItem('cloudcoop_user', JSON.stringify(userData))
      
      return {}
    } catch (error: any) {
      return { error: error.message }
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (name: string, whatsappNumber: string, password: string) => {
    try {
      setLoading(true)
      
      // Call custom signup function
      const { data, error } = await supabase.rpc('create_user', {
        user_name: name,
        phone_number: whatsappNumber,
        user_password: password
      })

      if (error) throw error
      
      if (!data || data.length === 0) {
        return { error: 'Failed to create user' }
      }

      const userData = data[0]
      
      // Store user data
      setUser(userData)
      setUserProfile(userData)
      localStorage.setItem('cloudcoop_user', JSON.stringify(userData))
      
      return {}
    } catch (error: any) {
      return { error: error.message }
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    setUser(null)
    setUserProfile(null)
    localStorage.removeItem('cloudcoop_user')
  }

  const refreshUserProfile = async () => {
    try {
      const storedUser = localStorage.getItem('cloudcoop_user')
      const userId = storedUser ? JSON.parse(storedUser).id : user?.id
      if (!userId) return
      const data = await fetchUserProfile(userId)
      if (data) {
        setUserProfile(data)
        localStorage.setItem('cloudcoop_user', JSON.stringify(data))
      }
    } catch (e) {
      console.warn('Failed to refresh user profile', e)
    }
  }

  const value = {
    user,
    userProfile,
    loading,
    signIn,
    signUp,
    signOut,
    refreshUserProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}