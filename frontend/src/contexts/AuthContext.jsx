import React, { createContext, useState, useContext, useEffect } from 'react'
import axios from 'axios'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

const API_BASE = '/api'

// axios interceptor setup: include token in all requests
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// axios interceptor for 401 errors will be set up in App.jsx with navigate
// This allows React Router to handle navigation properly

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check user info with saved token
    const token = localStorage.getItem('access_token')
    const savedUser = localStorage.getItem('user')
    
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch (e) {
        console.error('Failed to parse saved user:', e)
      }
    }
    
    setLoading(false)
  }, [])

  const login = async (username, password) => {
    try {
      const response = await axios.post(`${API_BASE}/auth/login`, {
        username,
        password,
      })
      
      const { access_token, user: userData } = response.data
      localStorage.setItem('access_token', access_token)
      localStorage.setItem('user', JSON.stringify(userData))
      setUser(userData)
      
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Login failed',
      }
    }
  }

  const register = async (username, email, password) => {
    try {
      const response = await axios.post(`${API_BASE}/auth/register`, {
        username,
        email,
        password,
      })
      
      return { success: true, user: response.data.user }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Registration failed',
      }
    }
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
