# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Advisor Network is a Hebrew RTL financial advisory app built with Angular 18 (standalone components) and a Node.js/Express backend. It implements a multi-agent AI system where 17 specialized financial advisors (powered by GPT-4o via LangChain) collaborate in conversations. Data is persisted in MongoDB.

## Common Commands

```bash
# Frontend (port 4200, served at /AdvisorNetwork/)
npm start                # ng serve with AOT, source maps, base-href=/AdvisorNetwork/
npm run build            # Production build → dist/advisor-network
npm run watch            # Dev build with file watching
npm test                 # Karma + Jasmine tests in Chrome

# Backend (port 9292)
cd src/server
npm start                # Production mode
npm run dev              # Development mode with nodemon (auto-restart on changes)
npm test                 # Run Jest tests
```

### MongoDB Setup

MongoDB must be running on `localhost:27017` (database: `financial-advisors-360`).

**Quick setup with Docker:**
```bash
docker run -d --name mongodb-advisor -p 27017:27017 -v mongodb_data:/data/db mongo:7.0
```

## Architecture

### Frontend (`src/app/`)

**Standalone component architecture** — no NgModules. All components use `standalone: true` with explicit imports.

| Directory | Purpose |
|-----------|---------|
| `features/conversation/` | Main chat interface — message send/edit/delete, auto-scroll, markdown rendering, advisor switching |
| `features/conversation-list/` | Conversation history — search, sort, delete, title editing, podcast player, MFPL scores |
| `features/advisor-message/` | Renders advisor chat bubbles |
| `features/user-message/` | Renders user chat bubbles |
| `services/` | `AdvisorService` (API calls), `ChatSessionService` (state), `PodcastService` (audio player) |
| `models/` | TypeScript interfaces — `AdvisorId` union type (17 advisor IDs), `ChatMessage`, `Advisor` |
| `shared/` | Reusable components: `chat-bubble`, `score-indicator` |
| `directives/` | `DynamicWidthDirective` |
| `environments/` | Environment config (`apiBaseUrl`, `defaultLanguage: 'he'`) |

**Routing** (`app.routes.ts`): `''` → redirects to `/conversations` (list), `/conversation` (chat UI). Conversation ID is stored in localStorage.

### Backend (`src/server/`)

| Directory | Purpose |
|-----------|---------|
| `configs/` | Central config, MongoDB connection, **advisor definitions** (`advisors-system.js`), **single source of truth for advisor IDs** (`advisor-ids.js`) |
| `src/advisors/` | Advisor logic and personalities |
| `src/ai-orchestrator/` | **LangChain orchestration** — `advisorNetworkSystem.js` contains the core multi-agent routing logic |
| `src/controllers/` | Express route controllers |
| `src/langchain/` | LangChain integrations |
| `src/models/` | Mongoose models and route definitions |
| `src/services/` | Business logic services |
| `src/utils/` | Utility functions (MAPAL rendering, multi-agent composer, tension detection) |

### Multi-Agent Orchestration Architecture

**Core Concept**: Single LLM call per message with structured function calling for routing and context handoff.

**Key Files**:
- `src/server/src/ai-orchestrator/advisorNetworkSystem.js` - Main orchestration logic
- `src/server/configs/advisor-ids.js` - Single source of truth for all 18 advisor IDs
- `src/server/configs/advisors-system.js` - System prompts and advisor definitions

**Flow**:
1. User sends message → `processMessage()` in `advisorNetworkSystem.js`
2. Current advisor determined from `conversation.state.currentAdvisor`
3. System prompt includes:
   - Advisor's personality and expertise
   - **Context from previous advisor** (via `conversation.state.lastAdvisorSummary`)
   - Function calling schema with structured output requirements
4. **Single LLM call** returns structured response:
   ```javascript
   {
     text: string,              // Markdown response
     advisorId: string,         // Current advisor ID
     mapalImpact: enum,         // NONE|LOW|MEDIUM|HIGH|QUANTUM
     nextAdvisor?: {            // Optional handoff
       advisorId: string,
       reason: string,
       handoffText: string
     },
     handoffSummary?: string    // Context for next advisor
   }
   ```
5. If `nextAdvisor` present, `handoffSummary` is saved to `conversation.state.lastAdvisorSummary`
6. Next advisor receives this context in their system prompt
7. **MAPAL score** updated directly from `mapalImpact` (no extra LLM call)

**Important**: This architecture was refactored from 3 LLM calls to 1, with real context handoff between advisors.

### API Endpoints

```
POST   /api/conversations           # Send message
POST   /api/conversations/create    # New conversation
GET    /api/conversations/:id       # Get conversation
GET    /api/conversations?userId=   # List conversations
DELETE /api/conversations/:id       # Delete conversation
PATCH  /api/conversations/:id       # Update title
DELETE /api/conversations/:id/message/:messageId
POST   /messages/edit               # Edit message
GET    /api/advisors                # Advisor metadata
```

## Key Technical Details

- **Styling**: Tailwind CSS 3 + SCSS. Dark theme by default. Custom colors: `primary: #00bcd4`, `accent: #ffca28`, `background: #121212`, `surface: #1e1e1e`. Font: Rubik (Hebrew).
- **RTL**: `<html lang="he" dir="rtl">` — all layout is right-to-left.
- **Markdown & LaTeX**:
  - `ngx-markdown` v18 with `marked-katex-extension` for LaTeX rendering
  - Prismjs (Okaidia theme) for code highlighting
  - **LaTeX preprocessing required**: AI returns `\[...\]` and `\(...\)` delimiters, but `marked-katex-extension` expects `$$...$$` and `$...$`
  - Preprocessing done in `advisor-message.component.ts` → `formatMarkdown()` method
  - KaTeX CSS included in `angular.json` styles array
- **TypeScript**: Strict mode, ES2022 target, bundler module resolution.
- **Editor**: 2-space indentation, single quotes for TypeScript.
- **Deployment**: IIS with URL rewriting (`src/web.config` copied to dist). Production budget: 2MB warning / 5MB error for initial bundle.
- **State**: Services use `providedIn: 'root'`. localStorage for userId, conversationId, and podcast player state.

## The 17 Advisors

Each advisor has a unique `AdvisorId`, Hebrew name, color, and avatar image in `public/`. The strategy advisor (`אופק`) acts as orchestrator, routing to specialized advisors. The `AdvisorId` type is a string union: `'strategy' | 'budget' | 'mortgage' | 'investments' | 'pension' | 'risk' | 'behavior' | 'selfemployed' | 'special' | 'data' | 'career' | 'meaning' | 'abundance' | 'young' | 'altinvest' | 'intergen' | 'altretire' | 'futureself'`.

## Environment Variables (Backend `.env`)

```
NODE_ENV=development
PORT=9292
MONGODB_URI=mongodb://localhost:27017/financial-advisors-360
OPENAI_API_KEY=sk-...
MODEL_NAME=gpt-4o
TEMPERATURE=0.6
```

## Common Pitfalls & Important Notes

### Advisor IDs
- **Always use** `configs/advisor-ids.js` as the single source of truth
- All 18 advisors (including `futureself`) must be in sync across:
  - Function definition schema enums in `advisorNetworkSystem.js`
  - `advisors-system.js` definitions
  - Frontend `AdvisorId` type in `models/`

### LaTeX Rendering
- AI returns LaTeX with `\[...\]` (display) and `\(...\)` (inline) delimiters
- Must preprocess to `$$...$$` and `$...$` before passing to `ngx-markdown`
- Done in `advisor-message.component.ts` → `formatMarkdown()` method
- **Do not** try to configure marked hooks in `app.config.ts` - causes TypeScript errors with ngx-markdown v18

### processMessage Signature
- **Correct**: `processMessage(conversation, messages, message)`
- `conversation` = full conversation object with state
- `messages` = array of previous messages (for history)
- `message` = current user message text
- When calling from `editMessage` in controller, fetch messages from DB first

### MAPAL Scoring
- Calculated from `mapalImpact` field in same LLM response (no extra call)
- Impact levels: `NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, QUANTUM: 5`
- Stored in `conversation.state.mapalScore` with field keys per advisor
- Markdown rendering done via `renderMapalMarkdown()` utility

### Context Handoff
- When advisor hands off to another, they provide `handoffSummary` (2-3 sentences)
- Saved to `conversation.state.lastAdvisorSummary`
- Injected into next advisor's system prompt automatically
- This enables true multi-agent collaboration with memory
- **Critical**: If advisor mentions handoff in `text` (e.g. "אעביר אותך"), it **must** also return `nextAdvisor` — otherwise the handoff won't happen and user gets stuck in a loop
- Validation in `processMessage` logs a warning when text mentions handoff but `nextAdvisor` is missing

### Welcome Message (New Conversation)
- `createConversation` in `conversationController.js` calls `advisorNetworkSystem.initializeConversation()`
- The `userIntroMessage` from the strategy advisor (אופק) is **saved as a Message document** in MongoDB
- Frontend expects the response format: `{ init: { userIntroMessage, advisor, ... } }`
- **Do not** change the response structure without updating `conversation.component.ts:608`

### Client advisorId Override
- Frontend sends `advisorId` with every message request
- **Server is the source of truth** for `currentAdvisor` — do NOT blindly override from client
- Controller only applies client-specified advisor when it differs from stored value (manual switch)
- Without this guard, handoffs break: client sends stale `advisorId: 'strategy'` which overwrites the handoff

### Mongoose State Persistence
- Always call `conversation.markModified('state')` before `conversation.save()` when `processMessage` modifies nested state fields
- `lastAdvisorSummary` must be defined in the Conversation schema — Mongoose silently drops unknown fields
- Both `sendMessage` and `editMessage` controllers need `markModified('state')`

### Tailwind Content Paths
- Use forward slashes even on Windows: `"./src/**/*.{html,ts}"`
- **Not**: `"./src\\**\\*.ts"` (causes performance warnings)
