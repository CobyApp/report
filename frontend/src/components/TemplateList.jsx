import React, { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import './TemplateList.css'

const API_BASE = '/api'

function TemplateList({ templates, onSelect, onRefresh }) {
  const { t } = useTranslation()
  const fileInputRef = useRef(null)

  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file || file.type !== 'application/pdf') {
      alert(t('templateList.alerts.pdfOnly'))
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await axios.post(`${API_BASE}/templates`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      alert(`${t('templateList.alerts.uploadSuccess')}\nID: ${response.data.template_id}`)
      onRefresh()
    } catch (error) {
      alert(t('templateList.alerts.uploadFailed') + ': ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleDeleteTemplate = async (templateId, filename, e) => {
    e.stopPropagation() // 카드 클릭 이벤트 방지
    
    if (!window.confirm(`"${filename || t('templateList.card.noName')}"${t('templateList.alerts.deleteConfirm')}`)) {
      return
    }

    try {
      await axios.delete(`${API_BASE}/templates/${templateId}`)
      alert(t('templateList.alerts.deleteSuccess'))
      onRefresh()
    } catch (error) {
      alert(t('templateList.alerts.deleteFailed') + ': ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleDeleteAll = async () => {
    if (templates.length === 0) {
      alert(t('templateList.alerts.noTemplatesToDelete'))
      return
    }

    const count = templates.length
    if (!window.confirm(t('templateList.alerts.deleteAllConfirm', { count }))) {
      return
    }

    try {
      const response = await axios.delete(`${API_BASE}/templates`)
      alert(t('templateList.alerts.deleteAllSuccess', { count: response.data.deleted_count }))
      onRefresh()
    } catch (error) {
      alert(t('templateList.alerts.deleteAllFailed') + ': ' + (error.response?.data?.detail || error.message))
    }
  }


  return (
    <div className="template-list">
      <div className="template-list-header">
        <h2>{t('templateList.title')}</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {templates.length > 0 && (
            <button
              onClick={handleDeleteAll}
              className="btn-delete-all"
            >
              🗑️ {t('templateList.deleteAll')}
            </button>
          )}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf"
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-upload"
          >
            + {t('templateList.upload')}
          </button>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="empty-state">
          <p>{t('templateList.empty.title')}</p>
          <p>{t('templateList.empty.description')}</p>
        </div>
      ) : (
        <div className="template-grid">
          {templates.map((template) => (
            <div
              key={template.template_id}
              className="template-card"
              onClick={() => onSelect(template.template_id)}
            >
              <div className="template-card-header">
                <h3>{template.filename || t('templateList.card.noName')}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="template-id">{template.template_id.slice(0, 8)}...</span>
                  <button
                    className="btn-delete-item"
                    onClick={(e) => handleDeleteTemplate(template.template_id, template.filename, e)}
                    title={t('templateList.card.delete')}
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="template-card-body">
                <p>{t('templateList.card.fieldCount')}: {template.element_count || 0}</p>
                <p className="template-date">
                  {t('templateList.card.createdAt')}: {new Date(template.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default TemplateList
