# 🫐 Passion Fruits Chatbot

A powerful, customer-scoped RAG (Retrieval-Augmented Generation) chatbot system that allows businesses to create intelligent customer support bots using their own documents and data. Built with TypeScript, Express, and OpenAI API.

## ✨ Features

### 🎯 **Customer-Scoped Intelligence**
- **Multi-tenant support**: Separate knowledge bases for each customer
- **Document upload**: PDF, DOCX, TXT, and Markdown file support
- **Web scraping**: Extract knowledge from customer websites
- **Vector similarity search**: Intelligent document retrieval using embeddings

### 🤖 **Advanced AI Capabilities**
- **Dual response modes**: 
  - 📚 **Document-only mode**: Responses strictly from uploaded content
  - 🌐 **General AI mode**: Enhanced responses using AI's general knowledge + documents
- **Streaming responses**: Real-time chat experience
- **Cost tracking**: Monitor OpenAI API usage and costs
- **Source attribution**: Clear citations for all responses

### 🎨 **Beautiful Admin Interface**
- **Dashboard**: Customer overview, analytics, and management
- **Test Chat**: Interactive testing with dual AI modes
- **Resource Management**: Easy document upload and web scraping
- **Documentation**: Comprehensive setup and integration guides
- **Settings**: API key configuration and system settings

### 📊 **Analytics & Monitoring**
- **Usage tracking**: Monitor chat volume and API costs
- **Customer analytics**: Per-customer usage insights
- **Cost estimation**: Real-time OpenAI API cost tracking
- **Source metrics**: Document retrieval performance

### 🔧 **Easy Integration**
- **Embeddable widget**: One-line JavaScript integration
- **Customizable styling**: Match your brand colors and design
- **REST API**: Full programmatic access
- **JWT authentication**: Secure admin access

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- OpenAI API key
- (Optional) Bing Search API key for enhanced search

### Installation

1. **Clone and install dependencies:**
```bash
git clone https://github.com/PassionFruits-net/Chatbot.git
cd Chatbot
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env and add your OpenAI API key:
# OPENAI_API_KEY=your_openai_api_key_here
```

3. **Start development server:**
```bash
npm run dev
```

4. **Access the admin interface:**
   - Open http://localhost:3000/admin
   - Configure your OpenAI API key in Settings
   - Create your first customer
   - Upload documents or scrape websites

5. **Test the chatbot:**
   - Go to Test Chat tab
   - Select your customer
   - Try both document-only and general AI modes

## 📋 Usage Guide

### Setting Up Your First Customer

1. **Admin Setup:**
   - Navigate to the admin interface
   - Go to Settings tab and add your OpenAI API key
   - Switch to Customers tab and create a customer ID

2. **Add Knowledge:**
   - Go to Resources tab
   - Upload documents (PDF, DOCX, TXT, MD)
   - Or scrape web pages for automatic content extraction

3. **Test & Deploy:**
   - Use Test Chat to verify responses
   - Toggle between document-only and general AI modes
   - Copy the widget code from Documentation tab

### Embedding the Widget

Add this single line to your website:

```html
<script src="http://your-domain.com/widget.js" data-customer="your-customer-id"></script>
```

**Widget Customization:**
```html
<script 
  src="http://your-domain.com/widget.js" 
  data-customer="your-customer-id"
  data-title="Ask us anything!"
  data-placeholder="Type your question..."
  data-theme-color="#a855f7">
</script>
```

### API Usage

**Send Chat Message:**
```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    customerId: 'your-customer-id',
    message: 'What are your hours?',
    includeGeneralAI: true  // Optional: enable general knowledge
  })
});
```

**Upload Document:**
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('customerId', 'your-customer-id');

await fetch('/api/upload', {
  method: 'POST',
  body: formData
});
```

## 🏗️ Architecture

### Core Components

- **Frontend**: HTML/CSS/JavaScript with HTMX and Tailwind CSS
- **Backend**: TypeScript + Express.js
- **Database**: SQLite for development, easily configurable for production
- **AI Service**: OpenAI GPT-4o-mini for chat completions
- **Vector Search**: OpenAI text-embedding-3-small for document retrieval
- **File Processing**: Supports multiple document formats with text extraction

### Project Structure

```
├── src/
│   ├── routes/          # API endpoints
│   ├── services/        # Core business logic
│   ├── database/        # Database schema and migrations
│   └── index.ts         # Application entry point
├── public/
│   ├── admin/          # Admin interface files
│   ├── widget.js       # Embeddable chat widget
│   └── styles.css      # Compiled CSS
├── dist/               # Compiled JavaScript
└── uploads/            # Uploaded documents
```

## 🔧 Configuration

### Environment Variables

```bash
# Required
OPENAI_API_KEY=your_openai_api_key_here

# Optional
BING_SEARCH_KEY=your_bing_search_key_here  # For enhanced search
JWT_SECRET=your_jwt_secret_here            # Default generated
PORT=3000                                  # Default port
```

### Database Configuration

The system uses SQLite by default for easy setup. For production, configure your preferred database in `src/database/connection.ts`.

## 🚀 Deployment

### Production Build

```bash
npm run build
npm start
```

### Docker Deployment

```bash
docker-compose up
```

### Manual Server Deployment

1. **Build the application:**
```bash
npm run build
```

2. **Transfer files to server:**
```bash
# Copy dist/ and public/ directories
# Copy package.json and package-lock.json
# Copy .env with production values
```

3. **Install and start:**
```bash
npm ci --production
npm start
```

4. **Configure reverse proxy (nginx example):**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 📖 API Reference

### Chat Endpoints

**POST /api/chat**
- Stream chat responses
- Body: `{ customerId, message, includeGeneralAI? }`
- Returns: Server-sent events stream

**GET /api/customers/overview**
- Get customer analytics
- Returns: Customer statistics and usage data

### Resource Management

**POST /api/upload**
- Upload documents
- Form data: `file`, `customerId`
- Supports: PDF, DOCX, TXT, MD

**POST /api/scrape**
- Scrape web content
- Body: `{ url, customerId }`
- Extracts and processes web page content

### Admin Endpoints

**POST /api/auth/login**
- Admin authentication
- Body: `{ username, password }`
- Returns: JWT token

## 🛠️ Development

### Available Scripts

```bash
npm run dev          # Development server with hot reload
npm run build        # Production build
npm start           # Production server
npm run seed        # Populate with sample data
```

### Development Workflow

1. **Make changes** to source files in `src/`
2. **Test locally** using the Test Chat interface
3. **Build for production** with `npm run build`
4. **Deploy** to your server

### Adding New Features

The system is designed to be easily extensible:

- **New file types**: Add processors in `src/services/extractor.ts`
- **Custom AI prompts**: Modify `src/services/openai.ts`
- **Additional APIs**: Create new routes in `src/routes/`
- **UI enhancements**: Edit files in `public/admin/`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the built-in Documentation tab
- **Issues**: [GitHub Issues](https://github.com/PassionFruits-net/Chatbot/issues)
- **Discussions**: [GitHub Discussions](https://github.com/PassionFruits-net/Chatbot/discussions)

## 🎯 Roadmap

- [ ] Multi-language support
- [ ] Advanced analytics dashboard
- [ ] Integration with popular CMS platforms
- [ ] Voice chat capabilities
- [ ] Enterprise SSO integration
- [ ] Advanced customization options

---

**Built with 🫐 by Passion Fruits** | [Website](https://passion-fruits.net) | [Demo](https://demo.passion-fruits.net)