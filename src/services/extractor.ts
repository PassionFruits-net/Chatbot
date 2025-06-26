import fs from 'fs/promises';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export async function extractText(filePath: string, mimeType: string): Promise<string> {
  const buffer = await fs.readFile(filePath);

  switch (mimeType) {
    case 'application/pdf':
      const pdfData = await pdf(buffer);
      return pdfData.text;

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      const docxResult = await mammoth.extractRawText({ buffer });
      return docxResult.value;

    case 'text/markdown':
      const mdContent = buffer.toString('utf-8');
      const processor = unified().use(remarkParse);
      const tree = processor.parse(mdContent);
      return extractTextFromMdTree(tree);

    case 'text/plain':
      return buffer.toString('utf-8');

    case 'text/url':
      const url = buffer.toString('utf-8').trim();
      return await extractFromUrl(url);

    default:
      throw new Error(`Unsupported mime type: ${mimeType}`);
  }
}

function extractTextFromMdTree(node: any): string {
  let text = '';
  
  if (node.type === 'text') {
    text += node.value;
  }
  
  if (node.children) {
    for (const child of node.children) {
      text += extractTextFromMdTree(child) + ' ';
    }
  }
  
  return text;
}

async function extractFromUrl(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; RAG-Lite/1.0; +https://github.com/your-repo)'
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Remove unwanted elements
  $('script, style, nav, header, footer, aside, .sidebar, .menu, .navigation, .ads, .advertisement').remove();
  
  // Try to extract main content first
  let text = '';
  const contentSelectors = [
    'main',
    '[role="main"]',
    '.content',
    '.main-content',
    '.article-body',
    '.post-content',
    '#content',
    '.mw-parser-output', // Wikipedia
    'article'
  ];
  
  for (const selector of contentSelectors) {
    const content = $(selector);
    if (content.length > 0) {
      text = content.text();
      break;
    }
  }
  
  // Fallback to body if no main content found
  if (!text) {
    text = $('body').text();
  }
  
  // Clean up the text
  text = text
    .replace(/\s+/g, ' ')           // Multiple whitespace to single space
    .replace(/\n\s*\n/g, '\n')      // Multiple newlines to single
    .replace(/\[edit\]/g, '')       // Remove Wikipedia edit links
    .trim();
  
  if (text.length < 100) {
    throw new Error('Extracted text is too short. The page might not contain readable content.');
  }
  
  return text;
}