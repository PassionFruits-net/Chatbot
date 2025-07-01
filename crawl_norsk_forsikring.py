#!/usr/bin/env python3
"""
Website crawler for NorskForsikring to find and download all PDFs
"""

import requests
import urllib.parse
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
import time
import json
import os
import re
from collections import deque
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class NorskForsikringCrawler:
    def __init__(self, base_url="https://www.norskforsikring.no"):
        self.base_url = base_url
        self.domain = urlparse(base_url).netloc
        self.visited_pages = set()
        self.pdf_links = set()
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        
        # Create download directory
        self.download_dir = "/tmp/norsk_forsikring_pdfs"
        os.makedirs(self.download_dir, exist_ok=True)
    
    def is_valid_url(self, url):
        """Check if URL is valid and within scope"""
        parsed = urlparse(url)
        
        # Must be HTTP/HTTPS
        if parsed.scheme not in ['http', 'https']:
            return False
            
        # Must be on the same domain for page crawling
        if parsed.netloc != self.domain:
            return False
            
        # Skip common non-content URLs
        skip_patterns = [
            r'\.css$', r'\.js$', r'\.jpg$', r'\.jpeg$', r'\.png$', r'\.gif$',
            r'\.ico$', r'\.svg$', r'\.woff$', r'\.woff2$', r'\.ttf$',
            r'/wp-admin/', r'/wp-content/plugins/', r'/wp-content/themes/',
            r'#', r'mailto:', r'tel:', r'javascript:'
        ]
        
        for pattern in skip_patterns:
            if re.search(pattern, url, re.IGNORECASE):
                return False
                
        return True
    
    def is_pdf_link(self, url):
        """Check if URL points to a PDF"""
        return url.lower().endswith('.pdf') or 'pdf' in url.lower()
    
    def extract_links(self, url, html_content):
        """Extract all links from HTML content"""
        soup = BeautifulSoup(html_content, 'html.parser')
        links = []
        
        # Find all anchor tags with href
        for link in soup.find_all('a', href=True):
            href = link['href']
            absolute_url = urljoin(url, href)
            
            # Clean up the URL
            absolute_url = absolute_url.split('#')[0]  # Remove fragments
            
            if self.is_pdf_link(absolute_url):
                self.pdf_links.add(absolute_url)
                logger.info(f"Found PDF: {absolute_url}")
            elif self.is_valid_url(absolute_url):
                links.append(absolute_url)
        
        return links
    
    def crawl_page(self, url):
        """Crawl a single page and extract links"""
        if url in self.visited_pages:
            return []
        
        try:
            logger.info(f"Crawling: {url}")
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            
            self.visited_pages.add(url)
            
            # Only process HTML content
            content_type = response.headers.get('content-type', '').lower()
            if 'text/html' not in content_type:
                return []
            
            return self.extract_links(url, response.text)
            
        except Exception as e:
            logger.error(f"Error crawling {url}: {e}")
            return []
    
    def crawl_website(self, max_pages=500):
        """Crawl the entire website using BFS"""
        queue = deque([self.base_url])
        pages_crawled = 0
        
        while queue and pages_crawled < max_pages:
            url = queue.popleft()
            
            if url in self.visited_pages:
                continue
            
            new_links = self.crawl_page(url)
            pages_crawled += 1
            
            # Add new links to queue
            for link in new_links:
                if link not in self.visited_pages:
                    queue.append(link)
            
            # Be respectful - add delay
            time.sleep(0.5)
            
            if pages_crawled % 10 == 0:
                logger.info(f"Crawled {pages_crawled} pages, found {len(self.pdf_links)} PDFs")
        
        logger.info(f"Crawling complete. Visited {len(self.visited_pages)} pages, found {len(self.pdf_links)} PDFs")
    
    def download_pdfs(self):
        """Download all found PDFs"""
        downloaded = []
        
        for pdf_url in self.pdf_links:
            try:
                logger.info(f"Downloading: {pdf_url}")
                response = self.session.get(pdf_url, timeout=30)
                response.raise_for_status()
                
                # Generate filename
                parsed = urlparse(pdf_url)
                filename = os.path.basename(parsed.path)
                if not filename or not filename.endswith('.pdf'):
                    filename = f"document_{len(downloaded)}.pdf"
                
                # Save file
                filepath = os.path.join(self.download_dir, filename)
                
                # Handle duplicate filenames
                counter = 1
                original_filepath = filepath
                while os.path.exists(filepath):
                    name, ext = os.path.splitext(original_filepath)
                    filepath = f"{name}_{counter}{ext}"
                    counter += 1
                
                with open(filepath, 'wb') as f:
                    f.write(response.content)
                
                downloaded.append({
                    'url': pdf_url,
                    'filepath': filepath,
                    'filename': os.path.basename(filepath),
                    'size': len(response.content)
                })
                
                logger.info(f"Downloaded: {filename} ({len(response.content)} bytes)")
                time.sleep(0.5)  # Be respectful
                
            except Exception as e:
                logger.error(f"Error downloading {pdf_url}: {e}")
        
        return downloaded
    
    def save_results(self, downloaded_pdfs):
        """Save crawling results to JSON file"""
        results = {
            'base_url': self.base_url,
            'pages_visited': len(self.visited_pages),
            'pdf_links_found': len(self.pdf_links),
            'pdfs_downloaded': len(downloaded_pdfs),
            'pdf_links': list(self.pdf_links),
            'downloaded_pdfs': downloaded_pdfs,
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
        }
        
        results_file = os.path.join(self.download_dir, 'crawl_results.json')
        with open(results_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Results saved to: {results_file}")
        return results

def main():
    crawler = NorskForsikringCrawler()
    
    logger.info("Starting website crawl...")
    crawler.crawl_website(max_pages=200)  # Reasonable limit
    
    logger.info("Downloading PDFs...")
    downloaded_pdfs = crawler.download_pdfs()
    
    logger.info("Saving results...")
    results = crawler.save_results(downloaded_pdfs)
    
    print(f"\n=== CRAWL SUMMARY ===")
    print(f"Pages visited: {results['pages_visited']}")
    print(f"PDF links found: {results['pdf_links_found']}")
    print(f"PDFs downloaded: {results['pdfs_downloaded']}")
    print(f"Download directory: {crawler.download_dir}")
    
    if downloaded_pdfs:
        print(f"\nDownloaded PDFs:")
        for pdf in downloaded_pdfs:
            print(f"  - {pdf['filename']} ({pdf['size']} bytes)")

if __name__ == "__main__":
    main()