# PrepYou

A job interview preparation platform powered by Vapi AI Voice agents.

---

## 🎥 Demo

Head to this Loom walkthrough for a product demo: [PrepYou Demo](https://www.loom.com/share/1f3ecf9f6d954c80a6072ac872eac9d0)

---

## 🤖 Introduction

PrepYou is a modern platform designed to assist users in preparing for job interviews.
It uses voice-based interview flows, AI-generated interview sets, and AI feedback to simulate realistic interview practice.

Built with:

- **Next.js** for frontend/backend logic  
- **Firebase** for authentication and data storage  
- **TailwindCSS** and **shadcn/ui** for UI  
- **Google Gemini** for generating AI questions  
- **Zod** for validation

---

## ⚙️ Tech Stack

- Next.js  
- Firebase  
- Tailwind CSS  
- Vapi AI  
- shadcn/ui  
- Google Gemini  
- Zod  

---

## 🏗 Architecture

- **Docker** runs the app locally through the `prepyou-dev` container.
- **Next.js** handles the UI, API routes, server actions, and app orchestration.
- **Firebase Auth** manages user authentication and session-backed access control.
- **Firestore** stores generated interviews and interview feedback.
- **Vapi** handles the live voice call and transcript stream for both interview generation and interview-taking.
- **Gemini** is the primary AI provider for interview question generation and feedback analysis.

### Runtime Flow

1. A user signs in through Firebase-authenticated flows.
2. For interview generation, the app starts an in-code Vapi assistant to collect role, type, level, amount, and tech stack.
3. After the call, the app submits those values to `/api/vapi/generate`, which creates and stores the interview in Firestore.
4. For interview-taking, the app starts the interviewer assistant with the saved questions.
5. After the interview ends, the app generates feedback from the transcript and stores it in Firestore.

### Current Notes

- The old external Vapi workflow is no longer the active local generation path.
- The application is designed around Gemini as the primary LLM for interview generation and feedback analysis.
- Local development includes deterministic fallback logic for interview generation and feedback when Gemini quota is unavailable, so the full workflow remains testable.
- Production behavior still expects Gemini-backed generation and evaluation.

---

## 🔋 Features

- 🔐 **Authentication**: Sign Up and Sign In via Firebase (email/password)  
- 🎙 **Voice-Based Interview Generation**: Create mock interviews through a guided Vapi voice flow and app-side generation
- 🤖 **AI Feedback**: Instant feedback from AI after taking the interview  
- 💡 **Modern UI/UX**: Clean and responsive design with smooth navigation  
- 🗂 **Interview Dashboard**: Track and manage past interviews  
- 📱 **Fully Responsive**: Optimized for all devices  

---

## 🚀 Quick Start

## ✅ Prerequisite Accounts

Before running the project, you should have:

- a **Firebase** project
- a **Gemini API key** from a Google AI Studio or compatible Google project
- a **Vapi** account with a valid web token

### 🔧 Prerequisites

For the recommended container-first workflow, make sure you have:

- Git  
- Docker Desktop

If you want to run the app directly on the host instead of Docker, you will also need:

- Node.js
- npm

## 🔥 Firebase Setup

1. Create a Firebase project.
2. Enable **Authentication** and turn on **Email/Password** sign-in.
3. Create a **Firestore Database**.
4. Add a Firebase **Web App** to get the client-side config values.
5. Create a **Firebase Admin service account key** for server-side access.

Use those values for:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

## 🎙 Vapi Setup

1. Create a Vapi account.
2. Generate a web token.
3. Set it as:

- `NEXT_PUBLIC_VAPI_WEB_TOKEN`

Notes:

- The current app flow uses **in-code Vapi assistants** for local interview generation and interview-taking.
- You do **not** need the old external Vapi generation workflow to use the current local app flow.

## 🧠 Gemini Setup

1. Create a Gemini API key in a Google AI Studio or compatible Google project.
2. Set it as:

- `GOOGLE_GENERATIVE_AI_API_KEY`

Notes:

- The app is designed around **Gemini as the primary LLM** for interview generation and feedback analysis.
- Local development includes deterministic fallback logic so the app remains testable when Gemini quota is unavailable.
- Production still expects working Gemini-backed generation and evaluation.

### 📥 Clone the Repository
```
git clone https://github.com/itanmaysharma/prepyou-ai-interviewer.git
cd prepyou-ai-interviewer
```
## 📦 Install Dependencies

If you are running the app directly on the host, install dependencies using npm:

`npm install`



## 🛠 Create `.env.local` File

Create a `.env.local` file in the root directory of the project and add the following environment variables:
```
NEXT_PUBLIC_VAPI_WEB_TOKEN=
GOOGLE_GENERATIVE_AI_API_KEY=
NEXT_PUBLIC_BASE_URL=http://localhost:3000

NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```
Replace the placeholder values with your actual Firebase, Vapi, and Gemini credentials.

Notes:

- `NEXT_PUBLIC_BASE_URL` should be `http://localhost:3000` for local development.
- The current app flow does not require the old external Vapi workflow id for interview generation.

## 🐳 Run with Docker

This is the recommended development workflow.

Start the app in a development container:

```bash
docker compose up --build prepyou-dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

This keeps dependencies inside Docker volumes instead of installing them on your machine.

### Stop the container

```bash
docker compose down
```

### Production-style container run

If you already have a `.env.local`, use it for a production-style build and boot:

```bash
docker compose --env-file .env.local up --build prepyou
```

### Why env values matter

- `NEXT_PUBLIC_*` variables are needed during the Next.js build
- Firebase admin and Gemini variables may also be needed while the server bundle is built
- The container also needs the same values again at runtime

## ▶️ Run on the Host

If you want to run the app outside Docker:

```bash
npm run dev
```

## 🧪 Local Development Notes

- Docker is the primary local runtime.
- The current interview-generation flow uses an in-code Vapi assistant and then calls the app API directly.
- The application is designed and production-oriented around Gemini for interview generation and interview feedback.
- Local development includes deterministic fallback logic when Gemini quota is unavailable, so the workflow can still be tested end to end.

## ✅ First Successful Run Checklist

1. Copy the environment shape into a local `.env.local`.
2. Fill in Firebase, Vapi, and Gemini credentials.
3. Start the app:

```bash
docker compose up --build prepyou-dev
```

4. Open [http://localhost:3000](http://localhost:3000).
5. Sign up or sign in.
6. Generate an interview from `/interview`.
7. Review and confirm the extracted interview details.
8. Take the generated interview.
9. Finish the call and open the feedback page.

## 🚢 Production Readiness Notes

- Production still requires a working Gemini setup for interview generation and interview feedback.
- The deterministic interview and feedback fallbacks are development-only safeguards and are not a substitute for the intended Gemini-backed production behavior.
- Vapi still requires a valid public-facing app deployment for browser-based production usage.
- Firebase Auth and Firestore in production should point to the intended live project, not a shared development project.

## 🛠 Troubleshooting

- **Firebase auth or Firestore errors**
  - Recheck the Firebase client and admin credentials in `.env.local`.
- **Gemini quota errors**
  - Local development can still run through deterministic fallback behavior, but production requires a working Gemini project and quota.
- **Vapi call errors**
  - Recheck `NEXT_PUBLIC_VAPI_WEB_TOKEN`.
- **Docker container uses stale values**
  - Restart the app:

```bash
docker compose down
docker compose up --build prepyou-dev
```
