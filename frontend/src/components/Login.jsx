import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import './Login.css'

function Login({ onSwitchToRegister, onLoginSuccess }) {
  const { t } = useTranslation()
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await login(username, password)
    
    if (result.success) {
      if (onLoginSuccess) {
        onLoginSuccess()
      }
    } else {
      setError(result.error)
    }
    
    setLoading(false)
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>{t('auth.login.title')}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{t('auth.login.username')}</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label>{t('auth.login.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? t('auth.login.loading') : t('auth.login.submit')}
          </button>
        </form>
        <div className="auth-switch">
          <span>{t('auth.login.noAccount')}</span>
          <button onClick={onSwitchToRegister} className="btn-link">
            {t('auth.login.register')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Login
