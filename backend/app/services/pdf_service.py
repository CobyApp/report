import fitz  # PyMuPDF
from pathlib import Path
from PIL import Image
import io
from datetime import datetime
from typing import Dict, Any


class PDFService:
    """PDF 처리 서비스 (업로드, 정보 추출, 이미지 변환)"""
    
    def extract_info(self, pdf_path: Path) -> Dict[str, Any]:
        """PDF 정보 추출 (페이지 수, 페이지 크기 등)"""
        doc = fitz.open(pdf_path)
        
        pages_info = []
        for page_num in range(len(doc)):
            page = doc[page_num]
            rect = page.rect
            
            pages_info.append({
                "page": page_num + 1,
                "width": rect.width,
                "height": rect.height,
                "width_pt": rect.width,  # PyMuPDF는 포인트 단위
                "height_pt": rect.height,
            })
        
        first_page = doc[0]
        first_rect = first_page.rect
        
        # 페이지 수 저장 (doc.close() 전에)
        page_count = len(doc)
        
        # AcroForm 필드 탐지
        form_fields = []
        try:
            for field in first_page.widgets():
                form_fields.append({
                    "name": field.field_name,
                    "type": field.field_type_string,
                    "rect": {
                        "x": field.rect.x0,
                        "y": field.rect.y0,
                        "w": field.rect.width,
                        "h": field.rect.height,
                    }
                })
        except:
            pass
        
        # 페이지 크기 저장
        page_size_w = first_rect.width
        page_size_h = first_rect.height
        
        doc.close()
        
        return {
            "page_count": page_count,
            "page_size": {
                "w_pt": page_size_w,
                "h_pt": page_size_h,
            },
            "pages": pages_info,
            "form_fields": form_fields,
            "has_acroform": len(form_fields) > 0,
            "created_at": datetime.now().isoformat(),
        }
    
    def render_page_as_image(self, pdf_path: Path, page_index: int = 0, dpi: int = 150) -> Path:
        """PDF 페이지를 이미지로 렌더링 (GUI 미리보기용)"""
        doc = fitz.open(pdf_path)
        
        if page_index >= len(doc):
            page_index = 0
        
        page = doc[page_index]
        
        # 렌더링 (스케일 설정: dpi/72)
        mat = fitz.Matrix(dpi / 72, dpi / 72)
        pix = page.get_pixmap(matrix=mat)
        
        # PIL Image로 변환
        img_data = pix.tobytes("png")
        img = Image.open(io.BytesIO(img_data))
        
        # 이미지 저장
        output_dir = Path(pdf_path).parent / "previews"
        output_dir.mkdir(exist_ok=True)
        
        output_path = output_dir / f"{pdf_path.stem}_page{page_index + 1}.png"
        img.save(output_path, "PNG")
        
        doc.close()
        
        return output_path
    
    def get_page_count(self, pdf_path: Path) -> int:
        """PDF 페이지 수 반환"""
        doc = fitz.open(pdf_path)
        count = len(doc)
        doc.close()
        return count
