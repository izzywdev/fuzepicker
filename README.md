# FuzePicker - AI DOM Element Assistant

[![GitHub license](https://img.shields.io/github/license/izzywdev/fuzepicker)](https://github.com/izzywdev/fuzepicker/blob/master/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/izzywdev/fuzepicker)](https://github.com/izzywdev/fuzepicker/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/izzywdev/fuzepicker)](https://github.com/izzywdev/fuzepicker/issues)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=google-chrome)](https://github.com/izzywdev/fuzepicker)
[![AI Powered](https://img.shields.io/badge/AI-Powered-green?logo=openai)](https://openai.com)

FuzePicker is a powerful Chrome extension that allows you to select DOM elements on any webpage and get AI-powered insights for development. Whether you need to discuss design choices, create Figma components, write Playwright tests, or implement React components, FuzePicker has you covered.

**🔗 Repository:** [https://github.com/izzywdev/fuzepicker](https://github.com/izzywdev/fuzepicker)

## 🌟 Features

### Chrome Extension
- **Element Picker**: Click to select any DOM element on any webpage
- **Shadow DOM Protection**: Isolates extension UI from host page CSS
- **Smart Highlighting**: Visual feedback with intelligent positioning
- **Comprehensive Element Analysis**: Extracts styles, attributes, selectors, and positioning data

### AI-Powered Actions
- **💬 Discuss Element**: Get UX/UI expert analysis and accessibility feedback
- **🎨 Create Figma**: Generate Figma component structures with Auto Layout
- **🧪 Write Playwright Test**: Create comprehensive test cases for the element
- **⚛️ Implement React**: Build modern React components with TypeScript and Tailwind

### Backend API
- **Element Management**: Store and retrieve DOM element data
- **Discussion System**: Comment threads with reactions and moderation
- **AI Processing**: OpenAI integration with structured data extraction
- **Analytics**: Track usage and AI output quality metrics

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- MongoDB (local or cloud)
- OpenAI API key (optional, has fallback responses)

### 1. Clone and Setup Backend

```bash
# Clone the repository
git clone https://github.com/izzywdev/fuzepicker.git
cd fuzepicker

# Install backend dependencies
cd backend
npm install

# Create environment file
cp .env.example .env

# Edit .env with your configuration
# Required: MONGODB_URI
# Optional: OPENAI_API_KEY, JWT_SECRET, PORT
```

### 2. Start the Backend Server

```bash
# From the backend directory
npm start

# For development with auto-reload
npm run dev
```

The server will start on `http://localhost:3000` (or your specified PORT).

### 3. Install Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the root project directory (containing `manifest.json`)
5. The FuzePicker extension should appear in your toolbar

### 4. Generate Icons (Optional)

```bash
# From the icons directory
node create_icons.cjs

# This creates SVG icons - convert to PNG for production use
```

## 📖 Usage Guide

### Using the Chrome Extension

1. **Navigate** to any webpage
2. **Click** the FuzePicker extension icon in your toolbar
3. **Select** an element by clicking on it (blue highlight will appear)
4. **Choose** an AI action from the floating toolbar:
   - 💬 **Discuss**: Get design and accessibility analysis
   - 🎨 **Figma**: Generate Figma component code
   - 🧪 **Playwright**: Create automated test scripts  
   - ⚛️ **React**: Build reusable React components

### Extension Popup Interface

The popup has three main tabs:

- **📋 Details**: View element information, styles, and selectors
- **💬 Discuss**: Add comments and view discussion threads
- **🤖 AI Tools**: Access AI actions and view generated outputs

## 🏗️ Project Structure

```
fuzepicker/
├── manifest.json              # Chrome extension manifest
├── content.js                 # Element picker and UI injection
├── content.css               # Minimal host page styles
├── background.js             # Service worker for API communication
├── popup.html               # Extension popup interface
├── popup.css               # Popup styling
├── popup.js               # Popup functionality
├── icons/                 # Extension icons
├── backend/              # Node.js API server
│   ├── server.js        # Express server setup
│   ├── package.json     # Backend dependencies
│   ├── models/         # MongoDB schemas
│   │   ├── Element.js
│   │   ├── Discussion.js
│   │   └── AiOutput.js
│   ├── routes/         # API endpoints
│   │   ├── elements.js
│   │   ├── discussions.js
│   │   ├── ai.js
│   │   └── auth.js
│   ├── middleware/     # Express middleware
│   │   ├── auth.js
│   │   └── errorHandler.js
│   └── services/      # Business logic
│       └── aiService.js
└── README.md         # This file
```

## 🔧 API Reference

### Base URL
`http://localhost:3000/api`

### Authentication
Most endpoints support optional authentication via JWT tokens:
```
Authorization: Bearer <token>
```

### Key Endpoints

#### Elements
- `GET /elements` - List elements with filtering
- `POST /elements` - Save new element data
- `GET /elements/:id` - Get specific element
- `PUT /elements/:id` - Update element
- `DELETE /elements/:id` - Delete element

#### AI Processing
- `POST /ai/process` - Process AI task for element
- `GET /ai/outputs/:id` - Get AI output details
- `POST /ai/feedback` - Submit feedback on AI output

#### Discussions
- `GET /discussions/element/:elementId` - Get element discussions
- `POST /discussions` - Create new discussion/comment
- `POST /discussions/:id/react` - Add reaction to comment

#### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `POST /auth/demo` - Create demo user
- `GET /auth/me` - Get current user info

## 🛠️ Development

### Backend Development

```bash
# Install dependencies
cd backend
npm install

# Start development server with auto-reload
npm run dev

# Run tests (if implemented)
npm test

# Check code style
npm run lint
```

### Extension Development

1. Make changes to extension files
2. Go to `chrome://extensions/`
3. Click the refresh button on the FuzePicker extension
4. Test changes on any webpage

### Environment Variables

Create `backend/.env` with:

```bash
# Required
MONGODB_URI=mongodb://localhost:27017/fuzepicker

# Optional
OPENAI_API_KEY=your-openai-api-key
JWT_SECRET=your-secret-key
PORT=3000
NODE_ENV=development
```

## 🤖 AI Integration

FuzePicker integrates with OpenAI's GPT models to provide intelligent analysis and code generation. The AI service supports:

- **Context-Aware Prompts**: Tailored prompts for each task type
- **Structured Data Extraction**: Parses AI responses into usable formats
- **Fallback Responses**: Works offline with mock responses
- **Quality Tracking**: Monitors AI output quality and user feedback

### Supported AI Tasks

1. **Discuss Element**
   - Accessibility analysis
   - Design system evaluation
   - Performance considerations
   - Improvement suggestions

2. **Create Figma Component**
   - Auto Layout structures
   - Design token integration
   - Component variants
   - Responsive constraints

3. **Write Playwright Test**
   - Element presence verification
   - Interaction testing
   - Accessibility checks
   - Cross-browser compatibility

4. **Implement React Component**
   - TypeScript interfaces
   - Tailwind CSS styling
   - Modern React patterns
   - Accessibility features

## 📊 Analytics & Monitoring

The backend tracks various metrics:

- Element selection patterns
- AI task usage statistics
- Processing performance
- User feedback scores
- Error rates and types

Access analytics via:
```bash
GET /api/elements/stats
GET /api/ai/metrics
```

## 🔒 Security Features

- **JWT Authentication**: Secure user sessions
- **Rate Limiting**: Prevents API abuse
- **Input Validation**: Joi schema validation
- **Error Handling**: Sanitized error responses
- **CORS Protection**: Configured for security
- **Helmet Middleware**: Additional security headers

## 🚀 Deployment

### Backend Deployment

1. **Environment Setup**
   ```bash
   NODE_ENV=production
   MONGODB_URI=your-production-db
   OPENAI_API_KEY=your-api-key
   JWT_SECRET=strong-random-secret
   ```

2. **Build and Start**
   ```bash
   npm install --production
   npm start
   ```

### Chrome Extension Publishing

1. Convert SVG icons to PNG format
2. Test extension thoroughly
3. Package extension as ZIP file
4. Submit to Chrome Web Store
5. Follow Chrome Web Store review process

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OpenAI for powerful AI capabilities
- Chrome Extensions API for browser integration
- MongoDB for flexible data storage
- Express.js for robust API framework

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/izzywdev/fuzepicker/issues)
- **Discussions**: [GitHub Discussions](https://github.com/izzywdev/fuzepicker/discussions)
- **Email**: support@fuzepicker.com

---

Made with ❤️ by the FuzePicker team 