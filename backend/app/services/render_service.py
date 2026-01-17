from pathlib import Path
from typing import Dict, Any, Optional
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
# Note: pt (point) is the default unit in ReportLab, so we just use numbers directly
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfWriter, PdfReader
import fitz  # PyMuPDF
from datetime import datetime
import math


class RenderService:
    """PDF 렌더링 엔진 (템플릿 + 데이터 → 완성 PDF)"""
    
    def __init__(self, templates_dir: Path, uploads_dir: Path):
        self.templates_dir = templates_dir
        self.uploads_dir = uploads_dir
        self._register_fonts()
    
    def _register_fonts(self):
        """한글 폰트 등록 (시스템 폰트 또는 기본 폰트 사용)"""
        try:
            # macOS에서 기본 한글 폰트 시도
            from reportlab.pdfbase.pdfmetrics import registerFontFamily
            # 실제로는 시스템에 따라 폰트 경로를 찾아야 함
            # 여기서는 기본 Helvetica 사용 (한글은 나중에 개선)
            pass
        except:
            pass
    
    async def render(self, template_id: str, data: Dict[str, Any]) -> Path:
        """템플릿과 데이터로 PDF 생성"""
        from app.services.template_service import TemplateService
        
        # 템플릿 로드
        template_service = TemplateService(self.templates_dir)
        template = template_service.get_template(template_id)
        if not template:
            raise ValueError(f"Template {template_id} not found")
        
        return await self.render_with_template(template, data, template_id)
    
    async def render_with_template(self, template: Dict[str, Any], data: Dict[str, Any], template_id: Optional[str] = None) -> Path:
        """템플릿 객체를 직접 받아 PDF 생성"""
        if template_id is None:
            template_id = template.get("template_id", "temp")
        
        # 원본 PDF 로드
        template_pdf_path = self.uploads_dir / f"{template_id}.pdf"
        if not template_pdf_path.exists():
            raise ValueError(f"Template PDF {template_id}.pdf not found")
        
        # 오버레이 PDF 생성
        page_size = template.get("page_size", {"w_pt": 595.28, "h_pt": 841.89})
        overlay_path = self._create_overlay(template, data, page_size)
        
        # 원본 PDF와 오버레이 PDF 병합
        output_path = self._merge_pdfs(template_pdf_path, overlay_path, template_id)
        
        # 임시 오버레이 파일 삭제
        overlay_path.unlink()
        
        return output_path
    
    def _create_overlay(self, template: Dict[str, Any], data: Dict[str, Any], page_size: Dict[str, float]) -> Path:
        """데이터로 오버레이 PDF 생성"""
        w_pt = page_size.get("w_pt", 595.28)
        h_pt = page_size.get("h_pt", 841.89)
        
        output_dir = self.uploads_dir / "rendered"
        output_dir.mkdir(exist_ok=True)
        
        overlay_path = output_dir / f"overlay_{datetime.now().timestamp()}.pdf"
        
        # ReportLab으로 오버레이 PDF 생성
        c = canvas.Canvas(str(overlay_path), pagesize=(w_pt, h_pt))
        
        elements = template.get("elements", [])
        pages_elements = {}  # 페이지별로 요소 그룹화
        
        # 페이지별로 요소 분류
        for elem in elements:
            page = elem.get("page", 1)
            if page not in pages_elements:
                pages_elements[page] = []
            pages_elements[page].append(elem)
        
        # 각 페이지 처리
        max_page = max(pages_elements.keys()) if pages_elements else 1
        for page_num in range(1, max_page + 1):
            if page_num > 1:
                c.showPage()
            
            page_elements = pages_elements.get(page_num, [])
            
            for elem in page_elements:
                self._render_element(c, elem, data, w_pt, h_pt)
        
        c.save()
        return overlay_path
    
    def _render_element(self, canvas_obj, elem: Dict[str, Any], data: Dict[str, Any], page_w: float, page_h: float):
        """단일 요소 렌더링"""
        elem_type = elem.get("type", "text")
        bbox = elem.get("bbox", {})
        x = bbox.get("x", 0)
        y_screen = bbox.get("y", 0)  # 화면 좌표계 (위가 0)
        w = bbox.get("w", 100)
        h = bbox.get("h", 20)
        
        # 화면 좌표계(위가 0)를 PDF 좌표계(아래가 0)로 변환
        # ReportLab은 왼쪽 아래가 원점
        y_pdf = page_h - y_screen - h
        
        if elem_type == "text":
            self._render_text(canvas_obj, elem, data, x, y_pdf, w, h)
        elif elem_type == "checkbox":
            self._render_checkbox(canvas_obj, elem, data, x, y_pdf, w, h)
        elif elem_type == "image":
            self._render_image(canvas_obj, elem, data, x, y_pdf, w, h)
        elif elem_type == "repeat":
            self._render_repeat(canvas_obj, elem, data, x, y_pdf, w, h, page_w, page_h)
    
    def _render_text(self, canvas_obj, elem: Dict[str, Any], data: Dict[str, Any], x: float, y: float, w: float, h: float):
        """텍스트 렌더링"""
        data_path = elem.get("data_path", "")
        value = self._get_data_value(data, data_path)
        
        if value is None:
            return
        
        style = elem.get("style", {})
        font_name = style.get("font", "Helvetica")
        font_size = style.get("size", 10)
        align = style.get("align", "left")
        
        canvas_obj.setFont(font_name, font_size)
        canvas_obj.setFillColorRGB(0, 0, 0)
        
        text = str(value)
        
        # 정렬 처리
        if align == "right":
            text_x = x + w - canvas_obj.stringWidth(text, font_name, font_size)
        elif align == "center":
            text_width = canvas_obj.stringWidth(text, font_name, font_size)
            text_x = x + (w - text_width) / 2
        else:
            text_x = x
        
        # overflow 처리: shrink_to_fit
        overflow = elem.get("overflow", {})
        if overflow.get("mode") == "shrink_to_fit":
            text_width = canvas_obj.stringWidth(text, font_name, font_size)
            min_size = overflow.get("min_size", 7)
            
            if text_width > w and font_size > min_size:
                new_size = font_size * (w / text_width) * 0.9
                new_size = max(new_size, min_size)
                canvas_obj.setFont(font_name, new_size)
                if align == "right":
                    text_x = x + w - canvas_obj.stringWidth(text, font_name, new_size)
                elif align == "center":
                    text_width = canvas_obj.stringWidth(text, font_name, new_size)
                    text_x = x + (w - text_width) / 2
        
        canvas_obj.drawString(text_x, y + h - font_size - 2, text)
    
    def _render_checkbox(self, canvas_obj, elem: Dict[str, Any], data: Dict[str, Any], x: float, y: float, w: float, h: float):
        """체크박스 렌더링"""
        data_path = elem.get("data_path", "")
        value = self._get_data_value(data, data_path)
        
        checked = bool(value) if value is not None else False
        
        if checked:
            # 체크 표시 그리기
            canvas_obj.setStrokeColorRGB(0, 0, 0)
            canvas_obj.setLineWidth(1)
            # 사각형
            canvas_obj.rect(x, y, min(w, h), min(w, h), stroke=1, fill=0)
            # 체크 표시
            size = min(w, h)
            canvas_obj.line(x + size * 0.2, y + size * 0.5, x + size * 0.4, y + size * 0.7)
            canvas_obj.line(x + size * 0.4, y + size * 0.7, x + size * 0.8, y + size * 0.3)
        else:
            # 빈 사각형
            canvas_obj.rect(x, y, min(w, h), min(w, h), stroke=1, fill=0)
    
    def _render_image(self, canvas_obj, elem: Dict[str, Any], data: Dict[str, Any], x: float, y: float, w: float, h: float):
        """이미지 렌더링 (미구현 - 향후 개선)"""
        # TODO: 이미지 파일 경로나 base64 데이터 처리
        pass
    
    def _render_repeat(self, canvas_obj, elem: Dict[str, Any], data: Dict[str, Any], 
                       x: float, y: float, w: float, h: float, page_w: float, page_h: float):
        """반복 테이블 렌더링"""
        items_path = elem.get("items_path", "")
        items = self._get_data_value(data, items_path)
        
        if not isinstance(items, list):
            return
        
        columns = elem.get("columns", [])
        row_height = elem.get("row_height", 18)
        
        current_y = y
        for item in items:
            if current_y < 0:
                break  # 페이지 범위 벗어남
            
            for col in columns:
                col_x = x + col.get("x", 0)
                col_w = col.get("w", 100)
                col_key = col.get("key", "")
                col_align = col.get("align", "left")
                
                value = item.get(col_key, "") if isinstance(item, dict) else ""
                
                if value:
                    style = elem.get("style", {})
                    font_name = style.get("font", "Helvetica")
                    font_size = style.get("size", 10)
                    
                    canvas_obj.setFont(font_name, font_size)
                    
                    text = str(value)
                    text_width = canvas_obj.stringWidth(text, font_name, font_size)
                    
                    if col_align == "right":
                        text_x = col_x + col_w - text_width
                    elif col_align == "center":
                        text_x = col_x + (col_w - text_width) / 2
                    else:
                        text_x = col_x
                    
                    canvas_obj.drawString(text_x, current_y + row_height - font_size - 2, text)
            
            current_y -= row_height
    
    def _get_data_value(self, data: Dict[str, Any], path: str) -> Any:
        """데이터 경로(예: "customer.name")에서 값 가져오기"""
        if not path:
            return None
        
        parts = path.split(".")
        value = data
        
        for part in parts:
            if isinstance(value, dict):
                value = value.get(part)
            else:
                return None
            
            if value is None:
                return None
        
        return value
    
    def _merge_pdfs(self, base_pdf_path: Path, overlay_pdf_path: Path, template_id: str) -> Path:
        """원본 PDF와 오버레이 PDF 병합"""
        output_dir = self.uploads_dir / "rendered"
        output_dir.mkdir(exist_ok=True)
        
        output_path = output_dir / f"rendered_{template_id}_{datetime.now().timestamp()}.pdf"
        
        # pypdf로 병합
        base_reader = PdfReader(str(base_pdf_path))
        overlay_reader = PdfReader(str(overlay_pdf_path))
        
        writer = PdfWriter()
        
        # 페이지 수 맞추기
        max_pages = max(len(base_reader.pages), len(overlay_reader.pages))
        
        for i in range(max_pages):
            if i < len(base_reader.pages):
                base_page = base_reader.pages[i]
            else:
                base_page = base_reader.pages[0]  # 마지막 페이지 복제
            
            if i < len(overlay_reader.pages):
                overlay_page = overlay_reader.pages[i]
                base_page.merge_page(overlay_page)
            
            writer.add_page(base_page)
        
        with open(output_path, "wb") as f:
            writer.write(f)
        
        return output_path
