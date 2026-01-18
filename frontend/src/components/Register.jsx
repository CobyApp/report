import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import './Login.css'

function Register({ onSwitchToLogin, onRegisterSuccess }) {
  const { t } = useTranslation()
  const { register } = useAuth()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError(t('auth.register.passwordMismatch'))
      return
    }

    // Password length limit (bcrypt is limited to 72 bytes)
    const passwordBytes = new TextEncoder().encode(password).length
    if (passwordBytes > 72) {
      setError(t('auth.register.passwordTooLong'))
      return
    }

    setLoading(true)

    const result = await register(username, email, password)
    
    if (result.success) {
      // Switch to login after successful registration
      alert(t('auth.register.success'))
      setUsername('')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      if (onRegisterSuccess) {
        onRegisterSuccess()
      }
    } else {
      setError(result.error)
    }
    
    setLoading(false)
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>{t('auth.register.title')}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{t('auth.register.username')}</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label>{t('auth.register.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label>{t('auth.register.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label>{t('auth.register.confirmPassword')}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? t('auth.register.loading') : t('auth.register.submit')}
          </button>
        </form>
        <div className="auth-switch">
          <span>{t('auth.register.hasAccount')}</span>
          <button onClick={onSwitchToLogin} className="btn-link">
            {t('auth.register.login')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Register
