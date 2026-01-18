import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import TemplateList from './components/TemplateList'
import TemplateEditor from './components/TemplateEditor'
import LanguageSelector from './components/LanguageSelector'
import './App.css'

const API_BASE = '/api'

function App() {
  const { t } = useTranslation()
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [view, setView] = useState('list') // 'list' | 'editor' | 'render'

  useEffect(() => {
    loadTemplates()
  }, [])

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
