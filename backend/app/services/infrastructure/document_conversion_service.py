import asyncio
import subprocess
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class DocumentConversionService:
  
    CONVERTIBLE_EXTENSIONS = {'.pptx', '.docx', '.xlsx', '.ppt', '.doc', '.xls', '.odp', '.odt', '.ods'}
    
    @staticmethod
    async def convert_to_pdf(input_path: str | Path, output_path: Optional[str | Path] = None) -> Optional[str]:
       
        input_path = Path(input_path)
        
        if input_path.suffix.lower() not in DocumentConversionService.CONVERTIBLE_EXTENSIONS:
            logger.debug(f"File {input_path.suffix} is not in convertible list, skipping conversion")
            return None
        
        if not input_path.exists():
            logger.error(f"Input file does not exist: {input_path}")
            return None
        
        if output_path is None:
            output_path = input_path.with_suffix('.pdf')
        else:
            output_path = Path(output_path)
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            cmd = [
                'libreoffice',
                '--headless',
                '--convert-to', 'pdf',
                '--outdir', str(output_path.parent),
                str(input_path),
            ]
            
            result = await asyncio.wait_for(
                asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                ),
                timeout=60.0
            )
            
            stdout, stderr = await result.communicate()
            
            if result.returncode != 0:
                logger.error(f"LibreOffice conversion failed: {stderr.decode()}")
                return None
            
            expected_pdf = output_path.parent / f"{input_path.stem}.pdf"
            
            if expected_pdf.exists():
                logger.info(f"Successfully converted {input_path} to {expected_pdf}")
                return str(expected_pdf)
            else:
                logger.error(f"Expected PDF not found at {expected_pdf} after LibreOffice conversion")
                return None
                
        except asyncio.TimeoutError:
            logger.error(f"LibreOffice conversion timeout for {input_path}")
            return None
        except Exception as e:
            logger.error(f"Error during document conversion: {e}")
            return None

# Global instance
document_conversion_service = DocumentConversionService()
