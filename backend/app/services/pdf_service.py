import fitz  # PyMuPDF
from pathlib import Path
from PIL import Image
import io
from datetime import datetime
from typing import Dict, Any


class PDFService:
    """PDF processing service (upload, info extraction, image conversion)"""
    
    def extract_info(self, pdf_path: Path) -> Dict[str, Any]:
        """Extract PDF information (page count, page size, etc.)"""
        doc = fitz.open(pdf_path)
        
        pages_info = []
        for page_num in range(len(doc)):
            page = doc[page_num]
            rect = page.rect
            
            pages_info.append({
                "page": page_num + 1,
                "width": rect.width,
                "height": rect.height,
                "width_pt": rect.width,  # PyMuPDF uses point units
                "height_pt": rect.height,
            })
        
        first_page = doc[0]
        first_rect = first_page.rect
        
        # Save page count (before doc.close())
        page_count = len(doc)
        
        # Detect AcroForm fields
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
        
        # Save page size
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
        """Render PDF page as image (for GUI preview)"""
        doc = fitz.open(pdf_path)
        
        if page_index >= len(doc):
            page_index = 0
        
        page = doc[page_index]
        
        # Render (scale setting: dpi/72)
        mat = fitz.Matrix(dpi / 72, dpi / 72)
        pix = page.get_pixmap(matrix=mat)
        
        # Convert to PIL Image
        img_data = pix.tobytes("png")
        img = Image.open(io.BytesIO(img_data))
        
        # Save image
        output_dir = Path(pdf_path).parent / "previews"
        output_dir.mkdir(exist_ok=True)
        
        output_path = output_dir / f"{pdf_path.stem}_page{page_index + 1}.png"
        img.save(output_path, "PNG")
        
        doc.close()
        
        return output_path
    
    def get_page_count(self, pdf_path: Path) -> int:
        """Return PDF page count"""
        doc = fitz.open(pdf_path)
        count = len(doc)
        doc.close()
        return count
