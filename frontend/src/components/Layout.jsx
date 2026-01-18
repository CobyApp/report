import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LanguageSelector from './LanguageSelector'
import './Layout.css'

function Layout({ children }) {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleBack = () => {
    if (location.pathname.includes('/edit')) {
      navigate('/templates')
    }
  }

  const showBackButton = location.pathname.includes('/edit')

  return (
    <div className="app">
      <header className="app-header">
        <h1>{t('app.title')}</h1>
        <div className="header-actions">
          {showBackButton && (
            <button onClick={handleBack} className="btn-back">
              {t('app.backToList')}
            </button>
          )}
          <div className="user-info">
            <span>{user?.username}</span>
            <button onClick={handleLogout} className="btn-logout">
              {t('auth.logout')}
            </button>
          </div>
          <LanguageSelector />
        </div>
      </header>

      <main className="app-main">
        {children}
      </main>
    </div>
  )
}

export default Layout
