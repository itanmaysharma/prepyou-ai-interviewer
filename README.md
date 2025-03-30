# PrepYou

A job interview preparation platform powered by Vapi AI Voice agents.

---

## 🤖 Introduction

PrepYou is a modern platform designed to assist users in preparing for job interviews.  
Leveraging Vapi's AI voice agents, it offers an interactive experience to simulate real interview scenarios.

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

## 🔋 Features

- 🔐 **Authentication**: Sign Up and Sign In via Firebase (email/password)  
- 🎙 **Create Interviews**: Generate mock interviews using voice and Gemini AI  
- 🤖 **AI Feedback**: Instant feedback from AI after taking the interview  
- 💡 **Modern UI/UX**: Clean and responsive design with smooth navigation  
- 🗂 **Interview Dashboard**: Track and manage past interviews  
- 📱 **Fully Responsive**: Optimized for all devices  

---

## 🚀 Quick Start

### 🔧 Prerequisites

Make sure you have the following installed:

- Git  
- Node.js  
- npm  

### 📥 Clone the Repository

`git clone https://github.com/itanmaysharma/prepyou-ai-interviewer.git`
`cd prepyou-ai-interviewer`

## 📦 Install Dependencie

Install the project dependencies using npm:

`npm install`



## 🛠 Create `.env.local` File

Create a `.env.local` file in the root directory of the project and add the following environment variables:
```
NEXT_PUBLIC_VAPI_WEB_TOKEN=
NEXT_PUBLIC_VAPI_WORKFLOW_ID=
GOOGLE_GENERATIVE_AI_API_KEY=
NEXT_PUBLIC_BASE_URL=

NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

## ▶️ Run the App

Start the development server:

`npm run dev`

