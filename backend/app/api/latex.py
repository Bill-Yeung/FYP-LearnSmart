from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.latex_service import compile_latex_to_pdf, compile_latex_preview

router = APIRouter(prefix="/api/latex", tags=["latex"])

class LaTeXCompileRequest(BaseModel):
    latex_content: str

class LaTeXPreviewRequest(BaseModel):
    latex_math: str
    is_full_document: bool = False

@router.post("/compile")
async def compile_latex(request: LaTeXCompileRequest):

    if not request.latex_content.strip():
        raise HTTPException(status_code=400, detail="LaTeX content is required")
    
    result = await compile_latex_to_pdf(request.latex_content)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return {
        "success": True,
        "pdf_base64": result["pdf_base64"]
    }

@router.post("/preview")
async def preview_latex(request: LaTeXPreviewRequest):

    if not request.latex_math.strip():
        raise HTTPException(status_code=400, detail="LaTeX math code is required")
    
    result = await compile_latex_preview(request.latex_math, is_full_document=request.is_full_document)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Compilation failed"))
    
    return {
        "success": True,
        "image_base64": result.get("png_base64"),
        "format": result.get("format", "png")
    }
