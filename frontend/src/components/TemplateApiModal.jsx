import React, { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import axios from 'axios'
import './TemplateApiModal.css'

const API_BASE = '/api'

function TemplateApiModal({ template, onClose }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [copiedCode, setCopiedCode] = useState(null)
  const [templateData, setTemplateData] = useState(null)

  // Use current host origin for API base URL (works in both development and production)
  const apiBase = `${window.location.origin}/api`
  const token = user ? localStorage.getItem('access_token') : 'YOUR_ACCESS_TOKEN'
  const templateId = template?.template_id || '{template_id}'

  // Load full template data including elements
  // Reload when template changes or when modal is opened
  useEffect(() => {
    if (templateId && templateId !== '{template_id}') {
      const loadTemplate = async () => {
        try {
          const response = await axios.get(`${API_BASE}/templates/${templateId}`)
          setTemplateData(response.data)
        } catch (error) {
          console.error('Failed to load template data:', error)
        }
      }
      loadTemplate()
      // Reload every 3 seconds to keep API docs updated when template is saved
      const interval = setInterval(loadTemplate, 3000)
      return () => clearInterval(interval)
    }
  }, [templateId, template])

  const copyToClipboard = async (text, id) => {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
        setCopiedCode(id)
        setTimeout(() => setCopiedCode(null), 2000)
      } else {
        // Fallback for older browsers or non-HTTPS
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        
        try {
          const successful = document.execCommand('copy')
          if (successful) {
            setCopiedCode(id)
            setTimeout(() => setCopiedCode(null), 2000)
          } else {
            throw new Error('Copy command failed')
          }
        } catch (err) {
          console.error('Failed to copy:', err)
          alert('Failed to copy to clipboard. Please copy manually.')
        } finally {
          document.body.removeChild(textArea)
        }
      }
    } catch (err) {
      console.error('Failed to copy:', err)
      // Fallback: try execCommand
      try {
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        const successful = document.execCommand('copy')
        document.body.removeChild(textArea)
        
        if (successful) {
          setCopiedCode(id)
          setTimeout(() => setCopiedCode(null), 2000)
        } else {
          alert('Failed to copy to clipboard. Please copy manually.')
        }
      } catch (fallbackErr) {
        console.error('Fallback copy also failed:', fallbackErr)
        alert('Failed to copy to clipboard. Please copy manually.')
      }
    }
  }

  // Generate example request based on template elements
  const generateExampleRequest = (elements) => {
    if (!elements || !Array.isArray(elements)) {
      return {}
    }

    const result = {}

    elements.forEach(element => {
      const dataPath = element.data_path
      if (!dataPath || element.type === 'image') {
        // Skip elements without data_path or image elements
        return
      }

      // Parse data_path and build nested structure
      const parts = dataPath.split('.')
      let current = result

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        const arrayMatch = part.match(/^(.+)\[(\d+)\]$/)
        
        if (arrayMatch) {
          const [, key, indexStr] = arrayMatch
          const index = parseInt(indexStr, 10)
          
          // Initialize array if needed
          if (!current[key]) {
            current[key] = []
          }
          if (!Array.isArray(current[key])) {
            current[key] = [current[key]]
          }
          
          // Ensure array is large enough
          while (current[key].length <= index) {
            current[key].push({})
          }
          
          if (i === parts.length - 1) {
            // Last part - set value
            if (element.type === 'checkbox') {
              current[key][index] = true
            } else {
              current[key][index] = `Example ${element.type} value`
            }
          } else {
            // Move to next level
            if (typeof current[key][index] !== 'object' || current[key][index] === null) {
              current[key][index] = {}
            }
            current = current[key][index]
          }
        } else {
          if (i === parts.length - 1) {
            // Last part - set value
            if (element.type === 'checkbox') {
              current[part] = true
            } else {
              // Generate example value based on data_path
              const exampleValues = {
                'name': 'John Doe',
                'email': 'john@example.com',
                'date': '2024-01-17',
                'price': 10000,
                'quantity': 2,
                'total': 40000,
                'address': '123 Main St',
                'checked': true
              }
              
              const lowerPath = dataPath.toLowerCase()
              let found = false
              for (const [key, value] of Object.entries(exampleValues)) {
                if (lowerPath.includes(key)) {
                  current[part] = value
                  found = true
                  break
                }
              }
              
              if (!found) {
                current[part] = `Example ${element.type} value`
              }
            }
          } else {
            // Create nested object if needed
            if (!current[part]) {
              current[part] = {}
            }
            current = current[part]
          }
        }
      }
    })

    return result
  }

  const exampleRequest = useMemo(() => {
    const elements = templateData?.elements || template?.elements || []
    const generated = generateExampleRequest(elements)
    
    // Return empty object if no elements (don't show default example)
    // This allows users to see that they need to add fields to their template
    return generated
  }, [templateData, template])

  // Generate example code strings based on exampleRequest
  const curlExample = useMemo(() => {
    return `curl -X POST ${apiBase}/render/${templateId} \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(exampleRequest, null, 2).replace(/'/g, "'\\''")}' \\
  --output result.pdf`
  }, [apiBase, templateId, token, exampleRequest])

  const jsExample = useMemo(() => {
    const requestStr = JSON.stringify(exampleRequest, null, 2)
      .replace(/'/g, "\\'")
      .split('\n')
      .map((line, idx) => (idx === 0 ? line : '    ' + line))
      .join('\n')
    return `const response = await fetch('${apiBase}/render/${templateId}', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${token}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(${requestStr})
})

const blob = await response.blob()
const url = window.URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = 'rendered.pdf'
a.click()`
  }, [apiBase, templateId, token, exampleRequest])

  const pythonExample = useMemo(() => {
    const requestStr = JSON.stringify(exampleRequest, null, 4)
      .replace(/true/g, 'True')
      .replace(/false/g, 'False')
      .split('\n')
      .map((line, idx) => (idx === 0 ? line : '    ' + line))
      .join('\n')
    return `import requests

url = "${apiBase}/render/${templateId}"
headers = {
    "Authorization": "Bearer ${token}",
    "Content-Type": "application/json"
}
data = ${requestStr}

response = requests.post(url, json=data, headers=headers)
with open("rendered.pdf", "wb") as f:
    f.write(response.content)`
  }, [apiBase, templateId, token, exampleRequest])

  return (
    <div className="template-api-modal-overlay" onClick={onClose}>
      <div className="template-api-modal" onClick={(e) => e.stopPropagation()}>
        <div className="template-api-modal-header">
          <h2>{t('templateApi.title', 'API Documentation')}</h2>
          <button className="template-api-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="template-api-modal-content">
          <div className="template-api-info">
            <p className="template-api-name">
              <strong>{t('templateApi.template', 'Template')}:</strong> {template?.filename || templateId}
            </p>
            <p className="template-api-id">
              <strong>{t('templateApi.templateId', 'Template ID')}:</strong> <code>{templateId}</code>
            </p>
          </div>

          <div className="template-api-section">
            <h3>{t('templateApi.endpoint.title', 'Endpoint')}</h3>
            <div className="endpoint-info">
              <span className="method-badge method-post">POST</span>
              <code className="endpoint-path">{apiBase}/render/{templateId}</code>
              <button 
                className="copy-btn endpoint-copy-btn"
                onClick={() => copyToClipboard(`${apiBase}/render/${templateId}`, 'endpoint-url')}
                title={t('templateApi.endpoint.copy', 'Copy URL')}
              >
                {copiedCode === 'endpoint-url' ? '✓' : '📋'}
              </button>
            </div>
          </div>

          <div className="template-api-section">
            <h3>{t('templateApi.description.title', 'Description')}</h3>
            <p>{t('templateApi.description.text', 'Generate a completed PDF by mapping field data to this template. The request body should contain JSON data that matches the data paths defined in your template.')}</p>
          </div>

          <div className="template-api-section">
            <h3>{t('templateApi.request.title', 'Request')}</h3>
            <p><strong>{t('templateApi.request.contentType', 'Content-Type')}:</strong> application/json</p>
            <p><strong>{t('templateApi.request.body', 'Request Body')}:</strong></p>
            {Object.keys(exampleRequest).length === 0 ? (
              <div className="api-doc-note" style={{ padding: '1rem', background: '#fef3c7', borderRadius: 'var(--radius-sm)', border: '1px solid #fbbf24' }}>
                <p style={{ margin: 0, color: '#92400e' }}>
                  {t('templateApi.request.noFields', 'No fields defined in this template. Please add fields to your template first.')}
                </p>
              </div>
            ) : (
              <>
                <div className="code-block">
                  <pre><code>{JSON.stringify(exampleRequest, null, 2)}</code></pre>
                  <button 
                    className="copy-btn"
                    onClick={() => copyToClipboard(JSON.stringify(exampleRequest, null, 2), 'request-body')}
                  >
                    {copiedCode === 'request-body' ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <p className="api-doc-note">
                  {t('templateApi.request.note', 'Adjust the field names and values according to your template\'s data paths.')}
                </p>
              </>
            )}
          </div>

          <div className="template-api-section">
            <h3>{t('templateApi.response.title', 'Response')}</h3>
            <p><strong>{t('templateApi.response.contentType', 'Content-Type')}:</strong> application/pdf</p>
            <p>{t('templateApi.response.description', 'Returns the generated PDF file as a binary stream.')}</p>
            <p className="api-doc-note">
              <strong>{t('templateApi.response.filename', 'Filename')}:</strong> rendered_{templateId}.pdf
            </p>
          </div>

          <div className="template-api-section">
            <h3>{t('templateApi.authentication.title', 'Authentication')}</h3>
            <p>{t('templateApi.authentication.description', 'This endpoint requires authentication. Include your access token in the Authorization header:')}</p>
            
            {user && token && token !== 'YOUR_ACCESS_TOKEN' && (
              <div className="token-display">
                <p><strong>{t('templateApi.authentication.yourToken', 'Your Access Token')}:</strong></p>
                <div className="code-block">
                  <code className="token-value">{token}</code>
                  <button 
                    className="copy-btn"
                    onClick={() => copyToClipboard(token, 'access-token')}
                  >
                    {copiedCode === 'access-token' ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
            
            <div className="code-block">
              <code>Authorization: Bearer {token !== 'YOUR_ACCESS_TOKEN' ? token : 'YOUR_ACCESS_TOKEN'}</code>
              <button 
                className="copy-btn"
                onClick={() => copyToClipboard(`Authorization: Bearer ${token !== 'YOUR_ACCESS_TOKEN' ? token : 'YOUR_ACCESS_TOKEN'}`, 'auth-header')}
              >
                {copiedCode === 'auth-header' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {Object.keys(exampleRequest).length > 0 && (
            <div className="template-api-section">
              <h3>{t('templateApi.examples.title', 'Examples')}</h3>

              <div className="example-tabs">
                <div className="example-tab">
                  <h4>cURL</h4>
                  <div className="code-block">
                    <pre><code>{curlExample}</code></pre>
                    <button 
                      className="copy-btn"
                      onClick={() => copyToClipboard(curlExample, 'curl-example')}
                    >
                      {copiedCode === 'curl-example' ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="example-tab">
                  <h4>JavaScript (Fetch API)</h4>
                  <div className="code-block">
                    <pre><code>{jsExample}</code></pre>
                    <button 
                      className="copy-btn"
                      onClick={() => copyToClipboard(jsExample, 'js-example')}
                    >
                      {copiedCode === 'js-example' ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="example-tab">
                  <h4>Python (requests)</h4>
                  <div className="code-block">
                    <pre><code>{pythonExample}</code></pre>
                    <button 
                      className="copy-btn"
                      onClick={() => copyToClipboard(pythonExample, 'python-example')}
                    >
                      {copiedCode === 'python-example' ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="template-api-section">
            <h3>{t('templateApi.errors.title', 'Error Responses')}</h3>
            <div className="errors-list">
              <div className="error-item">
                <span className="error-status">400</span>
                <span className="error-message">{t('templateApi.errors.badRequest', 'Bad request - Invalid data or template structure')}</span>
              </div>
              <div className="error-item">
                <span className="error-status">401</span>
                <span className="error-message">{t('templateApi.errors.unauthorized', 'Unauthorized - Authentication required')}</span>
              </div>
              <div className="error-item">
                <span className="error-status">403</span>
                <span className="error-message">{t('templateApi.errors.forbidden', 'Forbidden - Template does not belong to user')}</span>
              </div>
              <div className="error-item">
                <span className="error-status">404</span>
                <span className="error-message">{t('templateApi.errors.notFound', 'Template not found')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TemplateApiModal
