#!/usr/bin/env python3
"""
Script to upload LifePower PDF resources to the remote chatbot server
"""

import os
import requests
import sys
from pathlib import Path

# Configuration
REMOTE_SERVER = "https://chat.passionfruits.net"
CUSTOMER_ID = "LifePower"
PDF_DIRECTORY = "/home/geir/Main/Dl"

# PDF files to upload
PDF_FILES = [
    "ExecFree ENG V3 BOOK View Final 26.6.24.pdf",
    "CCM USA V4 VIEW 1.3.22.pdf", 
    "LifePower English Book V7 VIEW 20.7.23.pdf",
    "Study Essentials USA VIEW 1.3.22.pdf"
]

# Authentication credentials
ADMIN_USERNAME = "PassionFruits"
ADMIN_PASSWORD = "WelcomeToOurCh4tbot"

def get_auth_token():
    """Get authentication token"""
    login_url = f"{REMOTE_SERVER}/api/auth/login"
    login_data = {
        "username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD
    }
    
    try:
        response = requests.post(login_url, json=login_data)
        if response.status_code == 200:
            return response.json().get('token')
        else:
            print(f"Failed to login: {response.status_code}")
            print(response.text)
            return None
    except Exception as e:
        print(f"Error during login: {e}")
        return None

def upload_pdf(token, pdf_path):
    """Upload a single PDF file"""
    upload_url = f"{REMOTE_SERVER}/api/resources/upload"
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    files = {
        'file': (os.path.basename(pdf_path), open(pdf_path, 'rb'), 'application/pdf')
    }
    
    data = {
        'customerId': CUSTOMER_ID
    }
    
    try:
        print(f"Uploading {os.path.basename(pdf_path)}...")
        response = requests.post(upload_url, headers=headers, files=files, data=data)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✓ Successfully uploaded {result['fileName']} with {result['chunks']} chunks")
            return True
        else:
            print(f"✗ Failed to upload {os.path.basename(pdf_path)}: {response.status_code}")
            print(response.text)
            return False
            
    except Exception as e:
        print(f"✗ Error uploading {os.path.basename(pdf_path)}: {e}")
        return False
    finally:
        files['file'][1].close()

def main():
    """Main upload function"""
    print(f"Starting upload of LifePower PDFs to {REMOTE_SERVER}")
    print(f"Customer ID: {CUSTOMER_ID}")
    print("-" * 50)
    
    # Get authentication token
    token = get_auth_token()
    if not token:
        print("Failed to get authentication token. Exiting.")
        sys.exit(1)
    
    print("✓ Successfully authenticated")
    print("-" * 50)
    
    # Upload each PDF
    successful_uploads = 0
    total_files = len(PDF_FILES)
    
    for pdf_file in PDF_FILES:
        pdf_path = os.path.join(PDF_DIRECTORY, pdf_file)
        
        if not os.path.exists(pdf_path):
            print(f"✗ File not found: {pdf_path}")
            continue
            
        if upload_pdf(token, pdf_path):
            successful_uploads += 1
    
    print("-" * 50)
    print(f"Upload complete: {successful_uploads}/{total_files} files uploaded successfully")
    
    if successful_uploads == total_files:
        print("✓ All files uploaded successfully!")
    else:
        print(f"⚠ {total_files - successful_uploads} files failed to upload")

if __name__ == "__main__":
    main()