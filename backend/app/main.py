from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
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
from app.services.auth_service import AuthService

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
IMAGES_DIR = BASE_DIR / "uploads" / "images"
USERS_DIR = BASE_DIR / "users"
TEMPLATES_DIR.mkdir(exist_ok=True)
UPLOADS_DIR.mkdir(exist_ok=True)
IMAGES_DIR.mkdir(exist_ok=True)
USERS_DIR.mkdir(exist_ok=True)

# 서비스 초기화
pdf_service = PDFService()
template_service = TemplateService(TEMPLATES_DIR)
render_service = RenderService(TEMPLATES_DIR, UPLOADS_DIR)
auth_service = AuthService(USERS_DIR)

# 정적 파일 서빙 (업로드된 이미지)
app.mount("/api/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


# ===== 인증 관련 Pydantic 모델 =====
class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


# ===== 인증 헬퍼 함수 =====
from fastapi import Depends, Header
from typing import Optional

async def get_current_user(authorization: Optional[str] = Header(None)) -> Optional[Dict]:
    """JWT 토큰에서 현재 사용자 정보 추출"""
    if not authorization:
        return None
    
    try:
        # "Bearer <token>" 형식에서 토큰 추출
        token = authorization.replace("Bearer ", "")
        payload = auth_service.verify_token(token)
        if payload:
            username = payload.get("sub")
            if username:
                user_data = auth_service.get_user(username)
                if user_data:
                    return {
                        "user_id": user_data["user_id"],
                        "username": user_data["username"],
                        "email": user_data["email"],
                    }
    except:
        pass
    return None


async def require_auth(authorization: Optional[str] = Header(None)) -> Dict:
    """인증이 필요한 엔드포인트에서 사용"""
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


# ===== 회원가입 =====
@app.post("/api/auth/register")
async def register(request: RegisterRequest):
    """사용자 회원가입"""
    try:
        user = auth_service.register_user(
            username=request.username,
            email=request.email,
            password=request.password
        )
        return {"status": "success", "user": user}
    except ValueError as e:
        import traceback
        print(f"ValueError in register: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        print(f"Exception in register: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=400, detail=str(e))


# ===== 로그인 =====
@app.post("/api/auth/login")
async def login(request: LoginRequest):
    """사용자 로그인"""
    user = auth_service.authenticate_user(request.username, request.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # JWT 토큰 생성
    token_data = {"sub": user["username"]}
    access_token = auth_service.create_access_token(token_data)
    
    return {
        "status": "success",
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


# ===== 사용자 정보 조회 =====
@app.get("/api/auth/me")
async def get_current_user_info(current_user: Dict = Depends(require_auth)):
    """현재 로그인한 사용자 정보 조회"""
    return current_user


# ===== 템플릿 업로드 =====
@app.post("/api/templates")
async def upload_template(file: UploadFile = File(...), current_user: Dict = Depends(require_auth)):
    """PDF 템플릿 업로드 (인증 필요)"""
    try:
        template_id = str(uuid.uuid4())
        
        # PDF 파일 저장
        file_path = UPLOADS_DIR / f"{template_id}.pdf"
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # PDF 정보 추출
        pdf_info = pdf_service.extract_info(file_path)
        
        # 기본 템플릿 구조 생성 (user_id 포함)
        template = {
            "template_id": template_id,
            "user_id": current_user["user_id"],
            "username": current_user["username"],
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
async def save_template_mapping(template_id: str, mapping: Dict[str, Any], current_user: Dict = Depends(require_auth)):
    """템플릿 매핑 정보 저장 (인증 필요)"""
    try:
        template = template_service.get_template(template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        # 사용자 소유권 확인
        if template.get("user_id") != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # 매핑 정보 업데이트
        template["elements"] = mapping.get("elements", [])
        template["pages"] = mapping.get("pages", template.get("pages", []))
        
        template_service.save_template(template_id, template)
        
        return {"status": "success", "template_id": template_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ===== 템플릿 조회 =====
@app.get("/api/templates/{template_id}")
async def get_template(template_id: str, current_user: Dict = Depends(require_auth)):
    """템플릿 정보 조회 (인증 필요)"""
    template = template_service.get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # 사용자 소유권 확인
    if template.get("user_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return template


# ===== 템플릿 목록 =====
@app.get("/api/templates")
async def list_templates(current_user: Dict = Depends(require_auth)):
    """템플릿 목록 조회 (인증 필요, 현재 사용자의 템플릿만)"""
    templates = template_service.list_templates(user_id=current_user["user_id"])
    return {"templates": templates}


# ===== PDF 미리보기 (이미지) =====
@app.get("/api/templates/{template_id}/preview")
async def preview_template(template_id: str, page: int = 1, current_user: Dict = Depends(require_auth)):
    """템플릿 페이지 미리보기 (이미지) (인증 필요)"""
    try:
        # 템플릿 소유권 확인
        template = template_service.get_template(template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        if template.get("user_id") != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        pdf_path = UPLOADS_DIR / f"{template_id}.pdf"
        if not pdf_path.exists():
            raise HTTPException(status_code=404, detail="PDF file not found")
        
        image_path = pdf_service.render_page_as_image(pdf_path, page - 1)
        
        return FileResponse(image_path, media_type="image/png")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ===== PDF 렌더링 =====
@app.post("/api/render/{template_id}")
async def render_pdf(template_id: str, data: Dict[str, Any], current_user: Dict = Depends(require_auth)):
    """데이터를 넣어 완성된 PDF 생성 (인증 필요)"""
    try:
        # 템플릿 소유권 확인
        template = template_service.get_template(template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        if template.get("user_id") != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # _elements가 제공되면 임시로 사용, 없으면 저장된 템플릿 사용
        elements_override = data.pop("_elements", None)
        
        if elements_override is not None:
            # 임시 템플릿 사용 (elements가 제공된 경우)
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ===== 템플릿 삭제 =====
@app.delete("/api/templates/{template_id}")
async def delete_template(template_id: str, current_user: Dict = Depends(require_auth)):
    """템플릿 삭제 (인증 필요)"""
    try:
        template = template_service.get_template(template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        # 사용자 소유권 확인
        if template.get("user_id") != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ===== 전체 템플릿 삭제 =====
@app.delete("/api/templates")
async def delete_all_templates(current_user: Dict = Depends(require_auth)):
    """현재 사용자의 모든 템플릿 삭제 (인증 필요)"""
    try:
        # 현재 사용자의 템플릿만 조회
        templates = template_service.list_templates(user_id=current_user["user_id"])
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
        
        # 미리보기 디렉토리 정리 (현재 사용자의 템플릿만)
        preview_dir = UPLOADS_DIR / "previews"
        if preview_dir.exists():
            # 템플릿 ID 목록을 기반으로 미리보기 파일 삭제
            for template in templates:
                template_id = template.get("template_id")
                if template_id:
                    for preview_file in preview_dir.glob(f"{template_id}_*.png"):
                        preview_file.unlink()
        
        return {"status": "success", "deleted_count": deleted_count}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ===== 이미지 업로드 =====
@app.post("/api/images")
async def upload_image(file: UploadFile = File(...), current_user: Dict = Depends(require_auth)):
    """도장/서명 이미지 업로드 (인증 필요)"""
    try:
        # 이미지 파일만 허용
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="Image files only")
        
        image_id = str(uuid.uuid4())
        # 원본 확장자 유지
        ext = Path(file.filename).suffix if file.filename else '.png'
        image_path = IMAGES_DIR / f"{image_id}{ext}"
        
        with open(image_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # 상대 경로 반환 (uploads/images/image_id.ext)
        relative_path = f"images/{image_id}{ext}"
        
        return {"image_path": relative_path, "image_id": image_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/")
async def root():
    return {"message": "PDF 템플릿 자동화 엔진 API", "version": "1.0.0"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
