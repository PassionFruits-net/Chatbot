# 🍓 Passion Fruits Chatbot

A lightweight, customer-scoped RAG chatbot powered by OpenAI API with beautiful UI and comprehensive analytics.

## Quick Start

1. Clone and install dependencies:
```bash
cd rag-lite
npm install
```

2. Copy `.env.example` to `.env` and add your OpenAI API key:
```bash
cp .env.example .env
```

3. Run the development server:
```bash
npm run dev
```

4. Access the admin UI at http://localhost:3000/admin

5. Embed the Passion Fruits chat widget:
```html
<script src="http://localhost:3000/widget.js" data-customer="your-customer-id"></script>
```

6. (Optional) Run seed data:
```bash
npm run seed
```

7. (Optional) Run with Docker:
```bash
docker-compose up
```