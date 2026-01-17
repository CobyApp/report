import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import './TemplateEditor.css'

const API_BASE = '/api'

function TemplateEditor({ templateId, onBack }) {
  const [template, setTemplate] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [previewImage, setPreviewImage] = useState(null)
  const [elements, setElements] = useState([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [selectedElement, setSelectedElement] = useState(null)
  const [drawStart, setDrawStart] = useState(null)
  const canvasRef = useRef(null)
  const imageRef = useRef(null)
  const [showDataPathInput, setShowDataPathInput] = useState(false)
  const [tempElement, setTempElement] = useState(null)

  useEffect(() => {
    loadTemplate()
  }, [templateId])

  useEffect(() => {
    if (template) {
      loadPreviewImage()
      setElements(template.elements || [])
    }
  }, [template, currentPage])

  const loadTemplate = async () => {
    try {
      const response = await axios.get(`${API_BASE}/templates/${templateId}`)
      setTemplate(response.data)
    } catch (error) {
      alert('템플릿 로드 실패: ' + (error.response?.data?.detail || error.message))
    }
  }

  const loadPreviewImage = async () => {
    try {
      const imageUrl = `${API_BASE}/templates/${templateId}/preview?page=${currentPage}`
      setPreviewImage(imageUrl)
    } catch (error) {
      // 빈 템플릿인 경우 이미지 없음 (null로 두면 빈 캔버스 표시)
      if (error.response?.status === 404) {
        setPreviewImage(null)
      } else {
        console.error('미리보기 로드 실패:', error)
      }
    }
  }

  const getDisplaySize = () => {
    if (!imageRef.current) return { width: 595.28, height: 841.89 }
    const rect = imageRef.current.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  }

  const getPDFSize = () => {
    const pageSize = template?.page_size || { w_pt: 595.28, h_pt: 841.89 }
    return { width: pageSize.w_pt || 595.28, height: pageSize.h_pt || 841.89 }
  }

  const screenToPDF = (x, y, displayW, displayH, pdfW, pdfH) => {
    return {
      x: (x / displayW) * pdfW,
      y: (y / displayH) * pdfH
    }
  }

  const pdfToScreen = (x, y, pdfW, pdfH, displayW, displayH) => {
    return {
      x: (x / pdfW) * displayW,
      y: (y / pdfH) * displayH
    }
  }

  const handleMouseDown = (e) => {
    if (!imageRef.current) return

    const rect = imageRef.current.getBoundingClientRect()
    // 브라우저 확대/축소 등을 고려한 정확한 좌표
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setIsDrawing(true)
    setDrawStart({ x, y })
  }

  const handleMouseMove = (e) => {
    if (!isDrawing || !drawStart || !canvasRef.current || !imageRef.current || !template) return

    const rect = imageRef.current.getBoundingClientRect()
    const displaySize = getDisplaySize()
    const pdfSize = getPDFSize()
    
    // 화면 좌표 (표시 크기 기준)
    const currentX = e.clientX - rect.left
    const currentY = e.clientY - rect.top
    
    // 캔버스를 표시 크기와 정확히 맞춤
    const dpr = window.devicePixelRatio || 1
    canvasRef.current.width = displaySize.width * dpr
    canvasRef.current.height = displaySize.height * dpr
    canvasRef.current.style.width = `${displaySize.width}px`
    canvasRef.current.style.height = `${displaySize.height}px`
    
    const ctx = canvasRef.current.getContext('2d')
    ctx.scale(dpr, dpr) // 고해상도 디스플레이 대응

    // 기존 요소들 다시 그리기
    elements
      .filter(el => el.page === currentPage)
      .forEach(el => {
        drawElement(ctx, el)
      })

    // 새로 그리는 요소 미리보기 (표시 크기 기준)
    const bbox = {
      x: Math.min(drawStart.x, currentX),
      y: Math.min(drawStart.y, currentY),
      w: Math.abs(currentX - drawStart.x),
      h: Math.abs(currentY - drawStart.y),
    }

    ctx.strokeStyle = '#3498db'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h)
  }

  const handleMouseUp = (e) => {
    if (!isDrawing || !drawStart || !imageRef.current || !template) return

    const rect = imageRef.current.getBoundingClientRect()
    const displaySize = getDisplaySize()
    const pdfSize = getPDFSize()
    
    // 화면 좌표 (표시 크기 기준)
    const endX = e.clientX - rect.left
    const endY = e.clientY - rect.top
    
    // 화면 좌표를 PDF 좌표로 변환하여 저장
    const startPDF = screenToPDF(drawStart.x, drawStart.y, displaySize.width, displaySize.height, pdfSize.width, pdfSize.height)
    const endPDF = screenToPDF(endX, endY, displaySize.width, displaySize.height, pdfSize.width, pdfSize.height)

    // PDF 좌표계로 저장 (Y는 화면 좌표계 유지, 백엔드에서 변환)
    const bbox = {
      x: Math.min(startPDF.x, endPDF.x),
      y: Math.min(startPDF.y, endPDF.y), // 화면 좌표계 (위가 0)로 저장
      w: Math.abs(endPDF.x - startPDF.x),
      h: Math.abs(endPDF.y - startPDF.y),
    }

    if (bbox.w > 5 && bbox.h > 5) {
      const newElement = {
        id: `elem_${Date.now()}`,
        type: 'text',
        page: currentPage,
        bbox: bbox,
        data_path: '',
        style: { font: 'Helvetica', size: 10, align: 'left' },
      }

      setTempElement(newElement)
      setShowDataPathInput(true)
    }

    setIsDrawing(false)
    setDrawStart(null)
  }

  const drawElement = (ctx, element) => {
    if (!template || !imageRef.current) return
    
    const displaySize = getDisplaySize()
    const pdfSize = getPDFSize()
    
    const bbox = element.bbox
    // PDF 좌표를 표시 크기 좌표로 변환
    const screenCoords = pdfToScreen(bbox.x, bbox.y, pdfSize.width, pdfSize.height, displaySize.width, displaySize.height)
    const screenSize = pdfToScreen(bbox.w, bbox.h, pdfSize.width, pdfSize.height, displaySize.width, displaySize.height)
    
    const x = screenCoords.x
    const y = screenCoords.y // 화면 좌표계 (위가 0)
    const w = screenSize.x
    const h = screenSize.y
    
    ctx.strokeStyle = element === selectedElement ? '#e74c3c' : '#3498db'
    ctx.lineWidth = element === selectedElement ? 3 : 2
    ctx.setLineDash([])
    ctx.strokeRect(x, y, w, h)

    if (element.data_path) {
      ctx.fillStyle = '#2c3e50'
      ctx.font = '12px sans-serif'
      ctx.fillText(element.data_path, x + 5, y - 5)
    }
  }

  const handleDataPathSubmit = (dataPath) => {
    if (tempElement && dataPath) {
      tempElement.data_path = dataPath
      setElements([...elements, tempElement])
    }
    setShowDataPathInput(false)
    setTempElement(null)
    redrawCanvas()
  }

  const redrawCanvas = () => {
    if (!canvasRef.current || !imageRef.current || !template) return

    const displaySize = getDisplaySize()
    const dpr = window.devicePixelRatio || 1
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    // 캔버스 크기를 표시 크기와 정확히 맞춤
    canvas.width = displaySize.width * dpr
    canvas.height = displaySize.height * dpr
    canvas.style.width = `${displaySize.width}px`
    canvas.style.height = `${displaySize.height}px`
    
    // 고해상도 디스플레이 대응
    ctx.scale(dpr, dpr)
    
    // 캔버스 초기화
    ctx.clearRect(0, 0, displaySize.width, displaySize.height)

    elements
      .filter(el => el.page === currentPage)
      .forEach(el => {
        drawElement(ctx, el)
      })
  }

  useEffect(() => {
    redrawCanvas()
  }, [elements, selectedElement, currentPage])

  const handleElementClick = (element) => {
    setSelectedElement(element)
  }

  const handleDeleteElement = () => {
    if (selectedElement) {
      setElements(elements.filter(el => el.id !== selectedElement.id))
      setSelectedElement(null)
    }
  }

  const handleSave = async () => {
    try {
      await axios.put(`${API_BASE}/templates/${templateId}/mapping`, {
        elements: elements,
        pages: template.pages,
      })
      alert('템플릿 매핑이 저장되었습니다!')
    } catch (error) {
      alert('저장 실패: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleTestRender = async () => {
    const testData = {}
    
    // 데이터 입력받기 (간단한 프롬프트로)
    elements.forEach(el => {
      if (el.data_path && !testData[el.data_path]) {
        const value = prompt(`${el.data_path}에 넣을 값:`)
        if (value !== null) {
          const parts = el.data_path.split('.')
          let obj = testData
          for (let i = 0; i < parts.length - 1; i++) {
            if (!obj[parts[i]]) obj[parts[i]] = {}
            obj = obj[parts[i]]
          }
          obj[parts[parts.length - 1]] = value
        }
      }
    })

    try {
      // 현재 메모리의 elements를 함께 전송 (저장 전에도 반영)
      const response = await axios.post(
        `${API_BASE}/render/${templateId}`,
        {
          ...testData,
          _elements: elements, // 임시로 elements 전송
        },
        { responseType: 'blob' }
      )

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `rendered_${templateId}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      alert('렌더링 실패: ' + (error.response?.data?.detail || error.message))
    }
  }

  if (!template) {
    return <div className="loading">템플릿을 불러오는 중...</div>
  }

  const pageCount = template.pages?.length || 1
  const currentPageElements = elements.filter(el => el.page === currentPage)

  return (
    <div className="template-editor">
      <div className="editor-toolbar">
        <div className="toolbar-section">
          <label>페이지: </label>
          <select
            value={currentPage}
            onChange={(e) => setCurrentPage(Number(e.target.value))}
          >
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((page) => (
              <option key={page} value={page}>
                {page}
              </option>
            ))}
          </select>
        </div>
        <div className="toolbar-actions">
          <button onClick={handleSave} className="btn-save">
            💾 저장
          </button>
          <button onClick={handleTestRender} className="btn-test">
            🧪 테스트 렌더링
          </button>
          {selectedElement && (
            <button onClick={handleDeleteElement} className="btn-delete">
              🗑️ 삭제
            </button>
          )}
        </div>
      </div>

      <div className="editor-content">
        <div className="preview-container">
          <div 
            className="preview-wrapper" 
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => setIsDrawing(false)}
          >
            {previewImage ? (
              <img
                ref={imageRef}
                src={previewImage}
                alt="PDF Preview"
                style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
                onLoad={() => {
                  // 이미지 로드 후 캔버스 크기 조정
                  setTimeout(redrawCanvas, 100)
                }}
                draggable={false}
              />
            ) : (
              <div 
                ref={imageRef}
                style={{
                  width: '595px',
                  height: '842px',
                  background: 'white',
                  border: '1px solid #ddd',
                  position: 'relative',
                  margin: '0 auto',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  color: '#999',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '18px', marginBottom: '10px' }}>📄</div>
                  <div>A4 빈 템플릿</div>
                  <div style={{ fontSize: '12px', marginTop: '5px' }}>595 × 842 pt</div>
                </div>
              </div>
            )}
            <canvas
              ref={canvasRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: 'none',
                display: 'block',
              }}
            />
          </div>
        </div>

        <div className="elements-panel">
          {selectedElement && (
            <div className="properties-section">
              <h3>속성 편집</h3>
              <div className="property-form">
                <div className="property-row">
                  <label>데이터 경로:</label>
                  <input
                    type="text"
                    value={selectedElement.data_path || ''}
                    onChange={(e) => {
                      const updated = elements.map(el => 
                        el.id === selectedElement.id 
                          ? { ...el, data_path: e.target.value }
                          : el
                      )
                      setElements(updated)
                      setSelectedElement({ ...selectedElement, data_path: e.target.value })
                    }}
                    placeholder="예: customer.name"
                  />
                </div>
                <div className="property-row">
                  <label>X:</label>
                  <input
                    type="number"
                    value={Math.round(selectedElement.bbox?.x || 0)}
                    onChange={(e) => {
                      const x = parseFloat(e.target.value) || 0
                      const updated = elements.map(el => 
                        el.id === selectedElement.id 
                          ? { ...el, bbox: { ...el.bbox, x } }
                          : el
                      )
                      setElements(updated)
                      setSelectedElement({ ...selectedElement, bbox: { ...selectedElement.bbox, x } })
                      redrawCanvas()
                    }}
                  />
                </div>
                <div className="property-row">
                  <label>Y:</label>
                  <input
                    type="number"
                    value={Math.round(selectedElement.bbox?.y || 0)}
                    onChange={(e) => {
                      const y = parseFloat(e.target.value) || 0
                      const updated = elements.map(el => 
                        el.id === selectedElement.id 
                          ? { ...el, bbox: { ...el.bbox, y } }
                          : el
                      )
                      setElements(updated)
                      setSelectedElement({ ...selectedElement, bbox: { ...selectedElement.bbox, y } })
                      redrawCanvas()
                    }}
                  />
                </div>
                <div className="property-row">
                  <label>너비:</label>
                  <input
                    type="number"
                    value={Math.round(selectedElement.bbox?.w || 0)}
                    onChange={(e) => {
                      const w = parseFloat(e.target.value) || 0
                      const updated = elements.map(el => 
                        el.id === selectedElement.id 
                          ? { ...el, bbox: { ...el.bbox, w } }
                          : el
                      )
                      setElements(updated)
                      setSelectedElement({ ...selectedElement, bbox: { ...selectedElement.bbox, w } })
                      redrawCanvas()
                    }}
                  />
                </div>
                <div className="property-row">
                  <label>높이:</label>
                  <input
                    type="number"
                    value={Math.round(selectedElement.bbox?.h || 0)}
                    onChange={(e) => {
                      const h = parseFloat(e.target.value) || 0
                      const updated = elements.map(el => 
                        el.id === selectedElement.id 
                          ? { ...el, bbox: { ...el.bbox, h } }
                          : el
                      )
                      setElements(updated)
                      setSelectedElement({ ...selectedElement, bbox: { ...selectedElement.bbox, h } })
                      redrawCanvas()
                    }}
                  />
                </div>
                <div className="property-row">
                  <label>폰트 크기:</label>
                  <input
                    type="number"
                    value={selectedElement.style?.size || 10}
                    onChange={(e) => {
                      const size = parseFloat(e.target.value) || 10
                      const updated = elements.map(el => 
                        el.id === selectedElement.id 
                          ? { ...el, style: { ...el.style, size } }
                          : el
                      )
                      setElements(updated)
                      setSelectedElement({ ...selectedElement, style: { ...selectedElement.style, size } })
                    }}
                  />
                </div>
                <div className="property-row">
                  <label>정렬:</label>
                  <select
                    value={selectedElement.style?.align || 'left'}
                    onChange={(e) => {
                      const align = e.target.value
                      const updated = elements.map(el => 
                        el.id === selectedElement.id 
                          ? { ...el, style: { ...el.style, align } }
                          : el
                      )
                      setElements(updated)
                      setSelectedElement({ ...selectedElement, style: { ...selectedElement.style, align } })
                    }}
                  >
                    <option value="left">왼쪽</option>
                    <option value="center">중앙</option>
                    <option value="right">오른쪽</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="elements-list-section">
            <h3>필드 목록 (페이지 {currentPage})</h3>
          <div className="elements-list">
            {currentPageElements.length === 0 ? (
              <p className="empty-elements">이 페이지에 필드가 없습니다.</p>
            ) : (
              currentPageElements.map((element) => (
                <div
                  key={element.id}
                  className={`element-item ${selectedElement?.id === element.id ? 'selected' : ''}`}
                  onClick={() => handleElementClick(element)}
                >
                  <div className="element-path">{element.data_path || '(경로 없음)'}</div>
                  <div className="element-type">{element.type}</div>
                </div>
              ))
            )}
          </div>
          <div className="instructions">
            <h4>사용 방법</h4>
            <ol>
              <li>템플릿 위에서 드래그하여 필드 영역 선택</li>
              <li>데이터 경로 입력 (예: customer.name)</li>
              <li>필드를 클릭하여 속성 편집</li>
              <li>저장 후 테스트 렌더링</li>
            </ol>
          </div>
        </div>
        </div>
      </div>

      {showDataPathInput && (
        <div className="modal-overlay" onClick={() => setShowDataPathInput(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>데이터 경로 입력</h3>
            <input
              type="text"
              placeholder="예: customer.name, items[0].price"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleDataPathSubmit(e.target.value)
                } else if (e.key === 'Escape') {
                  setShowDataPathInput(false)
                  setTempElement(null)
                }
              }}
            />
            <div className="modal-actions">
              <button onClick={() => handleDataPathSubmit(document.querySelector('.modal-content input').value)}>
                확인
              </button>
              <button onClick={() => setShowDataPathInput(false)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TemplateEditor
