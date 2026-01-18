from pathlib import Path
from typing import Dict, Any, Optional
from pypdf import PdfWriter, PdfReader
import fitz  # PyMuPDF
from datetime import datetime


class RenderService:
    """PDF 렌더링 엔진 (템플릿 + 데이터 → 완성 PDF)"""
    
    def __init__(self, templates_dir: Path, uploads_dir: Path):
        self.templates_dir = templates_dir
        self.uploads_dir = uploads_dir
    
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
        """데이터로 오버레이 PDF 생성 - PyMuPDF 사용 (한글/일본어 텍스트 지원 우수)"""
        w_pt = page_size.get("w_pt", 595.28)
        h_pt = page_size.get("h_pt", 841.89)
        
        output_dir = self.uploads_dir / "rendered"
        output_dir.mkdir(exist_ok=True)
        
        overlay_path = output_dir / f"overlay_{datetime.now().timestamp()}.pdf"
        
        # PyMuPDF로 오버레이 PDF 생성 (한글/일본어 텍스트 지원 우수)
        doc = fitz.open()  # 새 PDF 생성
        
        elements = template.get("elements", [])
        pages_elements = {}  # 페이지별로 요소 그룹화
        
        # 페이지별로 요소 분류
        for elem in elements:
            page = elem.get("page", 1)
            if page not in pages_elements:
                pages_elements[page] = []
            pages_elements[page].append(elem)
        
        # 프로젝트 폰트 디렉토리에서 폰트 파일 찾기 및 등록
        project_font_dir = Path(__file__).parent.parent.parent / "fonts"
        registered_fonts = {}  # 폰트 파일 경로 -> 폰트 이름 매핑
        
        if project_font_dir.exists():
            # Noto Sans JP (일본어)
            jp_font_path = project_font_dir / "NotoSansJP-VF.ttf"
            if jp_font_path.exists():
                registered_fonts[str(jp_font_path)] = "NotoSansJP"
            
            # Noto Sans KR (한국어)
            kr_font_path = project_font_dir / "NotoSansKR-VF.ttf"
            if kr_font_path.exists():
                registered_fonts[str(kr_font_path)] = "NotoSansKR"
        
        # 각 페이지 처리
        max_page = max(pages_elements.keys()) if pages_elements else 1
        for page_num in range(1, max_page + 1):
            # 새 페이지 추가
            page = doc.new_page(width=w_pt, height=h_pt)
            
            # 폰트 등록 (각 페이지에서 폰트 등록)
            for font_file_path, font_name in registered_fonts.items():
                try:
                    page.insert_font(fontname=font_name, fontfile=font_file_path)
                    print(f"✓ 페이지 {page_num}에 폰트 등록: {font_name} ({font_file_path})")
                except Exception as e:
                    print(f"⚠ 폰트 등록 실패 ({font_name}): {e}")
            
            page_elements = pages_elements.get(page_num, [])
            
            for elem in page_elements:
                self._render_element_fitz(page, elem, data, w_pt, h_pt, registered_fonts)
        
        doc.save(str(overlay_path))
        doc.close()
        return overlay_path
    
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
    
    # ========== PyMuPDF 렌더링 메서드들 (한글/일본어 텍스트 지원) ==========
    
    def _render_element_fitz(self, page: fitz.Page, elem: Dict[str, Any], data: Dict[str, Any], page_w: float, page_h: float, registered_fonts: Dict[str, str] = None):
        """단일 요소 렌더링 - PyMuPDF 사용"""
        if registered_fonts is None:
            registered_fonts = {}
        
        elem_type = elem.get("type", "text")
        bbox = elem.get("bbox", {})
        x = bbox.get("x", 0)
        y_screen = bbox.get("y", 0)  # 화면 좌표계 (위가 0)
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
        """텍스트 렌더링 - PyMuPDF 사용 (한글/일본어 텍스트 지원 우수)"""
        data_path = elem.get("data_path", "")
        value = self._get_data_value(data, data_path)
        
        if value is None:
            return
        
        style = elem.get("style", {})
        font_size = style.get("size", 10)
        align = style.get("align", "left")
        
        text = str(value)
        
        # 등록된 폰트에서 선택 (등록된 폰트 이름 사용)
        font_name_to_use = None
        
        # 텍스트에 유니코드 문자 확인
        has_unicode = any(ord(c) > 127 for c in text)
        
        # 언어 감지 (한글/일본어 우선)
        has_korean = any('\uAC00' <= c <= '\uD7A3' for c in text)
        has_japanese = any('\u3040' <= c <= '\u309F' or '\u30A0' <= c <= '\u30FF' or '\u4E00' <= c <= '\u9FAF' for c in text)
        
        # 프로젝트 폰트 디렉토리에서 폰트 찾기 (한글/일본어 지원 필수)
        project_font_dir = Path(__file__).parent.parent.parent / "fonts"
        
        # 등록된 폰트에서 선택 (유니코드가 있으면 반드시 폰트 필요)
        if registered_fonts and project_font_dir.exists():
            # 일본어 우선 (한자 포함)
            if has_japanese:
                jp_font_path = project_font_dir / "NotoSansJP-VF.ttf"
                if jp_font_path.exists() and str(jp_font_path) in registered_fonts:
                    font_name_to_use = registered_fonts[str(jp_font_path)]
                    print(f"✓ 일본어 폰트 사용: {font_name_to_use}")
            # 한국어
            elif has_korean:
                kr_font_path = project_font_dir / "NotoSansKR-VF.ttf"
                if kr_font_path.exists() and str(kr_font_path) in registered_fonts:
                    font_name_to_use = registered_fonts[str(kr_font_path)]
                    print(f"✓ 한국어 폰트 사용: {font_name_to_use}")
            # 유니코드가 있으면 기본 폰트라도 사용
            elif has_unicode:
                for font_file_path, font_name in registered_fonts.items():
                    font_name_to_use = font_name
                    print(f"✓ 유니코드 폰트 사용: {font_name_to_use}")
                    break
        
        # 폰트가 없으면 경고
        if has_unicode and not font_name_to_use:
            print(f"⚠ 유니코드 텍스트를 위한 폰트를 찾을 수 없습니다: {text[:20]}...")
            print(f"   폰트 디렉토리: {project_font_dir}")
        
        # PyMuPDF 좌표계: 왼쪽 위가 (0, 0)
        # insert_text의 point는 텍스트의 baseline(하단 기준선) 위치
        # y_screen은 화면 좌표계 (위가 0)
        # baseline을 필드 영역의 약 70% 위치에 배치하여 텍스트가 필드 중앙에 오도록 함
        # (폰트 크기의 약 75%가 baseline 위에 있으므로)
        y_text = y_screen + h * 0.7  # 필드 영역의 약 70% 위치에 baseline 배치
        
        # 정렬 처리
        if align == "center":
            # PyMuPDF는 정렬을 insert_textbox에서 지원
            pass
        elif align == "right":
            # 오른쪽 정렬은 텍스트 너비를 계산해서 조정
            try:
                if font_name_to_use:
                    text_width = page.get_text_length(text, fontsize=font_size, fontname=font_name_to_use)
                else:
                    text_width = page.get_text_length(text, fontsize=font_size)
                x = x + w - text_width
            except:
                pass
        
        # 텍스트 삽입 (PDF 텍스트로 인식됨, 선택/검색 가능)
        try:
            if font_name_to_use:
                # 등록된 폰트 이름을 사용하여 텍스트 삽입
                page.insert_text(
                    point=(x, y_text),
                    text=text,
                    fontsize=font_size,
                    fontname=font_name_to_use,
                    color=(0, 0, 0),
                    render_mode=0  # 텍스트 모드 (0=fill, 3=invisible)
                )
            elif has_unicode:
                # 유니코드인데 폰트가 없으면 오류 발생 가능
                print(f"⚠ 경고: 유니코드 텍스트인데 폰트가 없어 기본 폰트 사용 (깨질 수 있음): {text[:20]}...")
                page.insert_text(
                    point=(x, y_text),
                    text=text,
                    fontsize=font_size,
                    color=(0, 0, 0)
                )
            else:
                # 기본 폰트 사용 (영어 등)
                page.insert_text(
                    point=(x, y_text),
                    text=text,
                    fontsize=font_size,
                    color=(0, 0, 0)
                )
        except Exception as e:
            print(f"⚠ PyMuPDF 텍스트 삽입 실패: {e}")
            print(f"   텍스트: {text[:50]}...")
            print(f"   폰트 이름: {font_name_to_use}")
            import traceback
            traceback.print_exc()
    
    def _render_checkbox_fitz(self, page: fitz.Page, elem: Dict[str, Any], data: Dict[str, Any], 
                             x: float, y_screen: float, w: float, h: float, page_h: float):
        """체크박스 렌더링 - PyMuPDF 사용 (네모 없이 체크만 표시)"""
        data_path = elem.get("data_path", "")
        value = self._get_data_value(data, data_path)
        
        checked = bool(value) if value is not None else False
        
        if not checked:
            return  # 체크되지 않으면 아무것도 그리지 않음
        
        # 정사각형 영역 크기
        size = min(w, h)
        
        # 체크 표시 크기가 영역 크기에 비례하도록 (영역의 60% 크기)
        check_size = size * 0.6
        center_x = x + size / 2
        center_y = y_screen + size / 2
        
        # 체크 라인 두께도 크기에 비례 (최소 1.5, 최대 4)
        line_width = max(1.5, min(4, size / 8))
        
        # 체크 표시 (더 굵고 명확한 ✓ 모양)
        offset = check_size * 0.3
        
        # 왼쪽 아래에서 중앙으로
        page.draw_line(
            (center_x - offset * 0.8, center_y), 
            (center_x - offset * 0.2, center_y + offset * 0.6), 
            color=(0, 0, 0), width=line_width  # 검정색
        )
        # 중앙에서 오른쪽 위로
        page.draw_line(
            (center_x - offset * 0.2, center_y + offset * 0.6), 
            (center_x + offset * 1.0, center_y - offset * 0.4), 
            color=(0, 0, 0), width=line_width  # 검정색
        )
    
    def _render_image_fitz(self, page: fitz.Page, elem: Dict[str, Any], data: Dict[str, Any], 
                          x: float, y_screen: float, w: float, h: float):
        """이미지 렌더링 - PyMuPDF 사용"""
        image_path = elem.get("image_path", "")
        
        if not image_path:
            return
        
        # 이미지 경로는 상대 경로 (uploads/images/xxx.png)
        # 절대 경로로 변환
        if image_path.startswith("images/"):
            image_file_path = self.uploads_dir / image_path
        else:
            image_file_path = self.uploads_dir / "images" / image_path
        
        if not image_file_path.exists():
            print(f"⚠ 이미지 파일을 찾을 수 없습니다: {image_file_path}")
            return
        
        try:
            # 이미지 로드 및 삽입
            rect = fitz.Rect(x, y_screen, x + w, y_screen + h)
            page.insert_image(rect, filename=str(image_file_path))
            print(f"✓ 이미지 삽입 완료: {image_path} at ({x}, {y_screen}) size ({w}, {h})")
        except Exception as e:
            print(f"⚠ PyMuPDF 이미지 삽입 실패: {e}")
            print(f"   이미지 경로: {image_file_path}")
            import traceback
            traceback.print_exc()
    
    def _render_repeat_fitz(self, page: fitz.Page, elem: Dict[str, Any], data: Dict[str, Any], 
                           x: float, y_screen: float, w: float, h: float, page_w: float, page_h: float, registered_fonts: Dict[str, str] = None):
        """반복 테이블 렌더링 - PyMuPDF 사용"""
        if registered_fonts is None:
            registered_fonts = {}
        items_path = elem.get("items_path", "")
        items = self._get_data_value(data, items_path)
        
        if not isinstance(items, list):
            return
        
        columns = elem.get("columns", [])
        row_height = elem.get("row_height", 18)
        
        # 프로젝트 폰트 찾기 (한글/일본어 지원)
        project_font_dir = Path(__file__).parent.parent.parent / "fonts"
        font_file = None
        
        # 모든 텍스트에서 언어 감지
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
                break  # 페이지 범위 벗어남
            
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
                    
                    # 각 텍스트별로 언어 감지 및 폰트 선택
                    item_has_korean = any('\uAC00' <= c <= '\uD7A3' for c in text)
                    item_has_japanese = any('\u3040' <= c <= '\u309F' or '\u30A0' <= c <= '\u30FF' or '\u4E00' <= c <= '\u9FAF' for c in text)
                    item_has_unicode = any(ord(c) > 127 for c in text)
                    
                    # 등록된 폰트에서 선택
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
                            # 유니코드이면 등록된 첫 번째 폰트 사용
                            if registered_fonts:
                                item_font_name_to_use = list(registered_fonts.values())[0]
                    
                    text_x = col_x
                    # 정렬 처리
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
                    
                    # 텍스트 삽입 (각 텍스트별로 적절한 폰트 사용)
                    # Y 좌표: row_height의 중앙에 baseline 배치
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
                            # 유니코드인데 폰트가 없으면 기본 폰트 사용 (깨질 수 있음)
                            page.insert_text(
                                point=(text_x, text_y),
                                text=text,
                                fontsize=font_size,
                                color=(0, 0, 0)
                            )
                        else:
                            # 기본 폰트 사용 (영어 등)
                            page.insert_text(
                                point=(text_x, text_y),
                                text=text,
                                fontsize=font_size,
                                color=(0, 0, 0)
                            )
                    except Exception as e:
                        print(f"⚠ PyMuPDF 반복 텍스트 삽입 실패: {e}")
                        print(f"   텍스트: {text[:50]}...")
                        print(f"   폰트 이름: {item_font_name_to_use}")
            
            current_y += row_height