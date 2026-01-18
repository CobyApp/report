import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { useAuth } from './contexts/AuthContext'
import TemplateList from './components/TemplateList'
import TemplateEditor from './components/TemplateEditor'
import LanguageSelector from './components/LanguageSelector'
import Login from './components/Login'
import Register from './components/Register'
import './App.css'

const API_BASE = '/api'

function App() {
  const { t } = useTranslation()
  const { user, loading: authLoading, logout } = useAuth()
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [view, setView] = useState('list') // 'list' | 'editor' | 'render'
  const [authView, setAuthView] = useState('login') // 'login' | 'register'

  useEffect(() => {
    if (user) {
      loadTemplates()
    }
  }, [user])

  const loadTemplates = async () => {
    try {
      const response = await axios.get(`${API_BASE}/templates`)
      setTemplates(response.data.templates || [])
    } catch (error) {
      console.error('템플릿 목록 로드 실패:', error)
    }
  }

  const handleTemplateSelect = (templateId) => {
    setSelectedTemplate(templateId)
    setView('editor')
  }

  const handleBackToList = () => {
    setSelectedTemplate(null)
    setView('list')
    loadTemplates()
  }

  // 로딩 중이면 아무것도 표시하지 않음
  if (authLoading) {
    return <div className="loading">{t('templateEditor.loading')}</div>
  }

  // 로그인하지 않은 경우 로그인/회원가입 페이지 표시
  if (!user) {
    return (
      <>
        {authView === 'login' ? (
          <Login onSwitchToRegister={() => setAuthView('register')} />
        ) : (
          <Register onSwitchToLogin={() => setAuthView('login')} />
        )}
      </>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>{t('app.title')}</h1>
        <div className="header-actions">
          {view !== 'list' && (
            <button onClick={handleBackToList} className="btn-back">
              {t('app.backToList')}
            </button>
          )}
          <div className="user-info">
            <span>{user.username}</span>
            <button onClick={logout} className="btn-logout">
              {t('auth.logout')}
            </button>
          </div>
          <LanguageSelector />
        </div>
      </header>

      <main className="app-main">
        {view === 'list' && (
          <TemplateList
            templates={templates}
            onSelect={handleTemplateSelect}
            onRefresh={loadTemplates}
          />
        )}
        {view === 'editor' && selectedTemplate && (
          <TemplateEditor
            templateId={selectedTemplate}
            onBack={handleBackToList}
          />
        )}
      </main>
    </div>
  )
}

export default App
