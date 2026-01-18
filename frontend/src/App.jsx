import React, { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { useAuth } from './contexts/AuthContext'
import TemplateList from './components/TemplateList'
import TemplateEditor from './components/TemplateEditor'
import LanguageSelector from './components/LanguageSelector'
import Login from './components/Login'
import Register from './components/Register'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import './App.css'

const API_BASE = '/api'

// Component to setup axios interceptor with navigate
function AxiosInterceptorSetup() {
  const navigate = useNavigate()

  useEffect(() => {
    // Setup axios interceptor to use navigate instead of window.location.href
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('access_token')
          localStorage.removeItem('user')
          // Use navigate instead of window.location.href
          navigate('/login', { replace: true })
        }
        return Promise.reject(error)
      }
    )

    return () => {
      // Cleanup interceptor
      axios.interceptors.response.eject(responseInterceptor)
    }
  }, [navigate])

  return null
}

function TemplatesPage() {
  const navigate = useNavigate()

  const handleTemplateSelect = (templateId) => {
    navigate(`/templates/${templateId}/edit`)
  }

  return <TemplateList onSelect={handleTemplateSelect} />
}

function TemplateEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const handleBack = () => {
    navigate('/templates')
  }

  return <TemplateEditor templateId={id} onBack={handleBack} />
}

function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  // If already logged in, redirect to templates
  if (user) {
    const from = location.state?.from?.pathname || '/templates'
    return <Navigate to={from} replace />
  }

  return (
    <Login
      onSwitchToRegister={() => navigate('/register')}
      onLoginSuccess={() => {
        const from = location.state?.from?.pathname || '/templates'
        navigate(from, { replace: true })
      }}
    />
  )
}

function RegisterPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // If already logged in, redirect to templates
  if (user) {
    return <Navigate to="/templates" replace />
  }

  return (
    <Register
      onSwitchToLogin={() => navigate('/login')}
      onRegisterSuccess={() => {
        navigate('/login', { replace: true })
      }}
    />
  )
}

function App() {
  return (
    <>
      <AxiosInterceptorSetup />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/templates"
          element={
            <ProtectedRoute>
              <Layout>
                <TemplatesPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/templates/:id/edit"
          element={
            <ProtectedRoute>
              <Layout>
                <TemplateEditPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/templates" replace />} />
        <Route path="*" element={<Navigate to="/templates" replace />} />
      </Routes>
    </>
  )
}

export default App
