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

app = FastAPI(title="PDF Template Automation Engine", version="1.0.0")

# CORS configuration (for frontend communication)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create directories
BASE_DIR = Path(__file__).parent.parent
TEMPLATES_DIR = BASE_DIR / "templates"
UPLOADS_DIR = BASE_DIR / "uploads"
IMAGES_DIR = BASE_DIR / "uploads" / "images"
USERS_DIR = BASE_DIR / "users"
TEMPLATES_DIR.mkdir(exist_ok=True)
UPLOADS_DIR.mkdir(exist_ok=True)
IMAGES_DIR.mkdir(exist_ok=True)
USERS_DIR.mkdir(exist_ok=True)

# Initialize services
pdf_service = PDFService()
template_service = TemplateService(TEMPLATES_DIR)
render_service = RenderService(TEMPLATES_DIR, UPLOADS_DIR)
auth_service = AuthService(USERS_DIR)

# Static file serving (uploaded images)
app.mount("/api/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


# ===== Authentication Pydantic Models =====
class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


# ===== Authentication Helper Functions =====
from fastapi import Depends, Header
from typing import Optional

async def get_current_user(authorization: Optional[str] = Header(None)) -> Optional[Dict]:
    """Extract current user information from JWT token"""
    if not authorization:
        return None
    
    try:
        # Extract token from "Bearer <token>" format
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
    """Use for endpoints that require authentication"""
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


# ===== User Registration =====
@app.post("/api/auth/register")
async def register(request: RegisterRequest):
    """User registration"""
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


# ===== User Login =====
@app.post("/api/auth/login")
async def login(request: LoginRequest):
    """User login"""
    user = auth_service.authenticate_user(request.username, request.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Create JWT token
    token_data = {"sub": user["username"]}
    access_token = auth_service.create_access_token(token_data)
    
    return {
        "status": "success",
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


# ===== Get Current User Info =====
@app.get("/api/auth/me")
async def get_current_user_info(current_user: Dict = Depends(require_auth)):
    """Get current logged-in user information"""
    return current_user


# ===== Template Upload =====
@app.post("/api/templates")
async def upload_template(file: UploadFile = File(...), current_user: Dict = Depends(require_auth)):
    """Upload PDF template (authentication required)"""
    try:
        template_id = str(uuid.uuid4())
        
        # Save PDF file
        file_path = UPLOADS_DIR / f"{template_id}.pdf"
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Extract PDF information
        pdf_info = pdf_service.extract_info(file_path)
        
        # Create basic template structure (including user_id)
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


# ===== Save Template Mapping =====
@app.put("/api/templates/{template_id}/mapping")
async def save_template_mapping(template_id: str, mapping: Dict[str, Any], current_user: Dict = Depends(require_auth)):
    """Save template mapping information (authentication required)"""
    try:
        template = template_service.get_template(template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        # Verify user ownership
        if template.get("user_id") != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Update mapping information
        template["elements"] = mapping.get("elements", [])
        template["pages"] = mapping.get("pages", template.get("pages", []))
        
        template_service.save_template(template_id, template)
        
        return {"status": "success", "template_id": template_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ===== Get Template =====
@app.get("/api/templates/{template_id}")
async def get_template(template_id: str, current_user: Dict = Depends(require_auth)):
    """Get template information (authentication required)"""
    template = template_service.get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Verify user ownership
    if template.get("user_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return template


# ===== List Templates =====
@app.get("/api/templates")
async def list_templates(current_user: Dict = Depends(require_auth)):
    """List templates (authentication required, only current user's templates)"""
    templates = template_service.list_templates(user_id=current_user["user_id"])
    return {"templates": templates}


# ===== PDF Preview (Image) =====
@app.get("/api/templates/{template_id}/preview")
async def preview_template(template_id: str, page: int = 1, current_user: Dict = Depends(require_auth)):
    """Template page preview (image) (authentication required)"""
    try:
        # Verify template ownership
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


# ===== PDF Rendering =====
@app.post("/api/render/{template_id}")
async def render_pdf(template_id: str, data: Dict[str, Any], current_user: Dict = Depends(require_auth)):
    """Generate completed PDF with data (authentication required)"""
    try:
        # Verify template ownership
        template = template_service.get_template(template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        if template.get("user_id") != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Use _elements if provided, otherwise use saved template
        elements_override = data.pop("_elements", None)
        
        if elements_override is not None:
            # Use temporary template (when elements are provided)
            # Temporarily update elements for rendering
            temp_template = template.copy()
            temp_template["elements"] = elements_override
            output_path = await render_service.render_with_template(temp_template, data, template_id)
        else:
            # Use saved template (existing method)
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


# ===== Delete Template =====
@app.delete("/api/templates/{template_id}")
async def delete_template(template_id: str, current_user: Dict = Depends(require_auth)):
    """Delete template (authentication required)"""
    try:
        template = template_service.get_template(template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        # Verify user ownership
        if template.get("user_id") != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        template_service.delete_template(template_id)
        pdf_path = UPLOADS_DIR / f"{template_id}.pdf"
        if pdf_path.exists():
            pdf_path.unlink()
        
        # Also delete preview images
        preview_dir = UPLOADS_DIR / "previews"
        if preview_dir.exists():
            for preview_file in preview_dir.glob(f"{template_id}_*.png"):
                preview_file.unlink()
        
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ===== Delete All Templates =====
@app.delete("/api/templates")
async def delete_all_templates(current_user: Dict = Depends(require_auth)):
    """Delete all templates of current user (authentication required)"""
    try:
        # Get only current user's templates
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
        
        # Clean up preview directory (only current user's templates)
        preview_dir = UPLOADS_DIR / "previews"
        if preview_dir.exists():
            # Delete preview files based on template ID list
            for template in templates:
                template_id = template.get("template_id")
                if template_id:
                    for preview_file in preview_dir.glob(f"{template_id}_*.png"):
                        preview_file.unlink()
        
        return {"status": "success", "deleted_count": deleted_count}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ===== Image Upload =====
@app.post("/api/images")
async def upload_image(file: UploadFile = File(...), current_user: Dict = Depends(require_auth)):
    """Upload stamp/signature image (authentication required)"""
    try:
        # Only allow image files
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="Image files only")
        
        image_id = str(uuid.uuid4())
        # Preserve original extension
        ext = Path(file.filename).suffix if file.filename else '.png'
        image_path = IMAGES_DIR / f"{image_id}{ext}"
        
        with open(image_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Return relative path (uploads/images/image_id.ext)
        relative_path = f"images/{image_id}{ext}"
        
        return {"image_path": relative_path, "image_id": image_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/")
async def root():
    return {"message": "PDF Template Automation Engine API", "version": "1.0.0"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
