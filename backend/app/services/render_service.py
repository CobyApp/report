from pathlib import Path
from typing import Dict, Any, Optional
from pypdf import PdfWriter, PdfReader
import fitz  # PyMuPDF
from datetime import datetime


class RenderService:
    """PDF rendering engine (template + data → completed PDF)"""
    
    def __init__(self, templates_dir: Path, uploads_dir: Path):
        self.templates_dir = templates_dir
        self.uploads_dir = uploads_dir
    
    async def render(self, template_id: str, data: Dict[str, Any]) -> Path:
        """Generate PDF from template and data"""
        from app.services.template_service import TemplateService
        
        # Load template
        template_service = TemplateService(self.templates_dir)
        template = template_service.get_template(template_id)
        if not template:
            raise ValueError(f"Template {template_id} not found")
        
        return await self.render_with_template(template, data, template_id)
    
    async def render_with_template(self, template: Dict[str, Any], data: Dict[str, Any], template_id: Optional[str] = None) -> Path:
        """Generate PDF by directly receiving template object"""
        if template_id is None:
            template_id = template.get("template_id", "temp")
        
        # Load original PDF
        template_pdf_path = self.uploads_dir / f"{template_id}.pdf"
        if not template_pdf_path.exists():
            raise ValueError(f"Template PDF {template_id}.pdf not found")
        
        # Create overlay PDF
        page_size = template.get("page_size", {"w_pt": 595.28, "h_pt": 841.89})
        overlay_path = self._create_overlay(template, data, page_size)
        
        # Merge original PDF and overlay PDF
        output_path = self._merge_pdfs(template_pdf_path, overlay_path, template_id)
        
        # Delete temporary overlay file
        overlay_path.unlink()
        
        return output_path
    
    def _create_overlay(self, template: Dict[str, Any], data: Dict[str, Any], page_size: Dict[str, float]) -> Path:
        """Create overlay PDF from data - using PyMuPDF (excellent CJK text support)"""
        w_pt = page_size.get("w_pt", 595.28)
        h_pt = page_size.get("h_pt", 841.89)
        
        output_dir = self.uploads_dir / "rendered"
        output_dir.mkdir(exist_ok=True)
        
        overlay_path = output_dir / f"overlay_{datetime.now().timestamp()}.pdf"
        
        # Create overlay PDF with PyMuPDF (excellent CJK text support)
        doc = fitz.open()  # Create new PDF
        
        elements = template.get("elements", [])
        pages_elements = {}  # Group elements by page
        
        # Classify elements by page
        for elem in elements:
            page = elem.get("page", 1)
            if page not in pages_elements:
                pages_elements[page] = []
            pages_elements[page].append(elem)
        
        # Find and register font files from project font directory
        project_font_dir = Path(__file__).parent.parent.parent / "fonts"
        registered_fonts = {}  # Font file path -> font name mapping
        
        if project_font_dir.exists():
            # Noto Sans JP (Japanese)
            jp_font_path = project_font_dir / "NotoSansJP-VF.ttf"
            if jp_font_path.exists():
                registered_fonts[str(jp_font_path)] = "NotoSansJP"
            
            # Noto Sans KR (Korean)
            kr_font_path = project_font_dir / "NotoSansKR-VF.ttf"
            if kr_font_path.exists():
                registered_fonts[str(kr_font_path)] = "NotoSansKR"
        
        # Process each page
        max_page = max(pages_elements.keys()) if pages_elements else 1
        for page_num in range(1, max_page + 1):
            # Add new page
            page = doc.new_page(width=w_pt, height=h_pt)
            
            # Register fonts (register fonts on each page)
            for font_file_path, font_name in registered_fonts.items():
                try:
                    page.insert_font(fontname=font_name, fontfile=font_file_path)
                    print(f"✓ Font registered on page {page_num}: {font_name} ({font_file_path})")
                except Exception as e:
                    print(f"⚠ Font registration failed ({font_name}): {e}")
            
            page_elements = pages_elements.get(page_num, [])
            
            for elem in page_elements:
                self._render_element_fitz(page, elem, data, w_pt, h_pt, registered_fonts)
        
        doc.save(str(overlay_path))
        doc.close()
        return overlay_path
    
    def _get_data_value(self, data: Dict[str, Any], path: str) -> Any:
        """Get value from data path (e.g., "customer.name")"""
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
        """Merge original PDF and overlay PDF"""
        output_dir = self.uploads_dir / "rendered"
        output_dir.mkdir(exist_ok=True)
        
        output_path = output_dir / f"rendered_{template_id}_{datetime.now().timestamp()}.pdf"
        
        # Merge with pypdf
        base_reader = PdfReader(str(base_pdf_path))
        overlay_reader = PdfReader(str(overlay_pdf_path))
        
        writer = PdfWriter()
        
        # Match page count
        max_pages = max(len(base_reader.pages), len(overlay_reader.pages))
        
        for i in range(max_pages):
            if i < len(base_reader.pages):
                base_page = base_reader.pages[i]
            else:
                base_page = base_reader.pages[0]  # Duplicate last page
            
            if i < len(overlay_reader.pages):
                overlay_page = overlay_reader.pages[i]
                base_page.merge_page(overlay_page)
            
            writer.add_page(base_page)
        
        with open(output_path, "wb") as f:
            writer.write(f)
        
        return output_path
    
    # ========== PyMuPDF Rendering Methods (CJK text support) ==========
    
    def _render_element_fitz(self, page: fitz.Page, elem: Dict[str, Any], data: Dict[str, Any], page_w: float, page_h: float, registered_fonts: Dict[str, str] = None):
        """Render single element - using PyMuPDF"""
        if registered_fonts is None:
            registered_fonts = {}
        
        elem_type = elem.get("type", "text")
        bbox = elem.get("bbox", {})
        x = bbox.get("x", 0)
        y_screen = bbox.get("y", 0)  # Screen coordinate system (top is 0)
        w = bbox.get("w", 100)
        h = bbox.get("h", 20)
        
        if elem_type == "text":
            self._render_text_fitz(page, elem, data, x, y_screen, w, h, page_h, registered_fonts)
        elif elem_type == "checkbox":
            self._render_checkbox_fitz(page, elem, data, x, y_screen, w, h, page_h)
        elif elem_type == "image":
            self._render_image_fitz(page, elem, data, x, y_screen, w, h)
        elif elem_type == "repeat":
            self._render_repeat_fitz(page, elem, data, x, y_screen, w, h, page_w, page_h, registered_fonts)
    
    def _render_text_fitz(self, page: fitz.Page, elem: Dict[str, Any], data: Dict[str, Any], 
                         x: float, y_screen: float, w: float, h: float, page_h: float, registered_fonts: Dict[str, str] = None):
        """Text rendering - using PyMuPDF (excellent CJK text support)"""
        data_path = elem.get("data_path", "")
        value = self._get_data_value(data, data_path)
        
        if value is None:
            return
        
        style = elem.get("style", {})
        font_size = style.get("size", 10)
        align = style.get("align", "left")
        
        text = str(value)
        
        # Select from registered fonts (use registered font name)
        font_name_to_use = None
        
        # Check for Unicode characters in text
        has_unicode = any(ord(c) > 127 for c in text)
        
        # Language detection (Korean/Japanese priority)
        has_korean = any('\uAC00' <= c <= '\uD7A3' for c in text)
        has_japanese = any('\u3040' <= c <= '\u309F' or '\u30A0' <= c <= '\u30FF' or '\u4E00' <= c <= '\u9FAF' for c in text)
        
        # Find fonts from project font directory (CJK support required)
        project_font_dir = Path(__file__).parent.parent.parent / "fonts"
        
        # Select from registered fonts (font required if Unicode exists)
        if registered_fonts and project_font_dir.exists():
            # Japanese priority (includes Kanji)
            if has_japanese:
                jp_font_path = project_font_dir / "NotoSansJP-VF.ttf"
                if jp_font_path.exists() and str(jp_font_path) in registered_fonts:
                    font_name_to_use = registered_fonts[str(jp_font_path)]
                    print(f"✓ Using Japanese font: {font_name_to_use}")
            # Korean
            elif has_korean:
                kr_font_path = project_font_dir / "NotoSansKR-VF.ttf"
                if kr_font_path.exists() and str(kr_font_path) in registered_fonts:
                    font_name_to_use = registered_fonts[str(kr_font_path)]
                    print(f"✓ Using Korean font: {font_name_to_use}")
            # Use default font if Unicode exists
            elif has_unicode:
                for font_file_path, font_name in registered_fonts.items():
                    font_name_to_use = font_name
                    print(f"✓ Using Unicode font: {font_name_to_use}")
                    break
        
        # Warning if font not found
        if has_unicode and not font_name_to_use:
            print(f"⚠ Cannot find font for Unicode text: {text[:20]}...")
            print(f"   Font directory: {project_font_dir}")
        
        # PyMuPDF coordinate system: top-left is (0, 0)
        # insert_text's point is the text's baseline position
        # y_screen is screen coordinate system (top is 0)
        # Place baseline at approximately 70% of field area to center text in field
        # (approximately 75% of font size is above baseline)
        y_text = y_screen + h * 0.7  # Place baseline at approximately 70% of field area
        
        # Alignment handling
        if align == "center":
            # PyMuPDF supports alignment in insert_textbox
            pass
        elif align == "right":
            # Right alignment: adjust by calculating text width
            try:
                if font_name_to_use:
                    text_width = page.get_text_length(text, fontsize=font_size, fontname=font_name_to_use)
                else:
                    text_width = page.get_text_length(text, fontsize=font_size)
                x = x + w - text_width
            except:
                pass
        
        # Insert text (recognized as PDF text, selectable/searchable)
        try:
            if font_name_to_use:
                # Insert text using registered font name
                page.insert_text(
                    point=(x, y_text),
                    text=text,
                    fontsize=font_size,
                    fontname=font_name_to_use,
                    color=(0, 0, 0),
                    render_mode=0  # Text mode (0=fill, 3=invisible)
                )
            elif has_unicode:
                # Unicode without font may cause errors
                print(f"⚠ Warning: Unicode text without font, using default font (may break): {text[:20]}...")
                page.insert_text(
                    point=(x, y_text),
                    text=text,
                    fontsize=font_size,
                    color=(0, 0, 0)
                )
            else:
                # Use default font (English, etc.)
                page.insert_text(
                    point=(x, y_text),
                    text=text,
                    fontsize=font_size,
                    color=(0, 0, 0)
                )
        except Exception as e:
            print(f"⚠ PyMuPDF text insertion failed: {e}")
            print(f"   Text: {text[:50]}...")
            print(f"   Font name: {font_name_to_use}")
            import traceback
            traceback.print_exc()
    
    def _render_checkbox_fitz(self, page: fitz.Page, elem: Dict[str, Any], data: Dict[str, Any], 
                             x: float, y_screen: float, w: float, h: float, page_h: float):
        """Checkbox rendering - using PyMuPDF (display checkmark only, no box)"""
        data_path = elem.get("data_path", "")
        value = self._get_data_value(data, data_path)
        
        checked = bool(value) if value is not None else False
        
        if not checked:
            return  # Don't draw anything if not checked
        
        # Square area size
        size = min(w, h)
        
        # Checkmark size proportional to area size (60% of area)
        check_size = size * 0.6
        center_x = x + size / 2
        center_y = y_screen + size / 2
        
        # Check line width also proportional to size (min 1.5, max 4)
        line_width = max(1.5, min(4, size / 8))
        
        # Checkmark (bolder and clearer ✓ shape)
        offset = check_size * 0.3
        
        # From bottom-left to center
        page.draw_line(
            (center_x - offset * 0.8, center_y), 
            (center_x - offset * 0.2, center_y + offset * 0.6), 
            color=(0, 0, 0), width=line_width  # Black
        )
        # From center to top-right
        page.draw_line(
            (center_x - offset * 0.2, center_y + offset * 0.6), 
            (center_x + offset * 1.0, center_y - offset * 0.4), 
            color=(0, 0, 0), width=line_width  # Black
        )
    
    def _render_image_fitz(self, page: fitz.Page, elem: Dict[str, Any], data: Dict[str, Any], 
                          x: float, y_screen: float, w: float, h: float):
        """Image rendering - using PyMuPDF"""
        image_path = elem.get("image_path", "")
        
        if not image_path:
            return
        
        # Image path is relative (uploads/images/xxx.png)
        # Convert to absolute path
        if image_path.startswith("images/"):
            image_file_path = self.uploads_dir / image_path
        else:
            image_file_path = self.uploads_dir / "images" / image_path
        
        if not image_file_path.exists():
            print(f"⚠ Image file not found: {image_file_path}")
            return
        
        try:
            # Load and insert image
            rect = fitz.Rect(x, y_screen, x + w, y_screen + h)
            page.insert_image(rect, filename=str(image_file_path))
            print(f"✓ Image insertion completed: {image_path} at ({x}, {y_screen}) size ({w}, {h})")
        except Exception as e:
            print(f"⚠ PyMuPDF image insertion failed: {e}")
            print(f"   Image path: {image_file_path}")
            import traceback
            traceback.print_exc()
    
    def _render_repeat_fitz(self, page: fitz.Page, elem: Dict[str, Any], data: Dict[str, Any], 
                           x: float, y_screen: float, w: float, h: float, page_w: float, page_h: float, registered_fonts: Dict[str, str] = None):
        """Repeat table rendering - using PyMuPDF"""
        if registered_fonts is None:
            registered_fonts = {}
        items_path = elem.get("items_path", "")
        items = self._get_data_value(data, items_path)
        
        if not isinstance(items, list):
            return
        
        columns = elem.get("columns", [])
        row_height = elem.get("row_height", 18)
        
        # Find project fonts (CJK support)
        project_font_dir = Path(__file__).parent.parent.parent / "fonts"
        font_file = None
        
        # Language detection from all texts
        all_texts = []
        for item in items:
            for col in columns:
                col_key = col.get("key", "")
                value = item.get(col_key, "") if isinstance(item, dict) else ""
                if value:
                    all_texts.append(str(value))
        
        combined_text = "".join(all_texts)
        has_korean = any('\uAC00' <= c <= '\uD7A3' for c in combined_text)
        has_japanese = any('\u3040' <= c <= '\u309F' or '\u30A0' <= c <= '\u30FF' or '\u4E00' <= c <= '\u9FAF' for c in combined_text)
        has_unicode = any(ord(c) > 127 for c in combined_text)
        
        if project_font_dir.exists():
            if has_japanese:
                font_path = project_font_dir / "NotoSansJP-VF.ttf"
                if font_path.exists():
                    font_file = str(font_path)
            elif has_korean:
                font_path = project_font_dir / "NotoSansKR-VF.ttf"
                if font_path.exists():
                    font_file = str(font_path)
            elif has_unicode:
                for font_name in ["NotoSansKR-VF.ttf", "NotoSansJP-VF.ttf", "NotoSans-Regular.ttf"]:
                    font_path = project_font_dir / font_name
                    if font_path.exists():
                        font_file = str(font_path)
                        break
        
        current_y = y_screen
        for item in items:
            if current_y + row_height > page_h:
                break  # Out of page range
            
            for col in columns:
                col_x = x + col.get("x", 0)
                col_w = col.get("w", 100)
                col_key = col.get("key", "")
                col_align = col.get("align", "left")
                
                value = item.get(col_key, "") if isinstance(item, dict) else ""
                
                if value:
                    style = elem.get("style", {})
                    font_size = style.get("size", 10)
                    text = str(value)
                    
                    # Language detection and font selection for each text
                    item_has_korean = any('\uAC00' <= c <= '\uD7A3' for c in text)
                    item_has_japanese = any('\u3040' <= c <= '\u309F' or '\u30A0' <= c <= '\u30FF' or '\u4E00' <= c <= '\u9FAF' for c in text)
                    item_has_unicode = any(ord(c) > 127 for c in text)
                    
                    # Select from registered fonts
                    item_font_name_to_use = None
                    if registered_fonts and project_font_dir.exists():
                        if item_has_japanese:
                            item_font_path = project_font_dir / "NotoSansJP-VF.ttf"
                            if item_font_path.exists() and str(item_font_path) in registered_fonts:
                                item_font_name_to_use = registered_fonts[str(item_font_path)]
                        elif item_has_korean:
                            item_font_path = project_font_dir / "NotoSansKR-VF.ttf"
                            if item_font_path.exists() and str(item_font_path) in registered_fonts:
                                item_font_name_to_use = registered_fonts[str(item_font_path)]
                        elif item_has_unicode:
                            # Use first registered font if Unicode
                            if registered_fonts:
                                item_font_name_to_use = list(registered_fonts.values())[0]
                    
                    text_x = col_x
                    # Alignment handling
                    if col_align == "center" or col_align == "right":
                        try:
                            if item_font_name_to_use:
                                text_width = page.get_text_length(text, fontsize=font_size, fontname=item_font_name_to_use)
                            else:
                                text_width = page.get_text_length(text, fontsize=font_size)
                            
                            if col_align == "right":
                                text_x = col_x + col_w - text_width
                            elif col_align == "center":
                                text_x = col_x + (col_w - text_width) / 2
                        except:
                            pass
                    
                    # Insert text (use appropriate font for each text)
                    # Y coordinate: place baseline at center of row_height
                    text_y = current_y + row_height - (row_height - font_size * 0.2) / 2
                    
                    try:
                        if item_font_name_to_use:
                            page.insert_text(
                                point=(text_x, text_y),
                                text=text,
                                fontsize=font_size,
                                fontname=item_font_name_to_use,
                                color=(0, 0, 0),
                                render_mode=0
                            )
                        elif item_has_unicode:
                            # Use default font if Unicode without font (may break)
                            page.insert_text(
                                point=(text_x, text_y),
                                text=text,
                                fontsize=font_size,
                                color=(0, 0, 0)
                            )
                        else:
                            # Use default font (English, etc.)
                            page.insert_text(
                                point=(text_x, text_y),
                                text=text,
                                fontsize=font_size,
                                color=(0, 0, 0)
                            )
                    except Exception as e:
                        print(f"⚠ PyMuPDF repeat text insertion failed: {e}")
                        print(f"   Text: {text[:50]}...")
                        print(f"   Font name: {item_font_name_to_use}")
            
            current_y += row_height