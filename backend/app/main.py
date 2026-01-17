from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uvicorn
import os
import json
import uuid
from pathlib import Path
from datetime import datetime

from app.services.pdf_service import PDFService
from app.services.template_service import TemplateService
from app.services.render_service import RenderService

app = FastAPI(title="PDF 템플릿 자동화 엔진", version="1.0.0")

# CORS 설정 (프론트엔드와 통신을 위해)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 디렉토리 생성
BASE_DIR = Path(__file__).parent.parent
TEMPLATES_DIR = BASE_DIR / "templates"
UPLOADS_DIR = BASE_DIR / "uploads"
TEMPLATES_DIR.mkdir(exist_ok=True)
UPLOADS_DIR.mkdir(exist_ok=True)

# 서비스 초기화
pdf_service = PDFService()
template_service = TemplateService(TEMPLATES_DIR)
render_service = RenderService(TEMPLATES_DIR, UPLOADS_DIR)


# ===== 빈 A4 템플릿 생성 =====
@app.post("/api/templates/blank")
async def create_blank_template(page_count: int = 1):
    """빈 A4 템플릿 생성"""
    try:
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import A4
        
        template_id = str(uuid.uuid4())
        
        # 빈 A4 PDF 생성
        file_path = UPLOADS_DIR / f"{template_id}.pdf"
        c = canvas.Canvas(str(file_path), pagesize=A4)
        
        # A4 크기: 595.28 x 841.89 pt
        for i in range(page_count):
            if i > 0:
                c.showPage()
        c.save()
        
        # 기본 템플릿 구조 생성
        template = {
            "template_id": template_id,
            "filename": "blank_a4.pdf",
            "page_size": {"w_pt": 595.28, "h_pt": 841.89},
            "pages": [{
                "page": i + 1,
                "width": 595.28,
                "height": 841.89,
                "width_pt": 595.28,
                "height_pt": 841.89,
            } for i in range(page_count)],
            "elements": [],
            "created_at": datetime.now().isoformat(),
        }
        
        template_service.save_template(template_id, template)
        
        return {
            "template_id": template_id,
            "filename": "blank_a4.pdf",
            "page_count": page_count,
            "page_size": {"w_pt": 595.28, "h_pt": 841.89},
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ===== 템플릿 업로드 =====
@app.post("/api/templates")
async def upload_template(file: UploadFile = File(...)):
    """PDF 템플릿 업로드"""
    try:
        template_id = str(uuid.uuid4())
        
        # PDF 파일 저장
        file_path = UPLOADS_DIR / f"{template_id}.pdf"
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # PDF 정보 추출
        pdf_info = pdf_service.extract_info(file_path)
        
        # 기본 템플릿 구조 생성
        template = {
            "template_id": template_id,
            "filename": file.filename,
            "page_size": pdf_info.get("page_size"),
            "pages": pdf_info.get("pages", []),
            "elements": [],
            "created_at": str(pdf_info.get("created_at", "")),
        }
        
        template_service.save_template(template_id, template)
        
        return {
            "template_id": template_id,
            "filename": file.filename,
            "page_count": pdf_info.get("page_count", 1),
            "page_size": pdf_info.get("page_size"),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ===== 템플릿 매핑 저장 =====
@app.put("/api/templates/{template_id}/mapping")
async def save_template_mapping(template_id: str, mapping: Dict[str, Any]):
    """템플릿 매핑 정보 저장"""
    try:
        template = template_service.get_template(template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        # 매핑 정보 업데이트
        template["elements"] = mapping.get("elements", [])
        template["pages"] = mapping.get("pages", template.get("pages", []))
        
        template_service.save_template(template_id, template)
        
        return {"status": "success", "template_id": template_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ===== 템플릿 조회 =====
@app.get("/api/templates/{template_id}")
async def get_template(template_id: str):
    """템플릿 정보 조회"""
    template = template_service.get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


# ===== 템플릿 목록 =====
@app.get("/api/templates")
async def list_templates():
    """템플릿 목록 조회"""
    templates = template_service.list_templates()
    return {"templates": templates}


# ===== PDF 미리보기 (이미지) =====
@app.get("/api/templates/{template_id}/preview")
async def preview_template(template_id: str, page: int = 1):
    """템플릿 페이지 미리보기 (이미지)"""
    try:
        pdf_path = UPLOADS_DIR / f"{template_id}.pdf"
        if not pdf_path.exists():
            # 빈 템플릿인 경우 빈 이미지 반환 (프론트엔드에서 처리)
            raise HTTPException(status_code=404, detail="PDF file not found")
        
        image_path = pdf_service.render_page_as_image(pdf_path, page - 1)
        
        return FileResponse(image_path, media_type="image/png")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ===== PDF 렌더링 =====
@app.post("/api/render/{template_id}")
async def render_pdf(template_id: str, data: Dict[str, Any]):
    """데이터를 넣어 완성된 PDF 생성"""
    try:
        # _elements가 제공되면 임시로 사용, 없으면 저장된 템플릿 사용
        elements_override = data.pop("_elements", None)
        
        if elements_override is not None:
            # 임시 템플릿 사용 (elements가 제공된 경우)
            template = template_service.get_template(template_id)
            if not template:
                raise HTTPException(status_code=404, detail="Template not found")
            
            # elements를 임시로 업데이트하여 렌더링
            temp_template = template.copy()
            temp_template["elements"] = elements_override
            output_path = await render_service.render_with_template(temp_template, data, template_id)
        else:
            # 저장된 템플릿 사용 (기존 방식)
            output_path = await render_service.render(template_id, data)
        
        return FileResponse(
            output_path,
            media_type="application/pdf",
            filename=f"rendered_{template_id}.pdf"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ===== 템플릿 삭제 =====
@app.delete("/api/templates/{template_id}")
async def delete_template(template_id: str):
    """템플릿 삭제"""
    try:
        template_service.delete_template(template_id)
        pdf_path = UPLOADS_DIR / f"{template_id}.pdf"
        if pdf_path.exists():
            pdf_path.unlink()
        
        # 미리보기 이미지도 삭제
        preview_dir = UPLOADS_DIR / "previews"
        if preview_dir.exists():
            for preview_file in preview_dir.glob(f"{template_id}_*.png"):
                preview_file.unlink()
        
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ===== 전체 템플릿 삭제 =====
@app.delete("/api/templates")
async def delete_all_templates():
    """모든 템플릿 삭제"""
    try:
        templates = template_service.list_templates()
        deleted_count = 0
        
        for template in templates:
            template_id = template.get("template_id")
            if template_id:
                try:
                    template_service.delete_template(template_id)
                    pdf_path = UPLOADS_DIR / f"{template_id}.pdf"
                    if pdf_path.exists():
                        pdf_path.unlink()
                    deleted_count += 1
                except:
                    pass
        
        # 미리보기 디렉토리 정리
        preview_dir = UPLOADS_DIR / "previews"
        if preview_dir.exists():
            for preview_file in preview_dir.glob("*.png"):
                preview_file.unlink()
        
        return {"status": "success", "deleted_count": deleted_count}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/")
async def root():
    return {"message": "PDF 템플릿 자동화 엔진 API", "version": "1.0.0"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
