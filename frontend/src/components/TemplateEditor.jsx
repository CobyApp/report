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
  const imageCacheRef = useRef(new Map()) // Image cache (stores Image objects)
  const blobUrlCacheRef = useRef(new Map()) // Blob URL cache (for cleanup)
  const [dragStartBbox, setDragStartBbox] = useState(null) // Original bbox of element when drag starts

  useEffect(() => {
    loadTemplate()
  }, [templateId])

  useEffect(() => {
    if (template) {
      loadPreviewImage()
      setElements(template.elements || [])
    }
  }, [template, currentPage])

  // Change cursor when tool is selected
  useEffect(() => {
    if (selectedTool === 'select') {
      setCurrentCursor('default')
    } else if (selectedTool === 'text') {
      setCurrentCursor('crosshair')
    } else if (selectedTool === 'checkbox') {
      setCurrentCursor('crosshair')
    } else if (selectedTool === 'image') {
      setCurrentCursor('crosshair')
    } else {
      setCurrentCursor('default')
    }
  }, [selectedTool])

  // cleanup: Revoke Blob URLs
  useEffect(() => {
    return () => {
      // Revoke previewImage Blob URL
      if (previewImage && previewImage.startsWith('blob:')) {
        URL.revokeObjectURL(previewImage)
      }
      // Revoke all Blob URLs in blobUrlCache
      blobUrlCacheRef.current.forEach(blobUrl => {
        if (blobUrl.startsWith('blob:')) {
          URL.revokeObjectURL(blobUrl)
        }
      })
      blobUrlCacheRef.current.clear()
    }
  }, [previewImage])

  // Global mouse event listeners (continue tracking even when drag goes outside canvas)
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
      // Get blob image via axios and convert to Blob URL (includes token)
      const response = await axios.get(`${API_BASE}/templates/${templateId}/preview?page=${currentPage}`, {
        responseType: 'blob',
      })
      
      // Create Blob URL
      const blobUrl = URL.createObjectURL(response.data)
      setPreviewImage(blobUrl)
    } catch (error) {
      // No image for empty template (null shows empty canvas)
      if (error.response?.status === 404) {
        setPreviewImage(null)
      } else {
        console.error('Preview load failed:', error)
        setPreviewImage(null)
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

  // Find element at clicked position
  const getElementAtPoint = (x, y) => {
    const displaySize = getDisplaySize()
    const pdfSize = getPDFSize()
    const pointPDF = screenToPDF(x, y, displaySize.width, displaySize.height, pdfSize.width, pdfSize.height)
    
    // Search in reverse order (last drawn is on top)
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

  // Check resize handle position
  const getResizeHandle = (element, x, y) => {
    if (!element) return null
    
    const displaySize = getDisplaySize()
    const pdfSize = getPDFSize()
    
    // Convert to screen coordinates (calculate directly in screen coordinates, not PDF coordinates)
    const screenCoords = pdfToScreen(element.bbox.x, element.bbox.y, pdfSize.width, pdfSize.height, displaySize.width, displaySize.height)
    const screenSize = pdfToScreen(element.bbox.w, element.bbox.h, pdfSize.width, pdfSize.height, displaySize.width, displaySize.height)
    
    const handleSize = 12 // Handle size (pixels, slightly larger for easier hovering)
    const x1 = screenCoords.x
    const y1 = screenCoords.y
    const x2 = x1 + screenSize.x
    const y2 = y1 + screenSize.y
    
    // Check corner handles (screen coordinate based)
    if (Math.abs(x - x1) <= handleSize && Math.abs(y - y1) <= handleSize) return 'nw'
    if (Math.abs(x - x2) <= handleSize && Math.abs(y - y1) <= handleSize) return 'ne'
    if (Math.abs(x - x1) <= handleSize && Math.abs(y - y2) <= handleSize) return 'sw'
    if (Math.abs(x - x2) <= handleSize && Math.abs(y - y2) <= handleSize) return 'se'
    
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
      // Select tool: element selection, movement, resizing
      const handle = selectedElement ? getResizeHandle(selectedElement, x, y) : null
      
      if (handle) {
        // Start resizing
        setIsResizing(true)
        setResizeHandle(handle)
        setDragStartBbox({ ...selectedElement.bbox }) // Save original bbox
        setDrawStart({ x, y }) // Save resize start position
        e.preventDefault() // Prevent default behavior
      } else {
        const clickedElement = getElementAtPoint(x, y)
        
        if (clickedElement) {
          // Start element selection and movement
          setSelectedElement(clickedElement)
          setIsDraggingElement(true)
          setDragStartBbox({ ...clickedElement.bbox }) // Save original bbox
          setDrawStart({ x, y }) // Save drag start position
          e.preventDefault() // Prevent default behavior
        } else {
          // Deselect when clicking empty space
          setSelectedElement(null)
        }
      }
    } else if (selectedTool === 'checkbox') {
      // Checkbox: create area by dragging (like text)
      setIsDrawing(true)
      setDrawStart({ x, y })
      // Close modal if open
      setShowDataPathInput(false)
      setTempElement(null)
    } else if (selectedTool === 'image') {
      // Image: start area selection by clicking (start with default size)
      setIsDrawing(true)
      setDrawStart({ x, y })
      
      // Start with default area size
      const defaultSize = 50 // Default image area size (display size)
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
      // Text tool: create area by dragging
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
    
    // Match canvas to display size exactly
    const dpr = window.devicePixelRatio || 1
    canvasRef.current.width = displaySize.width * dpr
    canvasRef.current.height = displaySize.height * dpr
    canvasRef.current.style.width = `${displaySize.width}px`
    canvasRef.current.style.height = `${displaySize.height}px`
    
    const ctx = canvasRef.current.getContext('2d')
    ctx.scale(dpr, dpr)

    // Drag/resize is handled by global listeners (continue tracking even when outside canvas)
    // Here we only handle cursor, preview, and handle drawing
    if (selectedTool === 'select') {
      // Draw cursor and resize handles
    } else if ((selectedTool === 'text' || selectedTool === 'image' || selectedTool === 'checkbox') && isDrawing && drawStart) {
      // Text/image/checkbox drag preview
      let bbox = {
        x: Math.min(drawStart.x, currentX),
        y: Math.min(drawStart.y, currentY),
        w: Math.abs(currentX - drawStart.x),
        h: Math.abs(currentY - drawStart.y),
      }

      // Preview checkbox as square
      if (selectedTool === 'checkbox') {
        const size = Math.max(bbox.w, bbox.h, 5)
        bbox.w = size
        bbox.h = size
      }

      // Redraw existing elements
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

    // Redraw existing elements (for select tool)
    if (selectedTool === 'select') {
      // Find latest element from elements array (selectedElement may have old bbox)
      const currentSelectedElement = selectedElement ? elements.find(el => el.id === selectedElement.id) : null
      elements
        .filter(el => el.page === currentPage)
        .forEach(el => {
          drawElement(ctx, el, currentSelectedElement)
        })
      
      // Determine cursor shape and draw resize handles
      if (!isDraggingElement && !isResizing) {
        // Check resize handle (if hovering over selected element's handle)
        const handle = currentSelectedElement ? getResizeHandle(currentSelectedElement, currentX, currentY) : null
        const hoveredElement = getElementAtPoint(currentX, currentY)
        
        // Set cursor shape (resize handle priority)
        if (handle) {
          const cursors = { nw: 'nw-resize', ne: 'ne-resize', sw: 'sw-resize', se: 'se-resize' }
          setCurrentCursor(cursors[handle])
        } else if (hoveredElement || selectedElement) {
          setCurrentCursor('move')
        } else {
          setCurrentCursor('default')
        }
      } else {
        // Maintain cursor during drag/resize
        if (isDraggingElement) {
          setCurrentCursor('move')
        } else if (isResizing && resizeHandle) {
          const cursors = { nw: 'nw-resize', ne: 'ne-resize', sw: 'sw-resize', se: 'se-resize' }
          setCurrentCursor(cursors[resizeHandle])
        }
      }
      
      // Draw resize handles for selected element (draw at updated position even during drag/resize)
      // Find latest element from elements array (selectedElement may have old bbox)
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
          
          // Draw resize handles (updated position)
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
      // Set tool-specific cursor when other tools are selected
      if (selectedTool === 'text') {
        setCurrentCursor('crosshair')
      } else if (selectedTool === 'checkbox') {
        setCurrentCursor('crosshair')
      } else if (selectedTool === 'image') {
        setCurrentCursor('crosshair')
      } else {
        setCurrentCursor('default')
      }
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
      // Select tool: end drag/resize
      if (isDraggingElement || isResizing) {
        setIsDraggingElement(false)
        setIsResizing(false)
        setResizeHandle(null)
        setDrawStart(null)
        
        // Normalize checkbox to square (use latest element from elements array)
        if (selectedElement && selectedElement.type === 'checkbox') {
          // Find latest element from elements array
          const currentElement = elements.find(el => el.id === selectedElement.id)
          if (currentElement) {
            const bbox = currentElement.bbox
            const size = Math.max(bbox.w, bbox.h, 5)
            const updated = elements.map(el => 
              el.id === selectedElement.id 
                ? { ...el, bbox: { ...el.bbox, w: size, h: size } }
                : el
            )
            setElements(updated)
            // Also update selectedElement
            setSelectedElement(updated.find(el => el.id === selectedElement.id))
          }
        }
        
        setDragStartBbox(null)
        redrawCanvas()
      }
      return
    }

    // Text/image tools: create area by dragging
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
      // Image tool: show image upload modal when drag ends
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
      // Text tool: data path input modal
      const newElement = {
        id: `elem_${Date.now()}`,
        type: 'text',
        page: currentPage,
        bbox: bbox,
        data_path: '',
        style: { 
          size: 10, 
          align: 'left',
          weight: 'normal',
          color: '#000000',
          background_color: '#ffffff',
          underline: false,
          strikethrough: false,
          line_height: 1.2,
          letter_spacing: 0,
          vertical_align: 'top'
        },
      }

      setTempElement(newElement)
      setShowDataPathInput(true)
    } else if (selectedTool === 'checkbox' && bbox.w > 5 && bbox.h > 5) {
      // Checkbox: create area by dragging (normalized to square)
      const size = Math.max(bbox.w, bbox.h, 5)
      const normalizedBbox = {
        x: bbox.x,
        y: bbox.y,
        w: size,
        h: size,
      }
      
      const newElement = {
        id: `elem_${Date.now()}`,
        type: 'checkbox',
        page: currentPage,
        bbox: normalizedBbox,
        data_path: 'checked',
      }
      
      setElements([...elements, newElement])
      setShowDataPathInput(false)
      setTempElement(null)
      redrawCanvas()
    }

    setIsDrawing(false)
    setDrawStart(null)
  }

  const drawElement = (ctx, element, currentSelectedElement = null) => {
    if (!template || !imageRef.current) return
    
    const displaySize = getDisplaySize()
    const pdfSize = getPDFSize()
    
    const bbox = element.bbox
    // Convert PDF coordinates to display size coordinates
    const screenCoords = pdfToScreen(bbox.x, bbox.y, pdfSize.width, pdfSize.height, displaySize.width, displaySize.height)
    const screenSize = pdfToScreen(bbox.w, bbox.h, pdfSize.width, pdfSize.height, displaySize.width, displaySize.height)
    
    const x = screenCoords.x
    const y = screenCoords.y // Screen coordinate system (top is 0)
    const w = screenSize.x
    const h = screenSize.y
    
    const isSelected = currentSelectedElement ? element.id === currentSelectedElement.id : false
    ctx.strokeStyle = isSelected ? '#e74c3c' : '#3498db'
    ctx.lineWidth = isSelected ? 3 : 2
    ctx.setLineDash([])
    
    // Different styles by element type
    if (element.type === 'checkbox') {
      // Checkbox: always show area + draw checkmark on screen
      ctx.strokeStyle = isSelected ? '#e74c3c' : '#3498db'
      ctx.lineWidth = element === selectedElement ? 3 : 2
      ctx.setLineDash(element === selectedElement ? [3, 3] : [5, 5])
      ctx.strokeRect(x, y, w, h)
      
      // Draw checkmark (if data_path exists, consider it checked)
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
        
        // Checkmark (bolder and clearer ✓ shape)
        const offset = checkSize * 0.3
        ctx.beginPath()
        // Start from bottom-left
        ctx.moveTo(centerX - offset * 0.8, centerY)
        // To center
        ctx.lineTo(centerX - offset * 0.2, centerY + offset * 0.6)
        // To top-right
        ctx.lineTo(centerX + offset * 1.0, centerY - offset * 0.4)
        ctx.stroke()
      }
    } else if (element.type === 'image') {
      // Image: draw actual image on canvas
      if (element.image_path) {
        const imagePath = `${API_BASE}/uploads/${element.image_path}`
        const cachedImg = imageCacheRef.current.get(imagePath)
        
        if (cachedImg && cachedImg.complete) {
          // Use cached image
          try {
            ctx.drawImage(cachedImg, x, y, w, h)
            // Show border if selected
            if (isSelected) {
              ctx.strokeStyle = '#e74c3c'
              ctx.lineWidth = 3
              ctx.setLineDash([3, 3])
              ctx.strokeRect(x, y, w, h)
            }
          } catch (e) {
            // Show dashed rectangle if image drawing fails
            ctx.setLineDash([5, 5])
            ctx.strokeStyle = isSelected ? '#e74c3c' : '#3498db'
            ctx.strokeRect(x, y, w, h)
            ctx.fillStyle = '#2c3e50'
            ctx.font = '12px sans-serif'
            ctx.fillText('🖼️ Image', x + 5, y - 5)
          }
        } else {
          // Image loading or not in cache
          const img = new Image()
          img.crossOrigin = 'anonymous'
          
          img.onload = () => {
            imageCacheRef.current.set(imagePath, img)
            redrawCanvas()
          }
          
          img.onerror = () => {
            // Show dashed rectangle if image load fails
            ctx.setLineDash([5, 5])
            ctx.strokeStyle = isSelected ? '#e74c3c' : '#3498db'
            ctx.strokeRect(x, y, w, h)
            ctx.fillStyle = '#2c3e50'
            ctx.font = '12px sans-serif'
            ctx.fillText('🖼️ (Load failed)', x + 5, y - 5)
          }
          
          img.src = imagePath
          
          // Show loading indicator
          ctx.setLineDash([5, 5])
          ctx.strokeStyle = isSelected ? '#e74c3c' : '#3498db'
          ctx.strokeRect(x, y, w, h)
          ctx.fillStyle = '#2c3e50'
          ctx.font = '12px sans-serif'
          ctx.fillText('🖼️ Loading...', x + 5, y - 5)
        }
      } else {
        // No image path
        ctx.setLineDash([5, 5])
        ctx.strokeStyle = isSelected ? '#e74c3c' : '#3498db'
        ctx.strokeRect(x, y, w, h)
        ctx.fillStyle = '#2c3e50'
        ctx.font = '12px sans-serif'
        ctx.fillText('🖼️ (No image)', x + 5, y - 5)
      }
    } else {
      // Text is a regular rectangle
      const style = element.style || {}
      
      // Draw background color if specified
      if (style.background_color && style.background_color.toLowerCase() !== 'transparent' && style.background_color !== '#ffffff') {
        ctx.fillStyle = style.background_color
        ctx.fillRect(x, y, w, h)
      }
      
      ctx.strokeRect(x, y, w, h)
      if (element.data_path) {
        // Use text color from style, default to dark gray
        ctx.fillStyle = style.color || '#2c3e50'
        
        // Build font string from element style (always use Noto Sans)
        const fontSize = style.size || 12
        const fontWeight = style.weight === 'bold' ? 'bold' : 'normal'
        const fontFamily = 'Noto Sans JP, Noto Sans KR, sans-serif'
        
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
        
        // For bold, simulate if browser doesn't support it
        const useBoldSimulation = fontWeight === 'bold'
        ctx.textAlign = style.align || 'left'
        ctx.textBaseline = 'top'
        
        // Calculate text position based on alignment
        const topMargin = 8 // Margin from top
        const leftMargin = 8 // Margin from left
        let textX = x + leftMargin
        let textY = y + topMargin
        
        // Vertical alignment
        if (style.vertical_align === 'middle') {
          textY = y + h / 2 - fontSize / 2
        } else if (style.vertical_align === 'bottom') {
          textY = y + h - fontSize - topMargin
        }
        
        // Horizontal alignment
        if (style.align === 'center') {
          ctx.textAlign = 'center'
          textX = x + w / 2
        } else if (style.align === 'right') {
          ctx.textAlign = 'right'
          textX = x + w - leftMargin
        }
        
        // Draw text
        if (useBoldSimulation) {
          // Simulate bold by drawing text multiple times with slight offset
          ctx.fillText(element.data_path, textX, textY)
          ctx.fillText(element.data_path, textX + 0.5, textY)
          ctx.fillText(element.data_path, textX, textY + 0.5)
        } else {
          ctx.fillText(element.data_path, textX, textY)
        }
        
        // Draw underline if specified
        if (style.underline) {
          const textWidth = ctx.measureText(element.data_path).width
          const underlineY = textY + fontSize + 2
          ctx.strokeStyle = style.color || '#2c3e50'
          ctx.lineWidth = Math.max(1, fontSize * 0.05)
          ctx.beginPath()
          if (style.align === 'center') {
            ctx.moveTo(textX - textWidth / 2, underlineY)
            ctx.lineTo(textX + textWidth / 2, underlineY)
          } else if (style.align === 'right') {
            ctx.moveTo(textX - textWidth, underlineY)
            ctx.lineTo(textX, underlineY)
          } else {
            ctx.moveTo(textX, underlineY)
            ctx.lineTo(textX + textWidth, underlineY)
          }
          ctx.stroke()
        }
        
        // Draw strikethrough if specified
        if (style.strikethrough) {
          const textWidth = ctx.measureText(element.data_path).width
          const strikethroughY = textY + fontSize / 2
          ctx.strokeStyle = style.color || '#2c3e50'
          ctx.lineWidth = Math.max(1, fontSize * 0.05)
          ctx.beginPath()
          if (style.align === 'center') {
            ctx.moveTo(textX - textWidth / 2, strikethroughY)
            ctx.lineTo(textX + textWidth / 2, strikethroughY)
          } else if (style.align === 'right') {
            ctx.moveTo(textX - textWidth, strikethroughY)
            ctx.lineTo(textX, strikethroughY)
          } else {
            ctx.moveTo(textX, strikethroughY)
            ctx.lineTo(textX + textWidth, strikethroughY)
          }
          ctx.stroke()
        }
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
      // Upload image
      const uploadResponse = await axios.post(`${API_BASE}/images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      
      // Check image size and auto-adjust bbox
      const img = new Image()
      const imageUrl = URL.createObjectURL(file)
      
      img.onload = () => {
        const displaySize = getDisplaySize()
        const pdfSize = getPDFSize()
        
        // Adjust bbox while maintaining image aspect ratio
        const imgWidth = img.width
        const imgHeight = img.height
        const imgAspect = imgWidth / imgHeight
        
        let newW = tempElement.bbox.w
        let newH = tempElement.bbox.h
        const currentAspect = newW / newH
        
        if (imgAspect > currentAspect) {
          // Image is wider: base on width
          newH = newW / imgAspect
        } else {
          // Image is taller: base on height
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
        // Keep default size if image load fails
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
    
    // Match canvas size to display size exactly
    canvas.width = displaySize.width * dpr
    canvas.height = displaySize.height * dpr
    canvas.style.width = `${displaySize.width}px`
    canvas.style.height = `${displaySize.height}px`
    
    // Support high-resolution displays
    ctx.scale(dpr, dpr)
    
    // Initialize canvas
    ctx.clearRect(0, 0, displaySize.width, displaySize.height)

    // Draw elements
    // Find selectedElement from elements to use latest element when comparing
    const currentSelectedElement = selectedElement ? elements.find(el => el.id === selectedElement.id) : null
    elements
      .filter(el => el.page === currentPage)
      .forEach(el => {
        drawElement(ctx, el, currentSelectedElement)
      })
    
    // Draw resize handles for selected element (also handled in redrawCanvas)
    // Find latest element from elements array
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
        
        // Draw resize handles
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
      const updatedElements = elements.filter(el => el.id !== selectedElement.id)
      setElements(updatedElements)
      setSelectedElement(null)
      redrawCanvas()
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
    
    // Get data input (via simple prompt)
    elements.forEach(el => {
      // Checkbox: automatically set to true without prompt
      if (el.type === 'checkbox' && el.data_path === 'checked') {
        if (!testData['checked']) {
          testData['checked'] = true
        }
        return
      }
      
      // Skip images without prompt
      if (el.type === 'image') {
        return
      }
      
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
      // Send elements from current memory (reflects changes before saving)
      const response = await axios.post(
        `${API_BASE}/render/${templateId}`,
        {
          ...testData,
          _elements: elements, // Temporarily send elements
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
        {/* Floating toolbox */}
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
                  // Adjust canvas size after image loads
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
                {selectedElement.type === 'text' && (
                  <>
                    <div className="property-row">
                      <label>{t('templateEditor.properties.fontSize')}:</label>
                      <input
                        type="number"
                        min="6"
                        max="72"
                        step="1"
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
                      <label>{t('templateEditor.properties.fontWeight')}:</label>
                      <select
                        value={selectedElement.style?.weight || 'normal'}
                        onChange={(e) => {
                          const weight = e.target.value
                          const updated = elements.map(el => 
                            el.id === selectedElement.id 
                              ? { ...el, style: { ...el.style, weight } }
                              : el
                          )
                          setElements(updated)
                          setSelectedElement({ ...selectedElement, style: { ...selectedElement.style, weight } })
                        }}
                      >
                        <option value="normal">{t('templateEditor.properties.normal')}</option>
                        <option value="bold">{t('templateEditor.properties.bold')}</option>
                      </select>
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
                    <div className="property-row">
                      <label>{t('templateEditor.properties.textColor')}:</label>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1 }}>
                        <input
                          type="color"
                          value={selectedElement.style?.color || '#000000'}
                          onChange={(e) => {
                            const color = e.target.value
                            const updated = elements.map(el => 
                              el.id === selectedElement.id 
                                ? { ...el, style: { ...el.style, color } }
                                : el
                            )
                            setElements(updated)
                            setSelectedElement({ ...selectedElement, style: { ...selectedElement.style, color } })
                          }}
                          style={{ width: '45px', height: '38px', cursor: 'pointer' }}
                        />
                        <input
                          type="text"
                          value={selectedElement.style?.color || '#000000'}
                          onChange={(e) => {
                            const color = e.target.value
                            const updated = elements.map(el => 
                              el.id === selectedElement.id 
                                ? { ...el, style: { ...el.style, color } }
                                : el
                            )
                            setElements(updated)
                            setSelectedElement({ ...selectedElement, style: { ...selectedElement.style, color } })
                          }}
                          placeholder="#000000"
                          style={{ width: '80px', flexShrink: 0 }}
                        />
                      </div>
                    </div>
                    <div className="property-row">
                      <label>{t('templateEditor.properties.background')}:</label>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1 }}>
                        <input
                          type="color"
                          value={selectedElement.style?.background_color || '#ffffff'}
                          onChange={(e) => {
                            const background_color = e.target.value
                            const updated = elements.map(el => 
                              el.id === selectedElement.id 
                                ? { ...el, style: { ...el.style, background_color } }
                                : el
                            )
                            setElements(updated)
                            setSelectedElement({ ...selectedElement, style: { ...selectedElement.style, background_color } })
                          }}
                          style={{ width: '45px', height: '38px', cursor: 'pointer' }}
                        />
                        <input
                          type="text"
                          value={selectedElement.style?.background_color || '#ffffff'}
                          onChange={(e) => {
                            const background_color = e.target.value
                            const updated = elements.map(el => 
                              el.id === selectedElement.id 
                                ? { ...el, style: { ...el.style, background_color } }
                                : el
                            )
                            setElements(updated)
                            setSelectedElement({ ...selectedElement, style: { ...selectedElement.style, background_color } })
                          }}
                          placeholder="#ffffff or transparent"
                          style={{ width: '80px', flexShrink: 0 }}
                        />
                      </div>
                    </div>
                    <div className="property-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <label style={{ marginBottom: '0.25rem' }}>{t('templateEditor.properties.textDecoration')}:</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={selectedElement.style?.underline || false}
                            onChange={(e) => {
                              const underline = e.target.checked
                              const updated = elements.map(el => 
                                el.id === selectedElement.id 
                                  ? { ...el, style: { ...el.style, underline } }
                                  : el
                              )
                              setElements(updated)
                              setSelectedElement({ ...selectedElement, style: { ...selectedElement.style, underline } })
                            }}
                          />
                          <span>{t('templateEditor.properties.underline')}</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={selectedElement.style?.strikethrough || false}
                            onChange={(e) => {
                              const strikethrough = e.target.checked
                              const updated = elements.map(el => 
                                el.id === selectedElement.id 
                                  ? { ...el, style: { ...el.style, strikethrough } }
                                  : el
                              )
                              setElements(updated)
                              setSelectedElement({ ...selectedElement, style: { ...selectedElement.style, strikethrough } })
                            }}
                          />
                          <span>{t('templateEditor.properties.strikethrough')}</span>
                        </label>
                      </div>
                    </div>
                    <div className="property-row">
                      <label>{t('templateEditor.properties.lineHeight')}:</label>
                      <input
                        type="number"
                        min="0.5"
                        max="3"
                        step="0.1"
                        value={selectedElement.style?.line_height || 1.2}
                        onChange={(e) => {
                          const line_height = parseFloat(e.target.value) || 1.2
                          const updated = elements.map(el => 
                            el.id === selectedElement.id 
                              ? { ...el, style: { ...el.style, line_height } }
                              : el
                          )
                          setElements(updated)
                          setSelectedElement({ ...selectedElement, style: { ...selectedElement.style, line_height } })
                        }}
                      />
                    </div>
                    <div className="property-row">
                      <label>{t('templateEditor.properties.letterSpacing')}:</label>
                      <input
                        type="number"
                        min="-2"
                        max="10"
                        step="0.1"
                        value={selectedElement.style?.letter_spacing || 0}
                        onChange={(e) => {
                          const letter_spacing = parseFloat(e.target.value) || 0
                          const updated = elements.map(el => 
                            el.id === selectedElement.id 
                              ? { ...el, style: { ...el.style, letter_spacing } }
                              : el
                          )
                          setElements(updated)
                          setSelectedElement({ ...selectedElement, style: { ...selectedElement.style, letter_spacing } })
                        }}
                      />
                    </div>
                    <div className="property-row">
                      <label>{t('templateEditor.properties.verticalAlign')}:</label>
                      <select
                        value={selectedElement.style?.vertical_align || 'top'}
                        onChange={(e) => {
                          const vertical_align = e.target.value
                          const updated = elements.map(el => 
                            el.id === selectedElement.id 
                              ? { ...el, style: { ...el.style, vertical_align } }
                              : el
                          )
                          setElements(updated)
                          setSelectedElement({ ...selectedElement, style: { ...selectedElement.style, vertical_align } })
                        }}
                      >
                        <option value="top">{t('templateEditor.properties.verticalAlignTop')}</option>
                        <option value="middle">{t('templateEditor.properties.verticalAlignMiddle')}</option>
                        <option value="bottom">{t('templateEditor.properties.verticalAlignBottom')}</option>
                      </select>
                    </div>
                  </>
                )}
                {selectedElement.type !== 'text' && (
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
                )}
                <div className="property-row">
                  <button onClick={handleDeleteElement} className="btn-delete-element">
                    🗑️ {t('templateEditor.delete')}
                  </button>
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
