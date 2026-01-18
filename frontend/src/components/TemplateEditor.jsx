import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import './TemplateEditor.css'

const API_BASE = '/api'

function TemplateEditor({ templateId, onBack }) {
  const { t } = useTranslation()
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
  const [selectedTool, setSelectedTool] = useState('select') // 'select', 'text', 'checkbox', 'image'
  const [showImageUpload, setShowImageUpload] = useState(false)
  const imageInputRef = useRef(null)
  const [isDraggingElement, setIsDraggingElement] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState(null) // 'nw', 'ne', 'sw', 'se'
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [currentCursor, setCurrentCursor] = useState('default')
  const imageCacheRef = useRef(new Map()) // 이미지 캐시
  const [dragStartBbox, setDragStartBbox] = useState(null) // 드래그 시작 시 요소의 원본 bbox

  useEffect(() => {
    loadTemplate()
  }, [templateId])

  useEffect(() => {
    if (template) {
      loadPreviewImage()
      setElements(template.elements || [])
    }
  }, [template, currentPage])

  // 전역 마우스 이벤트 리스너 (드래그가 캔버스 밖으로 나가도 계속 추적)
  useEffect(() => {
    if (!isDraggingElement && !isResizing) return

    const handleGlobalMouseMove = (e) => {
      if (!imageRef.current || !canvasRef.current || !template || !drawStart || !dragStartBbox) return
      
      const rect = imageRef.current.getBoundingClientRect()
      const currentX = e.clientX - rect.left
      const currentY = e.clientY - rect.top
      
      const displaySize = getDisplaySize()
      const pdfSize = getPDFSize()
      
      if (isDraggingElement && selectedElement) {
        const deltaX = currentX - drawStart.x
        const deltaY = currentY - drawStart.y
        const deltaPDF = screenToPDF(deltaX, deltaY, displaySize.width, displaySize.height, pdfSize.width, pdfSize.height)
        
        const updated = elements.map(el => 
          el.id === selectedElement.id 
            ? { ...el, bbox: { 
                ...dragStartBbox,
                x: dragStartBbox.x + deltaPDF.x, 
                y: dragStartBbox.y + deltaPDF.y 
              } }
            : el
        )
        setElements(updated)
        redrawCanvas()
      } else if (isResizing && selectedElement && resizeHandle) {
        const startScreen = pdfToScreen(dragStartBbox.x, dragStartBbox.y, pdfSize.width, pdfSize.height, displaySize.width, displaySize.height)
        const startSize = pdfToScreen(dragStartBbox.w, dragStartBbox.h, pdfSize.width, pdfSize.height, displaySize.width, displaySize.height)
        
        let newX = startScreen.x
        let newY = startScreen.y
        let newW = startSize.x
        let newH = startSize.y
        
        const deltaX = currentX - drawStart.x
        const deltaY = currentY - drawStart.y
        const isCheckbox = selectedElement.type === 'checkbox'
        
        if (resizeHandle === 'nw') {
          newX += deltaX
          newY += deltaY
          newW -= deltaX
          newH -= deltaY
          if (isCheckbox) {
            const size = Math.max(Math.abs(newW), Math.abs(newH))
            newW = size
            newH = size
            newX = startScreen.x + startSize.x - size
            newY = startScreen.y + startSize.y - size
          }
        } else if (resizeHandle === 'ne') {
          newY += deltaY
          newW += deltaX
          newH -= deltaY
          if (isCheckbox) {
            const size = Math.max(Math.abs(newW), Math.abs(newH))
            newW = size
            newH = size
            newY = startScreen.y + startSize.y - size
          }
        } else if (resizeHandle === 'sw') {
          newX += deltaX
          newW -= deltaX
          newH += deltaY
          if (isCheckbox) {
            const size = Math.max(Math.abs(newW), Math.abs(newH))
            newW = size
            newH = size
            newX = startScreen.x + startSize.x - size
          }
        } else if (resizeHandle === 'se') {
          newW += deltaX
          newH += deltaY
          if (isCheckbox) {
            const size = Math.max(Math.abs(newW), Math.abs(newH))
            newW = size
            newH = size
          }
        }
        
        if (newW < 5) newW = 5
        if (newH < 5) newH = 5
        if (isCheckbox) {
          const size = Math.max(newW, newH, 5)
          newW = size
          newH = size
        }
        
        const newBboxPDF = {
          x: screenToPDF(newX, newY, displaySize.width, displaySize.height, pdfSize.width, pdfSize.height).x,
          y: screenToPDF(newX, newY, displaySize.width, displaySize.height, pdfSize.width, pdfSize.height).y,
          w: screenToPDF(newW, newH, displaySize.width, displaySize.height, pdfSize.width, pdfSize.height).x,
          h: screenToPDF(newW, newH, displaySize.width, displaySize.height, pdfSize.width, pdfSize.height).y,
        }
        
        const updated = elements.map(el => 
          el.id === selectedElement.id 
            ? { ...el, bbox: newBboxPDF }
            : el
        )
        setElements(updated)
        redrawCanvas()
      }
    }

    const handleGlobalMouseUp = () => {
      setIsDraggingElement(false)
      setIsResizing(false)
      setResizeHandle(null)
      setDrawStart(null)
      
      if (selectedElement && selectedElement.type === 'checkbox') {
        const bbox = selectedElement.bbox
        const size = Math.max(bbox.w, bbox.h, 5)
        const updated = elements.map(el => 
          el.id === selectedElement.id 
            ? { ...el, bbox: { ...el.bbox, w: size, h: size } }
            : el
        )
        setElements(updated)
      }
      
      setDragStartBbox(null)
      redrawCanvas()
    }

    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove)
      window.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [isDraggingElement, isResizing, selectedElement, resizeHandle, drawStart, dragStartBbox, elements, template, currentPage])

  const loadTemplate = async () => {
    try {
      const response = await axios.get(`${API_BASE}/templates/${templateId}`)
      setTemplate(response.data)
    } catch (error) {
      alert(t('templateEditor.alerts.loadFailed') + ': ' + (error.response?.data?.detail || error.message))
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

  // 클릭한 위치의 요소 찾기
  const getElementAtPoint = (x, y) => {
    const displaySize = getDisplaySize()
    const pdfSize = getPDFSize()
    const pointPDF = screenToPDF(x, y, displaySize.width, displaySize.height, pdfSize.width, pdfSize.height)
    
    // 역순으로 검색 (마지막에 그린 것이 위에 있음)
    const pageElements = elements.filter(el => el.page === currentPage)
    for (let i = pageElements.length - 1; i >= 0; i--) {
      const el = pageElements[i]
      const bbox = el.bbox
      if (pointPDF.x >= bbox.x && pointPDF.x <= bbox.x + bbox.w &&
          pointPDF.y >= bbox.y && pointPDF.y <= bbox.y + bbox.h) {
        return el
      }
    }
    return null
  }

  // 리사이즈 핸들 위치 확인
  const getResizeHandle = (element, x, y) => {
    if (!element || element !== selectedElement) return null
    
    const displaySize = getDisplaySize()
    const pdfSize = getPDFSize()
    const pointPDF = screenToPDF(x, y, displaySize.width, displaySize.height, pdfSize.width, pdfSize.height)
    
    const screenCoords = pdfToScreen(element.bbox.x, element.bbox.y, pdfSize.width, pdfSize.height, displaySize.width, displaySize.height)
    const screenSize = pdfToScreen(element.bbox.w, element.bbox.h, pdfSize.width, pdfSize.height, displaySize.width, displaySize.height)
    
    const handleSize = 8 // 핸들 크기 (픽셀)
    const x1 = screenCoords.x
    const y1 = screenCoords.y
    const x2 = x1 + screenSize.x
    const y2 = y1 + screenSize.y
    
    // 모서리 핸들 확인
    if (Math.abs(x - x1) < handleSize && Math.abs(y - y1) < handleSize) return 'nw'
    if (Math.abs(x - x2) < handleSize && Math.abs(y - y1) < handleSize) return 'ne'
    if (Math.abs(x - x1) < handleSize && Math.abs(y - y2) < handleSize) return 'sw'
    if (Math.abs(x - x2) < handleSize && Math.abs(y - y2) < handleSize) return 'se'
    
    return null
  }

  const handleMouseDown = (e) => {
    if (!imageRef.current || !template) return

    const rect = imageRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const displaySize = getDisplaySize()
    const pdfSize = getPDFSize()

    if (selectedTool === 'select') {
      // 선택 도구: 요소 선택, 이동, 리사이즈
      const handle = selectedElement ? getResizeHandle(selectedElement, x, y) : null
      
      if (handle) {
        // 리사이즈 시작
        setIsResizing(true)
        setResizeHandle(handle)
        setDragStartBbox({ ...selectedElement.bbox }) // 원본 bbox 저장
        setDrawStart({ x, y }) // 리사이즈 시작 위치 저장
        e.preventDefault() // 기본 동작 방지
      } else {
        const clickedElement = getElementAtPoint(x, y)
        
        if (clickedElement) {
          // 요소 선택 및 이동 시작
          setSelectedElement(clickedElement)
          setIsDraggingElement(true)
          setDragStartBbox({ ...clickedElement.bbox }) // 원본 bbox 저장
          setDrawStart({ x, y }) // 드래그 시작 위치 저장
          e.preventDefault() // 기본 동작 방지
        } else {
          // 빈 공간 클릭 시 선택 해제
          setSelectedElement(null)
        }
      }
    } else if (selectedTool === 'checkbox') {
      // 체크박스: 클릭으로 바로 추가 (모달 없이)
      const pointPDF = screenToPDF(x, y, displaySize.width, displaySize.height, pdfSize.width, pdfSize.height)
      const size = 15 // 기본 체크박스 크기 (pt)
      
      const newElement = {
        id: `elem_${Date.now()}`,
        type: 'checkbox',
        page: currentPage,
        bbox: {
          x: pointPDF.x - size / 2,
          y: pointPDF.y - size / 2,
          w: size,
          h: size,
        },
        data_path: 'checked',
      }
      
      // 모달이 열려있으면 닫기
      setShowDataPathInput(false)
      setTempElement(null)
      
      setElements([...elements, newElement])
      redrawCanvas()
    } else if (selectedTool === 'image') {
      // 이미지: 클릭으로 영역 선택 시작 (기본 크기로 시작)
      setIsDrawing(true)
      setDrawStart({ x, y })
      
      // 기본 영역 크기로 시작
      const defaultSize = 50 // 기본 이미지 영역 크기 (표시 크기)
      const tempBbox = {
        x: x - defaultSize / 2,
        y: y - defaultSize / 2,
        w: defaultSize,
        h: defaultSize,
      }
      
      const pointPDF = screenToPDF(tempBbox.x, tempBbox.y, displaySize.width, displaySize.height, pdfSize.width, pdfSize.height)
      const sizePDF = screenToPDF(tempBbox.w, tempBbox.h, displaySize.width, displaySize.height, pdfSize.width, pdfSize.height)
      
      setTempElement({
        id: `elem_${Date.now()}`,
        type: 'image',
        page: currentPage,
        bbox: {
          x: pointPDF.x,
          y: pointPDF.y,
          w: sizePDF.x,
          h: sizePDF.y,
        },
        image_path: '',
        data_path: '',
      })
    } else {
      // 텍스트 도구: 드래그로 영역 생성
      setIsDrawing(true)
      setDrawStart({ x, y })
    }
  }

  const handleMouseMove = (e) => {
    if (!canvasRef.current || !imageRef.current || !template) return

    const rect = imageRef.current.getBoundingClientRect()
    const displaySize = getDisplaySize()
    const pdfSize = getPDFSize()
    const currentX = e.clientX - rect.left
    const currentY = e.clientY - rect.top
    
    // 캔버스를 표시 크기와 정확히 맞춤
    const dpr = window.devicePixelRatio || 1
    canvasRef.current.width = displaySize.width * dpr
    canvasRef.current.height = displaySize.height * dpr
    canvasRef.current.style.width = `${displaySize.width}px`
    canvasRef.current.style.height = `${displaySize.height}px`
    
    const ctx = canvasRef.current.getContext('2d')
    ctx.scale(dpr, dpr)

    // 드래그/리사이즈는 전역 리스너에서 처리 (캔버스 밖으로 나가도 계속 추적)
    // 여기서는 커서, 미리보기, 핸들 그리기만 처리
    if (selectedTool === 'select') {
      // 커서 및 리사이즈 핸들 그리기
    } else if ((selectedTool === 'text' || selectedTool === 'image') && isDrawing && drawStart) {
      // 텍스트/이미지 드래그 미리보기
      const bbox = {
        x: Math.min(drawStart.x, currentX),
        y: Math.min(drawStart.y, currentY),
        w: Math.abs(currentX - drawStart.x),
        h: Math.abs(currentY - drawStart.y),
      }

      // 기존 요소들 다시 그리기
      const currentSelectedElement = selectedElement ? elements.find(el => el.id === selectedElement.id) : null
      elements
        .filter(el => el.page === currentPage)
        .forEach(el => {
          drawElement(ctx, el, currentSelectedElement)
        })

      ctx.strokeStyle = '#3498db'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h)
      return
    }

    // 기존 요소들 다시 그리기 (select 도구용)
    if (selectedTool === 'select') {
      // elements 배열에서 최신 요소를 찾아 사용 (selectedElement는 오래된 bbox를 가질 수 있음)
      const currentSelectedElement = selectedElement ? elements.find(el => el.id === selectedElement.id) : null
      elements
        .filter(el => el.page === currentPage)
        .forEach(el => {
          drawElement(ctx, el, currentSelectedElement)
        })
      
      // 커서 모양 결정 및 리사이즈 핸들 그리기
      if (!isDraggingElement && !isResizing) {
        const handle = currentSelectedElement ? getResizeHandle(currentSelectedElement, currentX, currentY) : null
        const hoveredElement = getElementAtPoint(currentX, currentY)
        
        // 커서 모양 설정
        if (handle) {
          const cursors = { nw: 'nw-resize', ne: 'ne-resize', sw: 'sw-resize', se: 'se-resize' }
          setCurrentCursor(cursors[handle])
        } else if (hoveredElement || selectedElement) {
          setCurrentCursor('move')
        } else {
          setCurrentCursor('default')
        }
      } else {
        // 드래그/리사이즈 중에도 커서 유지
        if (isDraggingElement) {
          setCurrentCursor('move')
        } else if (isResizing && resizeHandle) {
          const cursors = { nw: 'nw-resize', ne: 'ne-resize', sw: 'sw-resize', se: 'se-resize' }
          setCurrentCursor(cursors[resizeHandle])
        }
      }
      
      // 선택된 요소의 리사이즈 핸들 그리기 (드래그/리사이즈 중에도 업데이트된 위치에 그리기)
      // elements 배열에서 최신 요소를 찾아 사용 (selectedElement는 오래된 bbox를 가질 수 있음)
      if (selectedElement) {
        const currentElement = elements.find(el => el.id === selectedElement.id)
        if (currentElement) {
          const screenCoords = pdfToScreen(currentElement.bbox.x, currentElement.bbox.y, pdfSize.width, pdfSize.height, displaySize.width, displaySize.height)
          const screenSize = pdfToScreen(currentElement.bbox.w, currentElement.bbox.h, pdfSize.width, pdfSize.height, displaySize.width, displaySize.height)
          
          const x1 = screenCoords.x
          const y1 = screenCoords.y
          const x2 = x1 + screenSize.x
          const y2 = y1 + screenSize.y
          
          ctx.fillStyle = '#e74c3c'
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 2
          
          // 리사이즈 핸들 그리기 (업데이트된 위치)
          const handleSize = 8
          const handles = [
            [x1 - handleSize/2, y1 - handleSize/2], // nw
            [x2 - handleSize/2, y1 - handleSize/2], // ne
            [x1 - handleSize/2, y2 - handleSize/2], // sw
            [x2 - handleSize/2, y2 - handleSize/2], // se
          ]
          
          handles.forEach(([hx, hy]) => {
            ctx.fillRect(hx, hy, handleSize, handleSize)
            ctx.strokeRect(hx, hy, handleSize, handleSize)
          })
        }
      }
    } else {
      setCurrentCursor('default')
      elements
        .filter(el => el.page === currentPage)
        .forEach(el => {
          drawElement(ctx, el)
        })
    }
  }

  const handleMouseUp = (e) => {
    if (!imageRef.current || !template) return

    if (selectedTool === 'select') {
      // 선택 도구: 드래그/리사이즈 종료
      if (isDraggingElement || isResizing) {
        setIsDraggingElement(false)
        setIsResizing(false)
        setResizeHandle(null)
        setDrawStart(null)
        setDragStartBbox(null)
        
        // 체크박스는 정사각형으로 정규화
        if (selectedElement && selectedElement.type === 'checkbox') {
          const bbox = selectedElement.bbox
          const size = Math.max(bbox.w, bbox.h, 5)
          const updated = elements.map(el => 
            el.id === selectedElement.id 
              ? { ...el, bbox: { ...el.bbox, w: size, h: size } }
              : el
          )
          setElements(updated)
        }
        
        redrawCanvas()
      }
      return
    }

    // 텍스트/이미지 도구: 드래그로 영역 생성
    if (!isDrawing || !drawStart) return

    const rect = imageRef.current.getBoundingClientRect()
    const displaySize = getDisplaySize()
    const pdfSize = getPDFSize()
    
    const endX = e.clientX - rect.left
    const endY = e.clientY - rect.top
    
    const startPDF = screenToPDF(drawStart.x, drawStart.y, displaySize.width, displaySize.height, pdfSize.width, pdfSize.height)
    const endPDF = screenToPDF(endX, endY, displaySize.width, displaySize.height, pdfSize.width, pdfSize.height)

    const bbox = {
      x: Math.min(startPDF.x, endPDF.x),
      y: Math.min(startPDF.y, endPDF.y),
      w: Math.abs(endPDF.x - startPDF.x),
      h: Math.abs(endPDF.y - startPDF.y),
    }

    if (selectedTool === 'image') {
      // 이미지 도구: 드래그가 끝나면 이미지 업로드 모달 표시
      if (bbox.w > 5 && bbox.h > 5 || tempElement) {
        const finalBbox = bbox.w > 5 && bbox.h > 5 ? bbox : (tempElement?.bbox || bbox)
        setTempElement({
          id: tempElement?.id || `elem_${Date.now()}`,
          type: 'image',
          page: currentPage,
          bbox: finalBbox,
          image_path: '',
          data_path: '',
        })
        setShowImageUpload(true)
        if (imageInputRef.current) {
          imageInputRef.current.click()
        }
      }
    } else if (selectedTool === 'text' && bbox.w > 5 && bbox.h > 5) {
      // 텍스트 도구: 데이터 경로 입력 모달
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
    } else if (selectedTool === 'checkbox') {
      // 체크박스는 handleMouseDown에서 이미 처리되므로 여기서는 아무것도 하지 않음
      // 혹시 모를 모달 표시 방지
      setShowDataPathInput(false)
      setTempElement(null)
    }

    setIsDrawing(false)
    setDrawStart(null)
  }

  const drawElement = (ctx, element, currentSelectedElement = null) => {
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
    
    const isSelected = currentSelectedElement ? element.id === currentSelectedElement.id : false
    ctx.strokeStyle = isSelected ? '#e74c3c' : '#3498db'
    ctx.lineWidth = isSelected ? 3 : 2
    ctx.setLineDash([])
    
    // 요소 타입별로 다른 스타일
    if (element.type === 'checkbox') {
      // 체크박스: 항상 영역 표시 + 체크 표시도 화면에 그리기
      ctx.strokeStyle = isSelected ? '#e74c3c' : '#3498db'
      ctx.lineWidth = element === selectedElement ? 3 : 2
      ctx.setLineDash(element === selectedElement ? [3, 3] : [5, 5])
      ctx.strokeRect(x, y, w, h)
      
      // 체크 표시 그리기 (data_path가 있으면 체크된 것으로 간주)
      if (element.data_path) {
        const size = Math.min(w, h)
        const checkSize = size * 0.6
        const centerX = x + size / 2
        const centerY = y + size / 2
        
        ctx.strokeStyle = '#000000'
        ctx.fillStyle = '#000000'
        ctx.lineWidth = Math.max(2.5, Math.min(5, size / 8))
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.setLineDash([])
        
        // 체크 표시 (더 굵고 명확한 ✓ 모양)
        const offset = checkSize * 0.3
        ctx.beginPath()
        // 왼쪽 아래에서 시작
        ctx.moveTo(centerX - offset * 0.8, centerY)
        // 중앙으로
        ctx.lineTo(centerX - offset * 0.2, centerY + offset * 0.6)
        // 오른쪽 위로
        ctx.lineTo(centerX + offset * 1.0, centerY - offset * 0.4)
        ctx.stroke()
      }
    } else if (element.type === 'image') {
      // 이미지: 실제 이미지를 캔버스에 그리기
      if (element.image_path) {
        const imagePath = `${API_BASE}/uploads/${element.image_path}`
        const cachedImg = imageCacheRef.current.get(imagePath)
        
        if (cachedImg && cachedImg.complete) {
          // 캐시된 이미지 사용
          try {
            ctx.drawImage(cachedImg, x, y, w, h)
            // 선택된 경우 테두리 표시
            if (isSelected) {
              ctx.strokeStyle = '#e74c3c'
              ctx.lineWidth = 3
              ctx.setLineDash([3, 3])
              ctx.strokeRect(x, y, w, h)
            }
          } catch (e) {
            // 이미지 그리기 실패 시 점선 사각형 표시
            ctx.setLineDash([5, 5])
            ctx.strokeStyle = isSelected ? '#e74c3c' : '#3498db'
            ctx.strokeRect(x, y, w, h)
            ctx.fillStyle = '#2c3e50'
            ctx.font = '12px sans-serif'
            ctx.fillText('🖼️ 이미지', x + 5, y - 5)
          }
        } else {
          // 이미지 로드 중이거나 캐시에 없음
          const img = new Image()
          img.crossOrigin = 'anonymous'
          
          img.onload = () => {
            imageCacheRef.current.set(imagePath, img)
            redrawCanvas()
          }
          
          img.onerror = () => {
            // 이미지 로드 실패 시 점선 사각형 표시
            ctx.setLineDash([5, 5])
            ctx.strokeStyle = isSelected ? '#e74c3c' : '#3498db'
            ctx.strokeRect(x, y, w, h)
            ctx.fillStyle = '#2c3e50'
            ctx.font = '12px sans-serif'
            ctx.fillText('🖼️ (로드 실패)', x + 5, y - 5)
          }
          
          img.src = imagePath
          
          // 로딩 중 표시
          ctx.setLineDash([5, 5])
          ctx.strokeStyle = isSelected ? '#e74c3c' : '#3498db'
          ctx.strokeRect(x, y, w, h)
          ctx.fillStyle = '#2c3e50'
          ctx.font = '12px sans-serif'
          ctx.fillText('🖼️ 로딩...', x + 5, y - 5)
        }
      } else {
        // 이미지 경로가 없음
        ctx.setLineDash([5, 5])
        ctx.strokeStyle = isSelected ? '#e74c3c' : '#3498db'
        ctx.strokeRect(x, y, w, h)
        ctx.fillStyle = '#2c3e50'
        ctx.font = '12px sans-serif'
        ctx.fillText('🖼️ (이미지 없음)', x + 5, y - 5)
      }
    } else {
      // 텍스트는 일반 사각형
      ctx.strokeRect(x, y, w, h)
      if (element.data_path) {
        ctx.fillStyle = '#2c3e50'
        ctx.font = '12px sans-serif'
        ctx.fillText(element.data_path, x + 5, y - 5)
      }
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

  const handleImageUpload = async (file) => {
    if (!file || !tempElement) return

    const formData = new FormData()
    formData.append('file', file)

    try {
      // 이미지 업로드
      const uploadResponse = await axios.post(`${API_BASE}/images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      
      // 이미지 크기 확인하여 bbox 자동 조정
      const img = new Image()
      const imageUrl = URL.createObjectURL(file)
      
      img.onload = () => {
        const displaySize = getDisplaySize()
        const pdfSize = getPDFSize()
        
        // 이미지 비율 유지하면서 bbox 조정
        const imgWidth = img.width
        const imgHeight = img.height
        const imgAspect = imgWidth / imgHeight
        
        let newW = tempElement.bbox.w
        let newH = tempElement.bbox.h
        const currentAspect = newW / newH
        
        if (imgAspect > currentAspect) {
          // 이미지가 더 넓음: 너비 기준
          newH = newW / imgAspect
        } else {
          // 이미지가 더 높음: 높이 기준
          newW = newH * imgAspect
        }
        
        tempElement.image_path = uploadResponse.data.image_path
        tempElement.bbox = {
          ...tempElement.bbox,
          w: newW,
          h: newH,
        }
        
        setElements([...elements, tempElement])
        setShowImageUpload(false)
        setTempElement(null)
        URL.revokeObjectURL(imageUrl)
        redrawCanvas()
      }
      
      img.onerror = () => {
        // 이미지 로드 실패 시 기본 크기 유지
        tempElement.image_path = uploadResponse.data.image_path
        setElements([...elements, tempElement])
        setShowImageUpload(false)
        setTempElement(null)
        URL.revokeObjectURL(imageUrl)
        redrawCanvas()
      }
      
      img.src = imageUrl
    } catch (error) {
      alert(t('templateEditor.alerts.imageUploadFailed') + ': ' + (error.response?.data?.detail || error.message))
    }
  }

  const redrawCanvas = () => {
    if (!canvasRef.current || !imageRef.current || !template) return

    const displaySize = getDisplaySize()
    const pdfSize = getPDFSize()
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

    // 요소들 그리기
    // selectedElement와 비교할 때 최신 요소를 사용하기 위해 selectedElement를 elements에서 찾음
    const currentSelectedElement = selectedElement ? elements.find(el => el.id === selectedElement.id) : null
    elements
      .filter(el => el.page === currentPage)
      .forEach(el => {
        drawElement(ctx, el, currentSelectedElement)
      })
    
    // 선택된 요소의 리사이즈 핸들 그리기 (redrawCanvas에서도 처리)
    // elements 배열에서 최신 요소를 찾아 사용
    if (selectedElement && selectedTool === 'select') {
      const currentElement = elements.find(el => el.id === selectedElement.id)
      if (currentElement) {
        const screenCoords = pdfToScreen(currentElement.bbox.x, currentElement.bbox.y, pdfSize.width, pdfSize.height, displaySize.width, displaySize.height)
        const screenSize = pdfToScreen(currentElement.bbox.w, currentElement.bbox.h, pdfSize.width, pdfSize.height, displaySize.width, displaySize.height)
        
        const x1 = screenCoords.x
        const y1 = screenCoords.y
        const x2 = x1 + screenSize.x
        const y2 = y1 + screenSize.y
        
        ctx.fillStyle = '#e74c3c'
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        
        // 리사이즈 핸들 그리기
        const handleSize = 8
        const handles = [
          [x1 - handleSize/2, y1 - handleSize/2], // nw
          [x2 - handleSize/2, y1 - handleSize/2], // ne
          [x1 - handleSize/2, y2 - handleSize/2], // sw
          [x2 - handleSize/2, y2 - handleSize/2], // se
        ]
        
        handles.forEach(([hx, hy]) => {
          ctx.fillRect(hx, hy, handleSize, handleSize)
          ctx.strokeRect(hx, hy, handleSize, handleSize)
        })
      }
    }
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
      alert(t('templateEditor.alerts.saveSuccess'))
    } catch (error) {
      alert(t('templateEditor.alerts.saveFailed') + ': ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleTestRender = async () => {
    const testData = {}
    
    // 데이터 입력받기 (간단한 프롬프트로)
    elements.forEach(el => {
      if (el.data_path && !testData[el.data_path]) {
        const value = prompt(t('templateEditor.alerts.testRenderPrompt', { path: el.data_path }))
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
      alert(t('templateEditor.alerts.renderFailed') + ': ' + (error.response?.data?.detail || error.message))
    }
  }

  if (!template) {
    return <div className="loading">{t('templateEditor.loading')}</div>
  }

  const pageCount = template.pages?.length || 1
  const currentPageElements = elements.filter(el => el.page === currentPage)

  return (
    <div className="template-editor">
      <div className="editor-toolbar">
        <div className="toolbar-section">
          <label>{t('templateEditor.page')}: </label>
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
            💾 {t('templateEditor.save')}
          </button>
          <button onClick={handleTestRender} className="btn-test">
            🧪 {t('templateEditor.testRender')}
          </button>
          {selectedElement && (
            <button onClick={handleDeleteElement} className="btn-delete">
              🗑️ {t('templateEditor.delete')}
            </button>
          )}
        </div>
      </div>

      <div className="editor-content">
        {/* 플로팅 도구함 */}
        <div className="floating-toolbar">
          <div className="floating-tools">
            <button
              className={`tool-btn ${selectedTool === 'select' ? 'active' : ''}`}
              onClick={() => setSelectedTool('select')}
              title={t('templateEditor.tools.select')}
            >
              👆
            </button>
            <button
              className={`tool-btn ${selectedTool === 'text' ? 'active' : ''}`}
              onClick={() => setSelectedTool('text')}
              title={t('templateEditor.tools.text')}
            >
              📝
            </button>
            <button
              className={`tool-btn ${selectedTool === 'checkbox' ? 'active' : ''}`}
              onClick={() => setSelectedTool('checkbox')}
              title={t('templateEditor.tools.checkbox')}
            >
              ☑️
            </button>
            <button
              className={`tool-btn ${selectedTool === 'image' ? 'active' : ''}`}
              onClick={() => setSelectedTool('image')}
              title={t('templateEditor.tools.image')}
            >
              🖼️
            </button>
          </div>
        </div>

        <div className="preview-container">
          <div 
            className="preview-wrapper" 
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              setIsDrawing(false)
              setCurrentCursor('default')
            }}
            style={{ cursor: currentCursor }}
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
                  <div>{t('templateEditor.blankTemplate.title')}</div>
                  <div style={{ fontSize: '12px', marginTop: '5px' }}>{t('templateEditor.blankTemplate.size')}</div>
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
              <h3>{t('templateEditor.properties.title')}</h3>
              <div className="property-form">
                <div className="property-row">
                  <label>{t('templateEditor.properties.dataPath')}:</label>
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
                    placeholder={t('templateEditor.properties.dataPathPlaceholder')}
                  />
                </div>
                <div className="property-row">
                  <label>{t('templateEditor.properties.x')}:</label>
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
                  <label>{t('templateEditor.properties.y')}:</label>
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
                  <label>{t('templateEditor.properties.width')}:</label>
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
                  <label>{t('templateEditor.properties.height')}:</label>
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
                  <label>{t('templateEditor.properties.fontSize')}:</label>
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
                  <label>{t('templateEditor.properties.align')}:</label>
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
                    <option value="left">{t('templateEditor.properties.alignLeft')}</option>
                    <option value="center">{t('templateEditor.properties.alignCenter')}</option>
                    <option value="right">{t('templateEditor.properties.alignRight')}</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="elements-list-section">
            <h3>{t('templateEditor.elementsList.title', { page: currentPage })}</h3>
          <div className="elements-list">
            {currentPageElements.length === 0 ? (
              <p className="empty-elements">{t('templateEditor.elementsList.empty')}</p>
            ) : (
              currentPageElements.map((element) => (
                <div
                  key={element.id}
                  className={`element-item ${selectedElement?.id === element.id ? 'selected' : ''}`}
                  onClick={() => handleElementClick(element)}
                >
                  <div className="element-path">{element.data_path || t('templateEditor.elementsList.noPath')}</div>
                  <div className="element-type">{element.type}</div>
                </div>
              ))
            )}
          </div>
          <div className="instructions">
            <h4>{t('templateEditor.instructions.title')}</h4>
            <ol>
              <li>{t('templateEditor.instructions.step1')}</li>
              <li>{t('templateEditor.instructions.step2')}</li>
              <li>{t('templateEditor.instructions.step3')}</li>
              <li>{t('templateEditor.instructions.step4')}</li>
            </ol>
          </div>
        </div>
        </div>
      </div>

      {showDataPathInput && (
        <div className="modal-overlay" onClick={() => setShowDataPathInput(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{t('templateEditor.modal.dataPathTitle')}</h3>
            <input
              type="text"
              placeholder={t('templateEditor.modal.dataPathPlaceholder')}
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
                {t('templateEditor.modal.confirm')}
              </button>
              <button onClick={() => setShowDataPathInput(false)}>{t('templateEditor.modal.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {showImageUpload && (
        <div className="modal-overlay" onClick={() => setShowImageUpload(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{t('templateEditor.modal.imageUploadTitle')}</h3>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  handleImageUpload(file)
                }
              }}
            />
            <p>{t('templateEditor.modal.imageUploadDescription')}</p>
            <div className="modal-actions">
              <button onClick={() => {
                if (imageInputRef.current) {
                  imageInputRef.current.click()
                }
              }}>
                {t('templateEditor.modal.selectImage')}
              </button>
              <button onClick={() => {
                setShowImageUpload(false)
                setTempElement(null)
              }}>
                {t('templateEditor.modal.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TemplateEditor
