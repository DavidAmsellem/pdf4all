import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://epobhkuxfjihnqkukszu.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwb2Joa3V4ZmppaG5xa3Vrc3p1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU5MjE4NzgsImV4cCI6MjA2MTQ5Nzg3OH0.fsr9ks1qIP-l9PDWv8dhPcrzL0_StKmyFT9UDWYuXUQ'

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Faltan las credenciales de Supabase. Verifica tus variables de entorno.')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

// Funciones auxiliares para autenticación
export const auth = {
    // Registro de usuario
    signUp: async (email, password) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        })
        if (error) throw error
        return data
    },

    // Inicio de sesión
    signIn: async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })
        if (error) throw error
        return data
    },

    // Cerrar sesión
    signOut: async () => {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
    },

    // Obtener sesión actual
    getCurrentSession: async () => {
        const { data: { session } } = await supabase.auth.getSession()
        return session
    },

    // Obtener usuario actual
    getCurrentUser: async () => {
        const { data: { user } } = await supabase.auth.getUser()
        return user
    }
}