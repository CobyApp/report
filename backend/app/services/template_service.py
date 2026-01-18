import json
from pathlib import Path
from typing import Dict, Any, List, Optional


class TemplateService:
    """Template save/load service"""
    
    def __init__(self, templates_dir: Path):
        self.templates_dir = templates_dir
        self.templates_dir.mkdir(parents=True, exist_ok=True)
    
    def save_template(self, template_id: str, template: Dict[str, Any]):
        """Save template JSON"""
        file_path = self.templates_dir / f"{template_id}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(template, f, ensure_ascii=False, indent=2)
    
    def get_template(self, template_id: str) -> Optional[Dict[str, Any]]:
        """Load template JSON"""
        file_path = self.templates_dir / f"{template_id}.json"
        if not file_path.exists():
            return None
        
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    
    def delete_template(self, template_id: str):
        """Delete template"""
        file_path = self.templates_dir / f"{template_id}.json"
        if file_path.exists():
            file_path.unlink()
    
    def list_templates(self, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Return template list (basic info only) - filter by user"""
        templates = []
        for file_path in self.templates_dir.glob("*.json"):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    template = json.load(f)
                    # If user_id is provided, return only that user's templates
                    if user_id and template.get("user_id") != user_id:
                        continue
                    templates.append({
                        "template_id": template.get("template_id"),
                        "filename": template.get("filename", ""),
                        "created_at": template.get("created_at", ""),
                        "element_count": len(template.get("elements", [])),
                    })
            except:
                pass
        return templates
