import React, { useRef } from 'react'
import axios from 'axios'
import './TemplateList.css'

const API_BASE = '/api'

function TemplateList({ templates, onSelect, onRefresh }) {
  const fileInputRef = useRef(null)

  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file || file.type !== 'application/pdf') {
      alert('PDF 파일만 업로드할 수 있습니다.')
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

      alert(`템플릿이 업로드되었습니다!\nID: ${response.data.template_id}`)
      onRefresh()
    } catch (error) {
      alert('업로드 실패: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleDeleteTemplate = async (templateId, filename, e) => {
    e.stopPropagation() // 카드 클릭 이벤트 방지
    
    if (!window.confirm(`"${filename || '템플릿'}"을(를) 삭제하시겠습니까?`)) {
      return
    }

    try {
      await axios.delete(`${API_BASE}/templates/${templateId}`)
      alert('템플릿이 삭제되었습니다.')
      onRefresh()
    } catch (error) {
      alert('삭제 실패: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleDeleteAll = async () => {
    if (templates.length === 0) {
      alert('삭제할 템플릿이 없습니다.')
      return
    }

    const count = templates.length
    if (!window.confirm(`모든 템플릿 (${count}개)을(를) 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      return
    }

    try {
      const response = await axios.delete(`${API_BASE}/templates`)
      alert(`모든 템플릿 (${response.data.deleted_count}개)이 삭제되었습니다.`)
      onRefresh()
    } catch (error) {
      alert('삭제 실패: ' + (error.response?.data?.detail || error.message))
    }
  }


  return (
    <div className="template-list">
      <div className="template-list-header">
        <h2>템플릿 목록</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {templates.length > 0 && (
            <button
              onClick={handleDeleteAll}
              className="btn-delete-all"
            >
              🗑️ 전체 삭제
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
            + PDF 템플릿 업로드
          </button>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="empty-state">
          <p>업로드된 템플릿이 없습니다.</p>
          <p>PDF 템플릿 파일을 업로드하여 시작하세요.</p>
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
                <h3>{template.filename || '이름 없음'}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="template-id">{template.template_id.slice(0, 8)}...</span>
                  <button
                    className="btn-delete-item"
                    onClick={(e) => handleDeleteTemplate(template.template_id, template.filename, e)}
                    title="삭제"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="template-card-body">
                <p>필드 수: {template.element_count || 0}</p>
                <p className="template-date">
                  생성일: {new Date(template.created_at).toLocaleDateString('ko-KR')}
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
