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
            # Japanese fonts (priority: MS Gothic > MS Mincho > Noto Sans JP)
            # MS Gothic (ゴシック体) - Most common in Japanese government documents
            msgothic_path = project_font_dir / "msgothic.ttc"
            if msgothic_path.exists():
                registered_fonts[str(msgothic_path)] = "MSGothic"
            else:
                # Try alternative names
                for alt_name in ["msgothic.ttf", "MS-Gothic.ttf", "msgothic.otf"]:
                    alt_path = project_font_dir / alt_name
                    if alt_path.exists():
                        registered_fonts[str(alt_path)] = "MSGothic"
                        break
            
            # MS Mincho (明朝体) - For formal documents
            msmincho_path = project_font_dir / "msmincho.ttc"
            if msmincho_path.exists():
                registered_fonts[str(msmincho_path)] = "MSMincho"
            else:
                for alt_name in ["msmincho.ttf", "MS-Mincho.ttf", "msmincho.otf"]:
                    alt_path = project_font_dir / alt_name
                    if alt_path.exists():
                        registered_fonts[str(alt_path)] = "MSMincho"
                        break
            
            # Noto Sans JP (fallback for Japanese)
            jp_font_path = project_font_dir / "NotoSansJP-VF.ttf"
            if jp_font_path.exists():
                registered_fonts[str(jp_font_path)] = "NotoSansJP"
            # Noto Sans JP Bold (if available)
            jp_bold_path = project_font_dir / "NotoSansJP-Bold.ttf"
            if jp_bold_path.exists():
                registered_fonts[str(jp_bold_path)] = "NotoSansJP-Bold"
            
            # Korean fonts (priority: Malgun Gothic > Nanum Gothic > Noto Sans KR)
            # Malgun Gothic (맑은 고딕) - Windows default, common in Korean documents
            malgun_path = project_font_dir / "malgun.ttf"
            if malgun_path.exists():
                registered_fonts[str(malgun_path)] = "MalgunGothic"
            else:
                for alt_name in ["malgun.ttc", "malgun.otf", "Malgun-Gothic.ttf"]:
                    alt_path = project_font_dir / alt_name
                    if alt_path.exists():
                        registered_fonts[str(alt_path)] = "MalgunGothic"
                        break
            
            # Nanum Gothic (나눔고딕) - Common in public institutions
            nanum_path = project_font_dir / "NanumGothic.ttf"
            if nanum_path.exists():
                registered_fonts[str(nanum_path)] = "NanumGothic"
            else:
                for alt_name in ["NanumGothic-Regular.ttf", "NanumGothic.otf"]:
                    alt_path = project_font_dir / alt_name
                    if alt_path.exists():
                        registered_fonts[str(alt_path)] = "NanumGothic"
                        break
            
            # Noto Sans KR (fallback for Korean)
            kr_font_path = project_font_dir / "NotoSansKR-VF.ttf"
            if kr_font_path.exists():
                registered_fonts[str(kr_font_path)] = "NotoSansKR"
            # Noto Sans KR Bold (if available)
            kr_bold_path = project_font_dir / "NotoSansKR-Bold.ttf"
            if kr_bold_path.exists():
                registered_fonts[str(kr_bold_path)] = "NotoSansKR-Bold"
            # Nanum Gothic Bold (if available)
            nanum_bold_path = project_font_dir / "NanumGothic-Bold.ttf"
            if nanum_bold_path.exists():
                registered_fonts[str(nanum_bold_path)] = "NanumGothic-Bold"
        
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
        font_weight = style.get("weight", "normal")  # normal or bold
        text_color = style.get("color", "#000000")  # Text color (hex format)
        background_color = style.get("background_color", None)  # Background color (hex format or None)
        underline = style.get("underline", False)  # Underline decoration
        strikethrough = style.get("strikethrough", False)  # Strikethrough decoration
        line_height = style.get("line_height", 1.2)  # Line height multiplier
        letter_spacing = style.get("letter_spacing", 0)  # Letter spacing in points
        vertical_align = style.get("vertical_align", "top")  # top, middle, bottom
        
        text = str(value)
        
        # Always use Noto Sans fonts (auto-detect language)
        font_name_to_use = None
        
        # Check for Unicode characters in text
        has_unicode = any(ord(c) > 127 for c in text)
        
        # Language detection (Korean/Japanese priority)
        has_korean = any('\uAC00' <= c <= '\uD7A3' for c in text)
        has_japanese = any('\u3040' <= c <= '\u309F' or '\u30A0' <= c <= '\u30FF' or '\u4E00' <= c <= '\u9FAF' for c in text)
        
        # Find fonts from project font directory
        project_font_dir = Path(__file__).parent.parent.parent / "fonts"
        
        # Always use Noto Sans fonts based on language
        if registered_fonts and project_font_dir.exists():
            # Japanese: Noto Sans JP
            if has_japanese:
                # Try bold variant first if bold is requested
                if font_weight == "bold":
                    for font_file_path, font_name in registered_fonts.items():
                        if font_name == "NotoSansJP-Bold":
                            font_name_to_use = font_name
                            print(f"✓ Using Noto Sans JP Bold")
                            break
                # Use regular if bold not found or not requested
                if not font_name_to_use:
                    for font_file_path, font_name in registered_fonts.items():
                        if font_name == "NotoSansJP":
                            font_name_to_use = font_name
                            if font_weight == "bold":
                                print(f"✓ Using Noto Sans JP (bold simulation)")
                            else:
                                print(f"✓ Using Noto Sans JP")
                            break
            # Korean: Noto Sans KR
            elif has_korean:
                # Try bold variant first if bold is requested
                if font_weight == "bold":
                    for font_file_path, font_name in registered_fonts.items():
                        if font_name == "NotoSansKR-Bold":
                            font_name_to_use = font_name
                            print(f"✓ Using Noto Sans KR Bold")
                            break
                # Use regular if bold not found or not requested
                if not font_name_to_use:
                    for font_file_path, font_name in registered_fonts.items():
                        if font_name == "NotoSansKR":
                            font_name_to_use = font_name
                            if font_weight == "bold":
                                print(f"✓ Using Noto Sans KR (bold simulation)")
                            else:
                                print(f"✓ Using Noto Sans KR")
                            break
            # English/Other: Use Noto Sans JP as default (supports English)
            else:
                # Try bold variant first if bold is requested
                if font_weight == "bold":
                    for font_file_path, font_name in registered_fonts.items():
                        if font_name == "NotoSansJP-Bold":
                            font_name_to_use = font_name
                            print(f"✓ Using Noto Sans JP Bold (English)")
                            break
                # Use regular if bold not found or not requested
                if not font_name_to_use:
                    for font_file_path, font_name in registered_fonts.items():
                        if font_name == "NotoSansJP":
                            font_name_to_use = font_name
                            if font_weight == "bold":
                                print(f"✓ Using Noto Sans JP (English, bold simulation)")
                            else:
                                print(f"✓ Using Noto Sans JP (English)")
                            break
                    # Fallback to Noto Sans KR if JP not available
                    if not font_name_to_use:
                        for font_file_path, font_name in registered_fonts.items():
                            if font_name == "NotoSansKR":
                                font_name_to_use = font_name
                                print(f"✓ Using Noto Sans KR (fallback)")
                                break
        
        # Warning if font not found
        if has_unicode and not font_name_to_use:
            print(f"⚠ Cannot find font for Unicode text: {text[:20]}...")
            print(f"   Font directory: {project_font_dir}")
        
        # Convert hex color to RGB tuple
        def hex_to_rgb(hex_color):
            """Convert hex color (#RRGGBB) to RGB tuple (0-1 range)"""
            hex_color = hex_color.lstrip('#')
            if len(hex_color) == 6:
                r = int(hex_color[0:2], 16) / 255.0
                g = int(hex_color[2:4], 16) / 255.0
                b = int(hex_color[4:6], 16) / 255.0
                return (r, g, b)
            return (0, 0, 0)  # Default to black
        
        text_color_rgb = hex_to_rgb(text_color)
        
        # Draw background color if specified
        if background_color and background_color.lower() not in ['transparent', 'none', '']:
            bg_color_rgb = hex_to_rgb(background_color)
            rect = fitz.Rect(x, y_screen, x + w, y_screen + h)
            page.draw_rect(rect, color=bg_color_rgb, fill=bg_color_rgb, width=0)
        
        # PyMuPDF coordinate system: top-left is (0, 0)
        # insert_text's point is the text's baseline position
        # y_screen is screen coordinate system (top is 0)
        # Place baseline at top of field area with margin (approximately 80% of font size is above baseline)
        top_margin = 5  # Margin from top (in points)
        
        # Vertical alignment adjustment
        if vertical_align == "middle":
            # Center vertically: adjust y position to middle of field
            y_text = y_screen + h / 2 + font_size * 0.3  # Approximate baseline position for middle
        elif vertical_align == "bottom":
            # Bottom alignment: place near bottom of field
            y_text = y_screen + h - font_size * 0.2 - top_margin
        else:  # top
            y_text = y_screen + font_size * 0.8 + top_margin  # Place baseline near top of field area with margin
        
        # Left margin (only for left alignment)
        left_margin = 5  # Margin from left (in points)
        x_text = x  # Default to x position
        
        # Alignment handling
        if align == "center":
            # Center alignment: adjust by calculating text width
            try:
                if font_name_to_use:
                    text_width = page.get_text_length(text, fontsize=font_size, fontname=font_name_to_use)
                else:
                    text_width = page.get_text_length(text, fontsize=font_size)
                x_text = x + (w - text_width) / 2
            except:
                x_text = x + left_margin
        elif align == "right":
            # Right alignment: adjust by calculating text width
            try:
                if font_name_to_use:
                    text_width = page.get_text_length(text, fontsize=font_size, fontname=font_name_to_use)
                else:
                    text_width = page.get_text_length(text, fontsize=font_size)
                x_text = x + w - text_width - left_margin
            except:
                x_text = x + w - left_margin
        else:
            # Left alignment: add left margin
            x_text = x + left_margin
        
        # Insert text (recognized as PDF text, selectable/searchable)
        try:
            if font_name_to_use:
                # For CJK fonts without bold variant, simulate bold using stroke
                # Check if this is a CJK font and bold is requested but not available
                is_cjk_font = font_name_to_use in ["MSGothic", "MSMincho", "NotoSansJP", "MalgunGothic", "NanumGothic", "NotoSansKR"]
                use_bold_simulation = is_cjk_font and font_weight == "bold" and "-Bold" not in font_name_to_use
                
                if use_bold_simulation:
                    # Simulate bold by drawing text with stroke
                    # First draw with stroke (outline) to make it bolder
                    page.insert_text(
                        point=(x_text, y_text),
                        text=text,
                        fontsize=font_size,
                        fontname=font_name_to_use,
                        color=text_color_rgb,
                        render_mode=2  # Stroke mode (outline)
                    )
                    # Then draw filled text on top
                    page.insert_text(
                        point=(x_text, y_text),
                        text=text,
                        fontsize=font_size,
                        fontname=font_name_to_use,
                        color=text_color_rgb,
                        render_mode=0  # Fill mode
                    )
                else:
                    # Insert text using registered font name (normal or bold variant available)
                    page.insert_text(
                        point=(x_text, y_text),
                        text=text,
                        fontsize=font_size,
                        fontname=font_name_to_use,
                        color=text_color_rgb,
                        render_mode=0  # Text mode (0=fill, 3=invisible)
                    )
            elif has_unicode:
                # Unicode without font may cause errors
                print(f"⚠ Warning: Unicode text without font, using default font (may break): {text[:20]}...")
                page.insert_text(
                    point=(x_text, y_text),
                    text=text,
                    fontsize=font_size,
                    color=text_color_rgb
                )
            else:
                # Use default font (English, etc.)
                page.insert_text(
                    point=(x_text, y_text),
                    text=text,
                    fontsize=font_size,
                    color=text_color_rgb
                )
            
            # Draw underline if specified
            if underline:
                try:
                    if font_name_to_use:
                        text_width = page.get_text_length(text, fontsize=font_size, fontname=font_name_to_use)
                    else:
                        text_width = page.get_text_length(text, fontsize=font_size)
                    
                    underline_y = y_text + 2  # Slightly below baseline
                    underline_thickness = max(0.5, font_size * 0.05)  # Thickness proportional to font size
                    page.draw_line(
                        (x_text, underline_y),
                        (x_text + text_width, underline_y),
                        color=text_color_rgb,
                        width=underline_thickness
                    )
                except:
                    pass  # Skip underline if calculation fails
            
            # Draw strikethrough if specified
            if strikethrough:
                try:
                    if font_name_to_use:
                        text_width = page.get_text_length(text, fontsize=font_size, fontname=font_name_to_use)
                    else:
                        text_width = page.get_text_length(text, fontsize=font_size)
                    
                    # Strikethrough position: middle of text height
                    strikethrough_y = y_text - font_size * 0.3  # Approximate middle of text
                    strikethrough_thickness = max(0.5, font_size * 0.05)
                    page.draw_line(
                        (x_text, strikethrough_y),
                        (x_text + text_width, strikethrough_y),
                        color=text_color_rgb,
                        width=strikethrough_thickness
                    )
                except:
                    pass  # Skip strikethrough if calculation fails
                    
        except Exception as e:
            print(f"⚠ PyMuPDF text insertion failed: {e}")
            print(f"   Text: {text[:50]}...")
            print(f"   Font name: {font_name_to_use}")
            import traceback
            traceback.print_exc()
    
    def _render_checkbox_fitz(self, page: fitz.Page, elem: Dict[str, Any], data: Dict[str, Any], 
                             x: float, y_screen: float, w: float, h: float, page_h: float):
        """Checkbox rendering - using PyMuPDF (display checkmark only, no box)
        
        Checkbox doesn't require data from request body - it's always checked if defined in template.
        """
        data_path = elem.get("data_path", "")
        
        # Checkbox doesn't need value from request body - always render if defined in template
        # If data_path exists, the checkbox is meant to be checked
        checked = bool(data_path) if data_path else False
        
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
                    # Calculate text Y position: top of row + font_size * 0.8 + margin (baseline position)
                    top_margin = 5  # Margin from top (in points)
                    text_y = current_y + font_size * 0.8 + top_margin
                    
                    # Language detection and font selection for each text
                    item_has_korean = any('\uAC00' <= c <= '\uD7A3' for c in text)
                    item_has_japanese = any('\u3040' <= c <= '\u309F' or '\u30A0' <= c <= '\u30FF' or '\u4E00' <= c <= '\u9FAF' for c in text)
                    item_has_unicode = any(ord(c) > 127 for c in text)
                    
                    # Select from registered fonts (same priority as text rendering)
                    item_font_name_to_use = None
                    if registered_fonts and project_font_dir.exists():
                        # Japanese: MS Gothic > MS Mincho > Noto Sans JP
                        if item_has_japanese:
                            for font_file_path, font_name in registered_fonts.items():
                                if font_name == "MSGothic":
                                    item_font_name_to_use = font_name
                                    break
                            if not item_font_name_to_use:
                                for font_file_path, font_name in registered_fonts.items():
                                    if font_name == "MSMincho":
                                        item_font_name_to_use = font_name
                                        break
                            if not item_font_name_to_use:
                                for font_file_path, font_name in registered_fonts.items():
                                    if font_name == "NotoSansJP":
                                        item_font_name_to_use = font_name
                                        break
                        # Korean: Malgun Gothic > Nanum Gothic > Noto Sans KR
                        elif item_has_korean:
                            for font_file_path, font_name in registered_fonts.items():
                                if font_name == "MalgunGothic":
                                    item_font_name_to_use = font_name
                                    break
                            if not item_font_name_to_use:
                                for font_file_path, font_name in registered_fonts.items():
                                    if font_name == "NanumGothic":
                                        item_font_name_to_use = font_name
                                        break
                            if not item_font_name_to_use:
                                for font_file_path, font_name in registered_fonts.items():
                                    if font_name == "NotoSansKR":
                                        item_font_name_to_use = font_name
                                        break
                        # Other Unicode: use first available CJK font
                        elif item_has_unicode:
                            if registered_fonts:
                                item_font_name_to_use = list(registered_fonts.values())[0]
                    
                    # Left margin (only for left alignment)
                    left_margin = 5  # Margin from left (in points)
                    text_x = col_x  # Default to column x position
                    
                    # Alignment handling
                    if col_align == "center" or col_align == "right":
                        try:
                            if item_font_name_to_use:
                                text_width = page.get_text_length(text, fontsize=font_size, fontname=item_font_name_to_use)
                            else:
                                text_width = page.get_text_length(text, fontsize=font_size)
                            
                            if col_align == "right":
                                text_x = col_x + col_w - text_width - left_margin
                            elif col_align == "center":
                                text_x = col_x + (col_w - text_width) / 2
                        except:
                            text_x = col_x + left_margin
                    else:
                        # Left alignment: add left margin
                        text_x = col_x + left_margin
                    
                    # Insert text (use appropriate font for each text)
                    # Y coordinate: text_y already set above to start from top (current_y + font_size * 0.8)
                    
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