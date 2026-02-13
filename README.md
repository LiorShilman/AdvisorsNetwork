# 🏦 Advisor Network - Multi-Agent Financial Advisory System

<div dir="rtl">

**רשת יועצים פיננסיים חכמים** - מערכת ייעוץ פיננסי מבוססת בינה מלאכותית עם 18 יועצים מתמחים

</div>

A sophisticated Hebrew RTL financial advisory application powered by multi-agent AI orchestration. Built with Angular 18 (standalone components), Node.js/Express, and MongoDB, featuring 18 specialized AI advisors working collaboratively through GPT-4o.

## ✨ Key Features

- 🤖 **Multi-Agent AI System**: 18 specialized financial advisors with intelligent routing and context handoff
- 💬 **Real-time Chat Interface**: Interactive conversation with markdown, LaTeX, and code highlighting support
- 📊 **MAPAL Scoring**: Financial impact assessment across 5 dimensions (מיקוד, אכיפה, פאזות, איזון, לחץ)
- 🔄 **Dynamic Advisor Switching**: Seamless transitions between advisors with preserved context
- 📝 **Conversation History**: Full persistence with MongoDB, including edit and delete capabilities
- 🎨 **Modern RTL UI**: Tailwind CSS 3 with dark theme, fully optimized for Hebrew right-to-left layout
- 🚀 **Production Ready**: PM2 process management, IIS deployment, environment-based configuration

## 🏗️ Architecture

### Multi-Agent Orchestration

**Core Innovation**: Single LLM call per message with structured function calling for routing and context handoff.

```
User Message → Current Advisor → Structured Response:
{
  text: "Response in Hebrew",
  advisorId: "current_advisor",
  mapalImpact: "HIGH",
  nextAdvisor?: {
    advisorId: "next_advisor",
    reason: "Why switching",
    handoffText: "Message to user"
  },
  handoffSummary?: "Context for next advisor"
}
```

**Key Optimization**: Reduced from 3 LLM calls to 1 per message while maintaining context quality.

### The 18 Advisors

| Advisor | Role | Specialization |
|---------|------|----------------|
| 🎯 אופק (strategy) | Orchestrator | Manages conversation flow and routes to specialists |
| 💰 רון (budget) | Budget & Cashflow | Family budget, expenses, short-term savings |
| 🏠 גיא (mortgage) | Real Estate | Mortgages, property purchases, refinancing |
| 📈 דנה (investments) | Investments | Stocks, bonds, funds, asset allocation |
| 🎓 יעל (pension) | Retirement | Pension planning, post-retirement income |
| 🛡️ ענת (risk) | Insurance | Life, health, disability coverage |
| 🧠 ליאור (behavior) | Behavioral Finance | Financial habits and psychology |
| 💼 עידו (selfemployed) | Self-Employed | Business finances, taxes, irregular income |
| 🌟 אלינור (special) | Special Situations | Divorce, crises, complex scenarios |
| 📊 תום (data) | Data Analysis | Financial data insights and predictions |
| 🚀 נועם (career) | Career Growth | Professional development and income growth |
| ✨ אמיר (meaning) | Quality of Life | Life satisfaction and financial wellbeing |
| 🌈 הדס (abundance) | Abundance Mindset | Money beliefs and limiting patterns |
| 🎮 טל (young) | Gen Z | Financial planning for ages 18-30 |
| 🔮 יואב (altinvest) | Alternative Investing | Crypto, startups, emerging markets |
| 👨‍👩‍👧‍👦 מיכל (intergen) | Intergenerational | Wealth transfer, inheritance planning |
| 🏖️ נועה (altretire) | Alternative Retirement | Non-traditional retirement models |
| ⏳ העצמי העתידי (futureself) | Future Self | Perspective from your future self |

## 🛠️ Tech Stack

### Frontend
- **Angular 18** (standalone components, no NgModules)
- **Tailwind CSS 3** - Utility-first styling with dark theme
- **ngx-markdown** - Markdown rendering with KaTeX for LaTeX math
- **Prism.js** - Code syntax highlighting (Okaidia theme)
- **TypeScript** - Strict mode, ES2022

### Backend
- **Node.js** + **Express** - REST API server
- **MongoDB** - Conversation and message persistence
- **LangChain** - AI orchestration and function calling
- **OpenAI GPT-4o** - Multi-agent advisor responses
- **Winston** - Structured logging
- **PM2** - Production process management

## 📦 Installation

### Prerequisites

- Node.js 18+ and npm
- MongoDB 7.0+ (local or Atlas)
- OpenAI API key
- PM2 (for production): `npm install -g pm2`

### Clone Repository

```bash
git clone https://github.com/LiorShilman/AdvisorsNetwork.git
cd AdvisorsNetwork
```

### Frontend Setup

```bash
npm install
npm start  # Development server on http://localhost:4200
```

### Backend Setup

```bash
cd src/server
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
npm install
npm start  # Production mode on port 21500
# OR
npm run dev  # Development mode on port 9292
```

### MongoDB Setup

**Option 1: Local MongoDB with Docker**
```bash
docker run -d --name mongodb-advisor -p 27017:27017 -v mongodb_data:/data/db mongo:7.0
```

**Option 2: MongoDB Atlas**
Update `MONGODB_URI` in `.env` with your Atlas connection string.

## 🚀 Deployment

### Production Build

```bash
# Frontend
npm run build  # Outputs to dist/advisor-network/browser/

# Backend - already configured in .env
cd src/server
pm2 start ecosystem.config.js --env production
pm2 save
```

### IIS Configuration (Frontend)

1. Physical Path: `E:\path\to\dist\advisor-network\browser`
2. Base URL: `/AdvisorsNetwork/` (configured in `angular.json`)
3. URL Rewrite: Uses `web.config` for SPA routing

### PM2 Commands

```bash
pm2 status                          # View all processes
pm2 logs advisor-network-api        # View logs
pm2 restart advisor-network-api     # Restart server
pm2 stop advisor-network-api        # Stop server
pm2 monit                           # Real-time monitoring
```

## 📁 Project Structure

```
advisor-network/
├── src/
│   ├── app/
│   │   ├── features/
│   │   │   ├── conversation/         # Main chat interface
│   │   │   ├── conversation-list/    # History & management
│   │   │   ├── advisor-message/      # Advisor chat bubbles
│   │   │   └── user-message/         # User chat bubbles
│   │   ├── services/
│   │   │   ├── advisor.service.ts    # API communication
│   │   │   └── chat-session.service.ts  # State management
│   │   ├── models/                   # TypeScript interfaces
│   │   └── environments/             # Dev/prod configs
│   ├── server/
│   │   ├── configs/
│   │   │   ├── advisor-ids.js        # ⭐ Single source of truth for advisor IDs
│   │   │   ├── advisors-system.js    # Advisor definitions & prompts
│   │   │   └── db.js                 # MongoDB connection
│   │   ├── src/
│   │   │   ├── ai-orchestrator/
│   │   │   │   └── advisorNetworkSystem.js  # ⭐ Core multi-agent logic
│   │   │   ├── controllers/          # Express route handlers
│   │   │   ├── models/               # Mongoose schemas
│   │   │   └── utils/                # MAPAL scoring, helpers
│   │   ├── ecosystem.config.js       # PM2 configuration
│   │   └── server.js                 # Express app entry point
│   └── web.config                    # IIS URL rewriting for SPA
├── public/                           # Advisor avatars (18 PNGs)
├── .gitignore                        # ⚠️ Excludes .env (contains API keys!)
└── README.md
```

## 🔑 Environment Variables

Copy `src/server/.env.example` to `src/server/.env` and configure:

```env
PORT=21500                            # Backend server port
NODE_ENV=production                   # development | production
MONGODB_URI=mongodb://localhost:27017/financial-advisors-360
OPENAI_API_KEY=sk-proj-...           # ⚠️ Required - get from OpenAI
MODEL_NAME=gpt-4o
TEMPERATURE=0.6
```

**⚠️ IMPORTANT**: Never commit the `.env` file to Git! It contains your API key.

## 🧪 Development

### Frontend Development

```bash
npm start  # http://localhost:4200
```

API calls route to `http://localhost:9292` (development) or production server.

### Backend Development

```bash
cd src/server
npm run dev  # Runs with nodemon (auto-restart on file changes)
```

### Common Commands

```bash
# Frontend
npm run build              # Production build
npm run watch              # Dev build with file watching
npm test                   # Run tests

# Backend
npm start                  # Production mode
npm run dev                # Development mode with nodemon
```

## 📊 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/conversations` | Send message to current advisor |
| POST | `/api/conversations/create` | Create new conversation |
| GET | `/api/conversations/:id` | Get conversation by ID |
| GET | `/api/conversations?userId=` | List user's conversations |
| DELETE | `/api/conversations/:id` | Delete conversation |
| PATCH | `/api/conversations/:id` | Update conversation title |
| POST | `/messages/edit` | Edit message (re-processes from that point) |
| DELETE | `/api/conversations/:id/message/:messageId` | Delete message |
| GET | `/api/advisors` | Get all advisor metadata |

## 🔬 Key Technical Details

### LaTeX Rendering

GPT returns LaTeX with `\[...\]` (display) and `\(...\)` (inline) delimiters, but `marked-katex-extension` expects `$$...$$` and `$...$`.

**Preprocessing** in `advisor-message.component.ts`:
```typescript
formatMarkdown(text: string): string {
  return text
    .replace(/\\\[/g, '$$')    // \[...\] → $$...$$
    .replace(/\\\]/g, '$$')
    .replace(/\\\(/g, '$')     // \(...\) → $...$
    .replace(/\\\)/g, '$');
}
```

### Context Handoff

When advisor A hands off to advisor B:
1. Advisor A returns `nextAdvisor` + `handoffSummary` (2-3 sentences)
2. Summary saved to `conversation.state.lastAdvisorSummary`
3. Advisor B receives summary in system prompt → maintains context continuity

### MAPAL Scoring

Calculated from `mapalImpact` enum in same LLM response (no extra call):
- NONE: 0 points
- LOW: 1 point
- MEDIUM: 2 points
- HIGH: 3 points
- QUANTUM: 5 points

Stored per advisor in `conversation.state.mapalScore` object.

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Code Style

- Frontend: 2-space indentation, single quotes for TypeScript
- Backend: 2-space indentation, single quotes for JavaScript
- Always use `advisor-ids.js` constants, never hardcode advisor IDs
- Follow existing patterns for multi-agent orchestration

## 📝 License

This project is proprietary software. All rights reserved.

## 👤 Author

**Lior Shilman**
- GitHub: [@LiorShilman](https://github.com/LiorShilman)

---

## 🔧 Troubleshooting

### Common Issues

**Q: MongoDB connection fails**
- Ensure MongoDB is running: `docker ps` or check `mongod` process
- Verify connection string in `.env`

**Q: OpenAI API errors**
- Check API key validity at https://platform.openai.com/api-keys
- Verify you have credits/billing configured

**Q: LaTeX not rendering**
- Ensure `katex.min.css` is included in `angular.json` styles array
- Check browser console for KaTeX errors

**Q: Advisor handoff not working**
- Verify advisor IDs are consistent across `advisor-ids.js` and function definitions
- Check `conversation.state.lastAdvisorSummary` is in Mongoose schema

**Q: Port already in use**
- Kill existing process: `taskkill /F /PID <pid>` (Windows) or `kill -9 <pid>` (Unix)
- Or change PORT in `.env`

---

<div align="center">

**Built with ❤️ using Angular, Node.js, and GPT-4o**

[🌟 Star this repo](https://github.com/LiorShilman/AdvisorsNetwork) if you find it useful!

</div>
