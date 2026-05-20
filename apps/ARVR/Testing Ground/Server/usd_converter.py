"""
USD to USDZ Conversion Service
Converts USD/USDC files to USDZ format for visionOS
"""
import requests
import zipfile
import tempfile
import os
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

def convert_usd_to_usdz(usd_url: str, output_path: str) -> bool:
    """
    Convert USD/USDC file to USDZ format
    
    USDZ is essentially a ZIP archive containing USD files
    This is a simple implementation that creates a valid USDZ
    
    Args:
        usd_url: URL to download USD/USDC file from
        output_path: Path where to save the USDZ file
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Create temporary directory
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)
            
            # Download USD file
            logger.info(f"Downloading USD from {usd_url}")
            response = requests.get(usd_url, timeout=60)
            response.raise_for_status()
            
            # Determine file extension from URL
            if usd_url.endswith('.usdc'):
                usd_filename = "model.usdc"
            elif usd_url.endswith('.usda'):
                usd_filename = "model.usda"
            else:
                usd_filename = "model.usd"
            
            # Save USD file to temp directory
            usd_path = tmpdir_path / usd_filename
            usd_path.write_bytes(response.content)
            logger.info(f"Saved USD file ({len(response.content)} bytes)")
            
            # Create USDZ (ZIP archive) from USD file
            logger.info(f"Creating USDZ archive at {output_path}")
            with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_STORED) as zf:
                # Add USD file to root of ZIP (required for USDZ)
                zf.write(usd_path, arcname=usd_filename)
                
            logger.info(f"USDZ created successfully ({os.path.getsize(output_path)} bytes)")
            return True
            
    except Exception as e:
        logger.error(f"Error converting USD to USDZ: {e}")
        return False

def download_and_convert_model(download_url: str, output_dir: str, model_id: str, resolution: str = "1k") -> dict:
    """
    Download a model and convert to visionOS-compatible format
    
    Args:
        download_url: URL to download the model
        output_dir: Directory to save converted file
        model_id: Unique identifier for the model
        resolution: Resolution of the model (1k, 2k, 4k, etc.)
        
    Returns:
        Dictionary with status and file path
    """
    try:
        os.makedirs(output_dir, exist_ok=True)
        
        # Determine output filename
        output_filename = f"{model_id}_{resolution}.usdz"
        output_path = os.path.join(output_dir, output_filename)
        
        # Check if already converted
        if os.path.exists(output_path):
            logger.info(f"USDZ already exists: {output_path}")
            return {
                "status": "success",
                "file_path": output_path,
                "cached": True
            }
        
        # Convert USD to USDZ
        if download_url.endswith(('.usd', '.usdc', '.usda')):
            success = convert_usd_to_usdz(download_url, output_path)
            
            if success:
                return {
                    "status": "success",
                    "file_path": output_path,
                    "cached": False
                }
            else:
                return {
                    "status": "error",
                    "message": "Conversion failed"
                }
        
        # For other formats, would need different conversion logic
        else:
            return {
                "status": "error",
                "message": f"Unsupported format: {download_url}"
            }
            
    except Exception as e:
        logger.error(f"Error in download_and_convert_model: {e}")
        return {
            "status": "error",
            "message": str(e)
        }
