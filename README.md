# AURA FIT - AI Fitness Flow

AURA FIT is a controller-free fitness application that uses advanced hand tracking and AI-driven form correction to guide users through workouts.

## Features

- **Generative Workouts**: AI creates custom plans based on your goals.
- **Real-time Form Correction**: Uses MediaPipe for skeletal tracking and Gemini 2.0 Flash for semantic understanding.
- **Voice Coaching**: Real-time verbal feedback and encouragement.
- **Gesture Control**: "Thumbs Up" to advance exercises.

## Setup & Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/your-username/aura-fit.git
    cd aura-fit
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Environment Variables**:
    Create a `.env` file in the root directory (or use your deployment platform's secrets manager).
    
    ```env
    API_KEY=your_google_gemini_api_key
    ```
    
    *Note: The application expects `process.env.API_KEY` to be available at build/runtime.*

4.  **Run Development Server**:
    ```bash
    npm start
    ```

## Deployment

### Vercel / Netlify / Cloudflare Pages

1.  Push your code to a GitHub repository.
2.  Import the project into your preferred hosting provider (e.g., Vercel).
3.  **Critical**: Add your `API_KEY` to the "Environment Variables" section of the project settings in the hosting dashboard.
4.  Deploy.

## Privacy & Permissions

This app requires Camera and Microphone access to function. All processing is done transiently; video frames sent to Gemini are used solely for inference and are not stored.
