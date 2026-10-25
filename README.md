# CortexAI

CortexAI is a multi-agent AI chat application. It combines a React chat interface with a Node.js/Express backend split into gateway, authentication, chat persistence, and AI-agent services. The agent service uses LangGraph to route a request to a specialist; available paths in the current code include general chat, web search, and coding.

> **Project status:** this repository is an in-progress prototype, not a production-ready platform. Some UI controls are visual-only, and the PDF, presentation, and vision agents are placeholders. Application features are documented together below, with their current implementation status noted where relevant.

## Contents

- [Application functionality](#application-functionality)
- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Requirements](#requirements)
- [Configuration](#configuration)
- [Run locally on Windows](#run-locally-on-windows)
- [User and request flows](#user-and-request-flows)
- [HTTP API](#http-api)
- [Data model and caching](#data-model-and-caching)
- [Agent behavior](#agent-behavior)
- [Out-of-the-box behavior](#out-of-the-box-behavior)
- [Implementation notes](#implementation-notes)
- [Development and validation](#development-and-validation)
- [Deployment and security notes](#deployment-and-security-notes)
- [Video references](#video-references)

## Application functionality

- A dark-themed, single-page chat interface with a conversation sidebar and responsive chat layout.
- Google sign-in through Firebase Authentication, followed by server-side Firebase ID-token verification.
- An authentication flow that sets an HTTP-only session cookie, with the gateway protecting chat and agent routes.
- Conversation creation, listing, title updates, message persistence, and message history retrieval through the chat service.
- Selection of Auto, Chat, Coding, PDF, PPT, Image, or Search from the composer. Auto delegates selection to a language-model router; explicit agent choices are sent to the agent graph.
- General chat responses with conversation context.
- Tavily-backed web search, with search results passed into the chat response and search images returned to the client.
- Coding-agent responses for code generation, review, explanation, debugging, optimization, conversion, and documentation. Code generation can return a file-list artifact from the agent API.
- Markdown rendering, syntax highlighting, code-copy controls, image previews, and a full-screen image lightbox in chat messages.
- Redis-backed login sessions and a Redis cache of recent conversation messages.

The product interface and agent graph also include document, presentation, vision/image, and generated-file workflows. The intended behavior and current implementation status for each area are described below; an option appearing in the interface or graph does not necessarily mean its full workflow is implemented.

### Document assistance (PDF)

The PDF workflow is intended to support questions about PDFs and document context, including upload, validation, text extraction, chunking, document-grounded answers, and optionally PDF generation/export. The PDF agent currently returns a placeholder response: upload, extraction, retrieval, and generation are not implemented.

### Presentation generation (PPT)

The presentation workflow is intended to create or edit slide content and provide a preview and downloadable presentation. The PPT agent currently returns a placeholder response; there is no slide-generation pipeline, preview, or presentation export.

### Vision and image workflows

The vision option is intended for image understanding, image creation, or both, depending on the chosen product behavior. The current vision agent is a placeholder and does not call an image model. The UI labels this option `Image` and sends `image`, while the graph expects `vision`, so manually selecting it does not reliably route to the vision node.

### Generated files and artifacts

The coding agent can return generated project files as an artifact containing file names and text contents. The message schema can persist artifacts, but the artifact panel is currently a placeholder and the chat interface does not yet preview or offer downloads for generated files.

### Retrieval-augmented generation (RAG)

The intended document-question-answering experience can be extended with RAG: document ingestion and chunking, embeddings, a vector store, user-scoped retrieval, and citations to source passages. No document RAG pipeline or vector store is currently implemented. Redis conversation context and Tavily web search are separate features; neither is document RAG.

### Composer and conversation experience

The chat composer includes attachment and microphone controls intended for file upload and voice input, but those controls are visual-only and no upload or voice-capture workflow is implemented. Starter prompt chips appear on the empty state but do not currently populate or submit the composer. The sidebar supports conversation selection and collapsed/expanded layouts.

### Production and operational capabilities

The repository is structured as separate frontend, gateway, auth, chat, and agent services, but the current Compose configuration starts Redis only. Full-stack container orchestration, AWS deployment configuration, automated backend tests, and CI workflows are not included. Production operation would also require ownership enforcement, request validation, secure deployment secrets, production cookie/CORS settings, health checks, and operational monitoring.

See [Implementation notes](#implementation-notes) for more detail on current limitations and deployment considerations.

## Technology stack

| Area | Technologies in this repository |
|---|---|
| Web client | React 19, Vite, JavaScript, Tailwind CSS 4 |
| Client state and HTTP | Redux Toolkit, React Redux, Axios |
| Authentication UI | Firebase Authentication, Google provider |
| Chat rendering | `react-markdown`, `remark-gfm`, `react-syntax-highlighter`, Lucide React, React Icons |
| Backend runtime | Node.js, ES modules, Express 5 |
| Gateway | `express-http-proxy`, CORS, cookie-parser, Morgan |
| Authentication service | Firebase Admin SDK, Mongoose |
| Chat service and persistence | Mongoose / MongoDB |
| Agent orchestration | LangChain, LangGraph |
| Model providers | Groq and OpenRouter are wired to the current chat and coding paths; Google Generative AI is initialized in model configuration |
| Web search | Tavily through `@langchain/tavily` |
| Session and prompt-history cache | Redis through ioredis |
| Local infrastructure | Docker Compose currently defines Redis only |

## Architecture

```text
React + Vite browser
        |
        | Axios, credentialed requests, session cookie
        v
Express API gateway
  |             |                 |
  | /api/auth   | /api/chat       | /api/agent
  v             v                 v
Auth service  Chat service     Agent service
  |             |                 |
  |             +------ MongoDB --+
  |                               |
  +-- MongoDB                     +-- LangGraph router and agent nodes
  +-- Firebase Admin verification       |-- Chat model (Groq)
  +-- Redis sessions                     |-- Search (Tavily -> Chat)
                                         |-- Coding model (OpenRouter)
                                         |-- PDF/PPT/Vision placeholders
        Redis is also used for recent conversation context
```

### Service responsibilities

- **Frontend (`frontend/`)**: renders the chat application, maintains UI state in Redux, signs in with Firebase, and calls the gateway using Axios with credentials enabled.
- **Gateway (`backend/gateway/`)**: the browser-facing API entry point. It proxies authentication requests, checks the session cookie for chat and agent requests, and forwards the authenticated user ID to the chat service as `x-user-id`.
- **Auth service (`backend/services/auth/`)**: verifies Firebase ID tokens, creates or finds a MongoDB user, creates a seven-day Redis session, and sets/clears the `session` cookie.
- **Chat service (`backend/services/chat/`)**: stores conversations and messages in MongoDB and provides persistence endpoints.
- **Agent service (`backend/services/agents/`)**: stores the incoming user message, invokes the LangGraph workflow, updates Redis conversation context, stores the assistant response, and returns the result to the gateway/client.
- **Redis (`backend/shared/redis/` and `backend/docker-compose.yml`)**: holds session records and cached recent messages. It is not the project’s primary conversation database.
- **MongoDB**: holds user, conversation, and message documents. Auth, chat, and agent services each initialize a Mongoose connection from their environment.

### Request flow

1. On app load, the client calls `GET /api/me` to restore the current session.
2. If there is no current user, the UI offers Google sign-in. Firebase returns an ID token, which is posted to `POST /api/auth/login`.
3. The auth service verifies the token with Firebase Admin, finds or creates the user record, stores session data in Redis, and returns a session cookie.
4. The client creates/selects a conversation and submits a prompt and agent selection to `POST /api/agent/chat`.
5. The gateway validates the session cookie. For chat-service proxy requests it also forwards the authenticated user ID in `x-user-id`.
6. The agent service persists the user message, invokes the graph, stores the assistant message and any returned images/artifacts, and responds with the generated answer.
7. The UI appends the response to its current Redux message list. Selecting an existing conversation fetches its saved messages.

## Repository layout

```text
.
├── README.MD
├── backend/
│   ├── docker-compose.yml
│   ├── gateway/
│   │   ├── controllers/         # Current-user handler
│   │   ├── middleware/         # Redis session guard
│   │   └── utils/              # Proxy helper that forwards user ID
│   ├── services/
│   │   ├── auth/               # Firebase token verification and sessions
│   │   ├── chat/               # Conversation/message API and Mongoose models
│   │   └── agents/
│   │       ├── agents/         # Chat, coding, search, PDF, PPT, vision nodes
│   │       ├── config/         # Models, Redis memory, Tavily, MongoDB
│   │       └── graph/          # LangGraph state, routing, and workflow
│   └── shared/redis/           # Shared Redis client
└── frontend/
    ├── features/               # API operations used by the UI
    ├── src/
    │   ├── components/         # Chat, sidebar, message, and artifact UI
    │   ├── pages/              # Home page and login overlay
    │   └── redux/              # User, conversation, and message state
    └── utils/                  # Axios and Firebase client configuration
```

## Requirements

- Node.js and npm versions compatible with the package versions in the included lockfiles.
- A MongoDB instance (local or hosted).
- A Redis instance. Docker Desktop with Compose is one supported local option.
- A Firebase project configured for Google Authentication, with a web-app API key and a Firebase Admin service-account JSON file.
- API credentials for the model provider(s) used by the selected agent path and for Tavily search.

The backend does not currently define a root-level development command; start each service in its own terminal.

## Configuration

Create local environment files for the frontend and each backend service. Do not commit `.env` files, Firebase service-account keys, or provider credentials. The exact runtime variables referenced by the code are:

| Variable | Used by | Purpose |
|---|---|---|
| `VITE_SERVER_URL` | Frontend | Base URL of the gateway, for example `http://localhost:5000` |
| `VITE_FIREBASE_API_KEY` | Frontend | Firebase web-app API key |
| `PORT` | Gateway, auth, chat, agent services | Port for that individual Express process |
| `FRONTEND_URL` | Gateway | Allowed browser origin, normally `http://localhost:5173` for local development |
| `AUTH_SERVICE` | Gateway | Auth service base URL |
| `CHAT_SERVICE` | Gateway and agent service | Chat service base URL |
| `AGENT_SERVICE` | Gateway | Agent service base URL |
| `MONGODB_URI` | Auth, chat, agent services | MongoDB connection URI |
| `REDIS_URL` | Gateway, auth, agent service | Redis connection URI |
| Provider credentials | Agent service | Credentials required by the configured Groq, OpenRouter, Google, and Tavily SDKs |

The model and search SDKs are initialized in `backend/services/agents/config/llmModels.js` and `backend/services/agents/config/tavily.js`. Use the provider-documented environment variable names for their SDKs (commonly `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `GOOGLE_API_KEY`, and `TAVILY_API_KEY`) and verify them against the SDK versions in the lockfile.

The Firebase Admin configuration imports `backend/services/auth/serviceAccountKey.json` from the auth service. Place your own service-account file at that location or update the import/configuration to use a safer deployment secret mechanism. This private key file is not an environment variable and must never be committed.

Example values below are illustrative. Choose distinct available ports, then use the same values consistently in service URLs and `PORT` settings:

```dotenv
# frontend/.env
VITE_SERVER_URL=http://localhost:5000
VITE_FIREBASE_API_KEY=your-firebase-web-api-key
```

```dotenv
# backend/gateway/.env
PORT=5000
FRONTEND_URL=http://localhost:5173
AUTH_SERVICE=http://localhost:5001
CHAT_SERVICE=http://localhost:5002
AGENT_SERVICE=http://localhost:5003
REDIS_URL=redis://localhost:6379
```

```dotenv
# backend/services/auth/.env
PORT=5001
MONGODB_URI=mongodb://127.0.0.1:27017/cortexai
REDIS_URL=redis://localhost:6379
```

```dotenv
# backend/services/chat/.env
PORT=5002
MONGODB_URI=mongodb://127.0.0.1:27017/cortexai
```

```dotenv
# backend/services/agents/.env
PORT=5003
MONGODB_URI=mongodb://127.0.0.1:27017/cortexai
REDIS_URL=redis://localhost:6379
CHAT_SERVICE=http://localhost:5002
GROQ_API_KEY=your-groq-key
OPENROUTER_API_KEY=your-openrouter-key
TAVILY_API_KEY=your-tavily-key
GOOGLE_API_KEY=your-google-ai-key
```

The example assumes MongoDB is reachable at the shown URI and Redis is local. Hosted service URLs and credentials should be supplied through the same service-specific configuration.

## Run locally on Windows

Open separate PowerShell terminals for the commands below. Run `npm install` once in each package directory, or use `npm ci` when reproducing the exact lockfile dependencies.

1. **Start Redis** from the backend directory:

   ```powershell
   Set-Location .\backend
   docker compose up -d redis
   ```

2. **Start MongoDB** locally or provision a hosted database, then set `MONGODB_URI` in the auth, chat, and agent service environment files.

3. **Configure Firebase and provider credentials** as described above. Ensure the Firebase Admin service-account JSON is available to the auth service without adding it to source control.

4. **Install and start the backend services**, each in a separate terminal:

   ```powershell
   Set-Location .\backend\services\auth
   npm install
   npm run dev
   ```

   ```powershell
   Set-Location .\backend\services\chat
   npm install
   npm run dev
   ```

   ```powershell
   Set-Location .\backend\services\agents
   npm install
   npm run dev
   ```

   ```powershell
   Set-Location .\backend\gateway
   npm install
   npm run dev
   ```

   Each service's `PORT` and URLs must match the values you configured. `npm run dev` uses Nodemon in the individual backend packages.

5. **Install and start the frontend**:

   ```powershell
   Set-Location .\frontend
   npm install
   npm run dev
   ```

6. Open the Vite URL shown in the terminal (typically `http://localhost:5173`) and sign in with a Google account allowed by your Firebase project's Authentication settings.

To stop the local Redis container:

```powershell
Set-Location .\backend
docker compose down
```

## User and request flows

### Authentication

- The browser signs in with Firebase Google Authentication and posts the resulting Firebase ID token to the auth service through the gateway.
- The auth service verifies the token, finds or creates a MongoDB user, and stores a random session identifier in Redis with a seven-day expiration.
- The session identifier is returned in an HTTP-only cookie. The gateway reads this cookie for protected chat and agent routes.
- `GET /api/me` returns the user data attached to the validated session; `GET /api/auth/logout` removes the Redis session and clears the cookie.

### Conversations and messages

- Conversations have a default title of `New Chat`; the frontend sets the title based on the first prompt.
- The chat service stores conversation ownership, message role/content, optional image URLs, and optional generated file artifacts.
- The sidebar loads conversation records, and selecting one loads its messages.
- The agent service saves both the incoming prompt and generated response through the chat service.

### Chat and search

- Auto mode asks a model to select one of `chat`, `search`, `coding`, `pdf`, `ppt`, or `vision`.
- Search mode invokes Tavily for up to five results and includes returned result data and image URLs in the workflow state.
- Search then flows to the chat node, which is prompted to answer from the search results.
- The chat node loads recent conversation context from Redis, falling back to the chat service when the cache is empty.

### Coding

- The coding node first classifies the prompt into code generation, review, explanation, debugging, optimization, conversion, or documentation.
- Code generation asks the model to produce a JSON file list; the agent response includes a project artifact containing those files.
- Other coding intents produce Markdown text.
- The client currently renders Markdown/code but does not yet show or offer downloads for the returned project artifacts.

## HTTP API

All browser-facing routes are accessed through the gateway. The gateway proxies the auth service under `/api/auth`, protects chat and agent routes with the Redis session middleware, and exposes `/api/me`.

| Method | Gateway path | Authenticated | Purpose |
|---|---|---:|---|
| `GET` | `/` | No | Gateway greeting/availability response |
| `POST` | `/api/auth/login` | No | Verify Firebase ID token and create a session |
| `GET` | `/api/auth/logout` | No | Delete the current Redis session and clear the cookie |
| `GET` | `/api/me` | Yes | Return current session user |
| `GET` | `/api/chat/create-conversation` | Yes | Create a conversation for the authenticated user |
| `GET` | `/api/chat/get-conversations` | Yes | List the authenticated user's conversations |
| `POST` | `/api/chat/update-conversation` | Yes | Update a conversation title; JSON body: `{ "id": "...", "title": "..." }` |
| `POST` | `/api/chat/save-message` | Yes | Persist a message; body includes `conversationId`, `role`, `content`, and optional `images`/`artifacts` |
| `GET` | `/api/chat/get-messages/:conversationId` | Yes | Retrieve messages for a conversation |
| `POST` | `/api/agent/chat` | Yes | Run the selected/automatic agent; body: `{ "prompt": "...", "conversationId": "...", "agent": "auto" }` |

The agent response shape is `{ "answer": "...", "images": [], "artifacts": [] }`. Depending on the selected agent and model response, fields may be empty or omitted by intermediate paths.

The chat-service routes themselves are intended to be reached through the gateway. Current service route definitions are in `backend/services/chat/routes/chat.routes.js`; the agent route is in `backend/services/agents/routes/agent.route.js`; and auth routes are in `backend/services/auth/routes/auth.route.js`.

## Data model and caching

### MongoDB documents

- **User**: Firebase UID, display name, email, avatar URL, and Mongoose timestamps. Firebase UID is unique.
- **Conversation**: title (defaults to `New Chat`), user ID, and timestamps.
- **Message**: conversation ID, role (`user` or `assistant`), content, optional image URL array, optional artifact array, and timestamps.
- **Artifact**: numeric ID, type, and a list of files. Each file has a name and text content.

### Redis keys

- `session-<sessionId>` stores the serialized user identity for a login session. The auth service sets a seven-day expiration.
- `messages-<conversationId>` caches the recent conversation context used by the chat agent. The memory helper limits additions to 20 messages and initially caches a database-loaded history for 24 hours.

Redis is a cache/session dependency and MongoDB remains the durable store for users, conversations, and chat messages.

## Agent behavior

The graph state includes the prompt, selected agent, conversation ID, AI response, search results, images, and artifacts. The router honors an explicit agent value other than `auto`; otherwise, it asks the configured model to return one agent name.

| Agent | Current behavior |
|---|---|
| `chat` | Calls the Groq-backed chat model with Markdown-oriented instructions and cached conversation history. |
| `search` | Searches with Tavily, then transitions to the chat node to compose an answer from results. |
| `coding` | Uses an intent-classification call and a coding model; code generation returns a project file artifact, while other coding intents return Markdown. |
| `pdf` | Placeholder response only; no PDF upload, extraction, question answering, or generation pipeline exists yet. |
| `ppt` | Placeholder response only; no presentation generation or editing pipeline exists yet. |
| `vision` | Placeholder response only; no image understanding or image generation pipeline exists yet. |

The UI currently labels the vision choice `Image` and sends `image`, while the graph recognizes `vision`. Until these are aligned, choosing Image does not reliably select the vision node. Auto mode does route based on the graph's available agent labels, but PDF/PPT/Vision still resolve to placeholder behavior.

## Out-of-the-box behavior

- Authentication is required to use chat and agent APIs; the UI displays a login overlay when no current user is loaded.
- Chat rendering supports GitHub-flavored Markdown, syntax-highlighted fenced code blocks, code copying, and clickable image previews.
- Conversations are loaded from the chat service and messages are loaded when a saved conversation is selected.
- The starter prompt chips are displayed in the empty state, but are currently decorative and do not populate the composer.
- The sidebar includes collapsed/expanded layouts, conversation selection, and a new-chat affordance.
- The paperclip and microphone composer buttons are currently visual-only; there is no file upload or voice capture pipeline.
- The artifact component is currently a placeholder, so file artifacts returned by code generation are not yet presented as a usable file viewer/download experience.
- Docker Compose starts Redis only. MongoDB, frontend, gateway, and backend services must be started/configured separately.

## Implementation notes

The video references describe a broader production-ready multi-agent platform involving microservices, RAG, LangGraph, Docker, and AWS. The repository has a microservice layout and a LangGraph workflow, but the sections above distinguish working behavior from represented-but-unimplemented product areas.

### Data access and service boundaries

- Verify ownership for every conversation and message read/update operation. The gateway currently forwards a user ID for chat proxies, but chat handlers do not consistently enforce ownership, and agent calls to chat persistence are direct service-to-service requests.
- Authenticate internal service-to-service calls rather than exposing trust based only on network placement.
- Validate request bodies, IDs, agent names, payload sizes, and uploaded files; return consistent client errors and avoid exposing internal exceptions.
- Review session-cookie flags and CORS settings for HTTPS, cross-site deployment, and the intended frontend domain. The current auth cookie uses `secure: false` and `sameSite: "strict"`.
- Add rate limits, structured logs, health/readiness checks, graceful shutdown, timeout/retry policy, and secret management.

### Deployment, tests, and operations

- Full-stack container definitions, reproducible health checks, and AWS deployment infrastructure are not present in the repository.
- The backend root `npm test` script is a placeholder; automated backend tests and CI for lint/build/test are not currently configured.
- Costs, provider quotas, model fallback behavior, data retention, backups, and production monitoring are not defined here.

## Development and validation

Frontend scripts, run from `frontend/`:

```powershell
npm run dev
npm run lint
npm run build
npm run preview
```

Each backend package (`gateway`, `services/auth`, `services/chat`, `services/agents`) currently provides `npm run dev` for Nodemon-based local development. The backend root `npm test` script is only a placeholder that exits with “Error: no test specified”; there is not yet a backend automated test suite.

## Deployment and security notes

- Treat this codebase as a development prototype until authorization, validation, secrets, and testing have been addressed.
- Never commit Firebase Admin credentials, API keys, database URIs with passwords, or production `.env` files.
- Use HTTPS and production-appropriate cookie settings; configure exact allowed origins rather than permissive CORS.
- Restrict every conversation/message operation to its authenticated owner, including internal agent-to-chat requests.
- Ensure model/search providers receive only the data needed for the request, and document the privacy and retention implications for users.
- The current Compose file defines a plain Redis container with a published local port; it does not configure persistence, authentication, or a production network.

## Video references

The following videos were supplied as product/architecture references:

1. [Build a Production-Ready Multi-Agent AI Platform | MERN, Microservices, RAG, LangGraph, Docker & AWS](https://youtu.be/HqXltXGn16E?si=7vDUERtEMzMVq-nS) — VIRTUAL CODE.
2. [Build a Production-Ready Multi-Agent AI Platform | Part 2 | MERN, RAG, LangGraph, Docker & AWS](https://youtu.be/dhE8LXKRR_s?si=S6B5Xb-Z_ovq-p1v) — VIRTUAL CODE.

The README uses the available video titles and compares them with the checked-in code. Feature descriptions reflect the supplied product scope, while implementation status is stated against the checked-in code.