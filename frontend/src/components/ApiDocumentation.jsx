import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import './ApiDocumentation.css'

function ApiDocumentation() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [copiedCode, setCopiedCode] = useState(null)

  const apiBase = 'http://localhost:8000/api'
  const token = user ? localStorage.getItem('access_token') : 'YOUR_ACCESS_TOKEN'

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(id)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const endpoints = [
    {
      id: 'render',
      method: 'POST',
      path: '/api/render/{template_id}',
      title: 'Generate PDF from Template',
      description: 'Generate a completed PDF by mapping field data to a saved template.',
      auth: true,
      requestBody: {
        type: 'application/json',
        schema: {
          customer: {
            name: 'John Doe',
            email: 'john@example.com',
            address: '123 Main St'
          },
          items: [
            { name: 'Item 1', price: 10000, quantity: 2 },
            { name: 'Item 2', price: 20000, quantity: 1 }
          ],
          checked: true,
          total: 40000,
          date: '2024-01-17'
        },
        optionalElements: {
          _elements: [
            {
              id: 'elem1',
              type: 'text',
              page: 1,
              bbox: { x: 100, y: 100, w: 200, h: 20 },
              data_path: 'customer.name'
            }
          ]
        }
      },
      response: {
        type: 'application/pdf',
        description: 'Binary PDF file',
        filename: 'rendered_{template_id}.pdf'
      },
      example: `curl -X POST ${apiBase}/render/{template_id} \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customer": {
      "name": "John Doe",
      "email": "john@example.com"
    },
    "items": [
      {"name": "Item 1", "price": 10000}
    ],
    "checked": true
  }' \\
  --output result.pdf`,
      errors: [
        { status: 400, message: 'Bad request - Invalid data or template structure' },
        { status: 401, message: 'Unauthorized - Authentication required' },
        { status: 403, message: 'Forbidden - Template does not belong to user' },
        { status: 404, message: 'Template not found' }
      ]
    },
    {
      id: 'upload',
      method: 'POST',
      path: '/api/templates',
      title: 'Upload PDF Template',
      description: 'Upload a PDF template file and create a new template.',
      auth: true,
      requestBody: {
        type: 'multipart/form-data',
        schema: {
          file: 'PDF file (A4 recommended)'
        }
      },
      response: {
        type: 'application/json',
        schema: {
          template_id: 'uuid-here',
          filename: 'template.pdf',
          page_count: 1,
          page_size: { w_pt: 595.28, h_pt: 841.89 }
        }
      },
      example: `curl -X POST ${apiBase}/templates \\
  -H "Authorization: Bearer ${token}" \\
  -F "file=@template.pdf"`,
      errors: [
        { status: 400, message: 'Bad request - Invalid file format' },
        { status: 401, message: 'Unauthorized - Authentication required' }
      ]
    },
    {
      id: 'list',
      method: 'GET',
      path: '/api/templates',
      title: 'List Templates',
      description: 'Get a list of all templates belonging to the current user.',
      auth: true,
      requestBody: null,
      response: {
        type: 'application/json',
        schema: {
          templates: [
            {
              template_id: 'uuid-here',
              filename: 'template.pdf',
              created_at: '2024-01-17T...',
              element_count: 5
            }
          ]
        }
      },
      example: `curl -X GET ${apiBase}/templates \\
  -H "Authorization: Bearer ${token}"`,
      errors: [
        { status: 401, message: 'Unauthorized - Authentication required' }
      ]
    },
    {
      id: 'get',
      method: 'GET',
      path: '/api/templates/{template_id}',
      title: 'Get Template Details',
      description: 'Get detailed information about a specific template.',
      auth: true,
      requestBody: null,
      response: {
        type: 'application/json',
        schema: {
          template_id: 'uuid-here',
          filename: 'template.pdf',
          page_size: { w_pt: 595.28, h_pt: 841.89 },
          elements: [],
          created_at: '2024-01-17T...'
        }
      },
      example: `curl -X GET ${apiBase}/templates/{template_id} \\
  -H "Authorization: Bearer ${token}"`,
      errors: [
        { status: 401, message: 'Unauthorized - Authentication required' },
        { status: 403, message: 'Forbidden - Template does not belong to user' },
        { status: 404, message: 'Template not found' }
      ]
    }
  ]

  return (
    <div className="api-documentation">
      <div className="api-doc-header">
        <h1>{t('api.title', 'API Documentation')}</h1>
        <p className="api-doc-subtitle">
          {t('api.subtitle', 'Complete API reference for PDF Template Automation Engine')}
        </p>
      </div>

      <div className="api-doc-content">
        <div className="api-doc-intro">
          <h2>{t('api.intro.title', 'Introduction')}</h2>
          <p>{t('api.intro.description', 'This API allows you to programmatically generate PDFs from templates by providing field data. All endpoints require authentication via Bearer token in the Authorization header.')}</p>
          
          <div className="api-doc-auth">
            <h3>{t('api.auth.title', 'Authentication')}</h3>
            <p>{t('api.auth.description', 'Include your access token in the Authorization header:')}</p>
            <div className="code-block">
              <code>Authorization: Bearer YOUR_ACCESS_TOKEN</code>
              <button 
                className="copy-btn"
                onClick={() => copyToClipboard('Authorization: Bearer YOUR_ACCESS_TOKEN', 'auth')}
              >
                {copiedCode === 'auth' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <p className="api-doc-note">
              {t('api.auth.note', 'Get your access token by logging in at /api/auth/login')}
            </p>
          </div>
        </div>

        {endpoints.map((endpoint) => (
          <div key={endpoint.id} className="api-endpoint">
            <div className="endpoint-header">
              <span className={`method-badge method-${endpoint.method.toLowerCase()}`}>
                {endpoint.method}
              </span>
              <code className="endpoint-path">{endpoint.path}</code>
              {endpoint.auth && (
                <span className="auth-badge">{t('api.auth.required', 'Auth Required')}</span>
              )}
            </div>

            <h3 className="endpoint-title">{endpoint.title}</h3>
            <p className="endpoint-description">{endpoint.description}</p>

            {endpoint.requestBody && (
              <div className="endpoint-section">
                <h4>{t('api.request.title', 'Request')}</h4>
                <p><strong>{t('api.request.contentType', 'Content-Type')}:</strong> {endpoint.requestBody.type}</p>
                
                {endpoint.requestBody.type === 'application/json' && (
                  <>
                    <p><strong>{t('api.request.body', 'Request Body')}:</strong></p>
                    <div className="code-block">
                      <pre>
                        <code>{JSON.stringify(endpoint.requestBody.schema, null, 2)}</code>
                      </pre>
                      <button 
                        className="copy-btn"
                        onClick={() => copyToClipboard(JSON.stringify(endpoint.requestBody.schema, null, 2), `request-${endpoint.id}`)}
                      >
                        {copiedCode === `request-${endpoint.id}` ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                    
                    {endpoint.requestBody.optionalElements && (
                      <>
                        <p className="api-doc-note">
                          <strong>{t('api.request.optional', 'Optional')}:</strong> {t('api.request.optionalElements', 'Include _elements for test rendering')}
                        </p>
                        <div className="code-block">
                          <pre>
                            <code>{JSON.stringify(endpoint.requestBody.optionalElements, null, 2)}</code>
                          </pre>
                          <button 
                            className="copy-btn"
                            onClick={() => copyToClipboard(JSON.stringify(endpoint.requestBody.optionalElements, null, 2), `optional-${endpoint.id}`)}
                          >
                            {copiedCode === `optional-${endpoint.id}` ? '✓ Copied' : 'Copy'}
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}

                {endpoint.requestBody.type === 'multipart/form-data' && (
                  <div className="code-block">
                    <pre>
                      <code>{JSON.stringify(endpoint.requestBody.schema, null, 2)}</code>
                    </pre>
                    <button 
                      className="copy-btn"
                      onClick={() => copyToClipboard(JSON.stringify(endpoint.requestBody.schema, null, 2), `request-${endpoint.id}`)}
                    >
                      {copiedCode === `request-${endpoint.id}` ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="endpoint-section">
              <h4>{t('api.response.title', 'Response')}</h4>
              <p><strong>{t('api.response.contentType', 'Content-Type')}:</strong> {endpoint.response.type}</p>
              
              {endpoint.response.type === 'application/pdf' ? (
                <p>{endpoint.response.description} ({t('api.response.filename', 'filename')}: {endpoint.response.filename})</p>
              ) : (
                <>
                  <p><strong>{t('api.response.body', 'Response Body')}:</strong></p>
                  <div className="code-block">
                    <pre>
                      <code>{JSON.stringify(endpoint.response.schema, null, 2)}</code>
                    </pre>
                    <button 
                      className="copy-btn"
                      onClick={() => copyToClipboard(JSON.stringify(endpoint.response.schema, null, 2), `response-${endpoint.id}`)}
                    >
                      {copiedCode === `response-${endpoint.id}` ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="endpoint-section">
              <h4>{t('api.example.title', 'Example')}</h4>
              <div className="code-block">
                <pre>
                  <code>{endpoint.example}</code>
                </pre>
                <button 
                  className="copy-btn"
                  onClick={() => copyToClipboard(endpoint.example, `example-${endpoint.id}`)}
                >
                  {copiedCode === `example-${endpoint.id}` ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {endpoint.errors && endpoint.errors.length > 0 && (
              <div className="endpoint-section">
                <h4>{t('api.errors.title', 'Error Responses')}</h4>
                <div className="errors-list">
                  {endpoint.errors.map((error, idx) => (
                    <div key={idx} className="error-item">
                      <span className="error-status">{error.status}</span>
                      <span className="error-message">{error.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        <div className="api-doc-footer">
          <h2>{t('api.moreInfo.title', 'More Information')}</h2>
          <p>{t('api.moreInfo.description', 'For interactive API documentation with live testing, visit:')}</p>
          <ul>
            <li><strong>Swagger UI:</strong> <a href="http://localhost:8000/docs" target="_blank" rel="noopener noreferrer">http://localhost:8000/docs</a></li>
            <li><strong>ReDoc:</strong> <a href="http://localhost:8000/redoc" target="_blank" rel="noopener noreferrer">http://localhost:8000/redoc</a></li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default ApiDocumentation
