#!/usr/bin/env python3
"""
Upload downloaded PDFs to NorskForsikring customer resources
"""

import requests
import os
import json
import time
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class PDFUploader:
    def __init__(self, base_url="https://chat.passionfruits.net", auth_token=None):
        self.base_url = base_url
        self.auth_token = auth_token
        self.session = requests.Session()
        if auth_token:
            self.session.headers.update({
                'Authorization': f'Bearer {auth_token}'
            })
    
    def upload_pdf(self, customer_id, pdf_path):
        """Upload a single PDF to customer resources"""
        filename = os.path.basename(pdf_path)
        
        try:
            with open(pdf_path, 'rb') as f:
                files = {
                    'file': (filename, f, 'application/pdf')
                }
                data = {
                    'customerId': customer_id
                }
                
                logger.info(f"Uploading {filename}...")
                response = self.session.post(
                    f"{self.base_url}/api/resources/upload",
                    files=files,
                    data=data,
                    timeout=60
                )
                
                if response.status_code == 200:
                    result = response.json()
                    logger.info(f"✓ Uploaded {filename} successfully")
                    return result
                else:
                    logger.error(f"✗ Failed to upload {filename}: {response.status_code} - {response.text}")
                    return None
                    
        except Exception as e:
            logger.error(f"✗ Error uploading {filename}: {e}")
            return None
    
    def upload_all_pdfs(self, customer_id, pdf_directory):
        """Upload all PDFs in directory to customer"""
        if not os.path.exists(pdf_directory):
            logger.error(f"Directory not found: {pdf_directory}")
            return []
        
        pdf_files = [f for f in os.listdir(pdf_directory) if f.endswith('.pdf')]
        
        if not pdf_files:
            logger.error(f"No PDF files found in {pdf_directory}")
            return []
        
        logger.info(f"Found {len(pdf_files)} PDF files to upload")
        
        uploaded = []
        failed = []
        
        for i, pdf_file in enumerate(pdf_files, 1):
            pdf_path = os.path.join(pdf_directory, pdf_file)
            
            logger.info(f"[{i}/{len(pdf_files)}] Processing {pdf_file}")
            
            result = self.upload_pdf(customer_id, pdf_path)
            
            if result:
                uploaded.append({
                    'filename': pdf_file,
                    'result': result
                })
            else:
                failed.append(pdf_file)
            
            # Be respectful - add delay between uploads
            time.sleep(1)
        
        logger.info(f"\n=== UPLOAD SUMMARY ===")
        logger.info(f"Successfully uploaded: {len(uploaded)}")
        logger.info(f"Failed uploads: {len(failed)}")
        
        if failed:
            logger.error(f"Failed files: {', '.join(failed)}")
        
        return uploaded, failed

def main():
    # Configuration
    AUTH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IlBhc3Npb25GcnVpdHMiLCJpYXQiOjE3NTEyNzE4ODQsImV4cCI6MTc1MTM1ODI4NH0.gxs38Y1ZVr9Qd7A_GiC7h8w7S9nvw1D5_bqCBpDhbf8"
    CUSTOMER_ID = "NorskForsikring"
    PDF_DIRECTORY = "/tmp/norsk_forsikring_pdfs"
    
    uploader = PDFUploader(auth_token=AUTH_TOKEN)
    
    logger.info(f"Starting PDF upload for customer: {CUSTOMER_ID}")
    logger.info(f"PDF directory: {PDF_DIRECTORY}")
    
    uploaded, failed = uploader.upload_all_pdfs(CUSTOMER_ID, PDF_DIRECTORY)
    
    # Save upload results
    results = {
        'customer_id': CUSTOMER_ID,
        'total_files': len(uploaded) + len(failed),
        'uploaded_count': len(uploaded),
        'failed_count': len(failed),
        'uploaded_files': uploaded,
        'failed_files': failed,
        'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
    }
    
    results_file = os.path.join(PDF_DIRECTORY, 'upload_results.json')
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    logger.info(f"Upload results saved to: {results_file}")
    
    print(f"\n🎉 Upload complete!")
    print(f"📁 {len(uploaded)} PDFs successfully uploaded to {CUSTOMER_ID}")
    if failed:
        print(f"❌ {len(failed)} uploads failed")

if __name__ == "__main__":
    main()