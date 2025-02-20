# Dictation Tool

A desktop application for real-time speech-to-text transcription with AI assistance.

## Prerequisites

Before running the application, make sure you have the following installed:

- Node.js (v16 or higher)
- npm (comes with Node.js)
- sox (Sound eXchange) - Required for audio recording
  - On macOS: `brew install sox`
  - On Linux: `sudo apt-get install sox`
  - On Windows: Download from [Sox website](https://sourceforge.net/projects/sox/)

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Development

Run the app in development mode:
```bash
npm run dev
```

This will:
- Start the app with hot reloading
- Open Chrome DevTools automatically
- Watch for file changes

## Testing

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## Usage

- Double-tap ⌘+⇧+Space (Command+Shift+Space) to start recording
- Single-tap ⌘+⇧+Space to stop recording
- Press Escape to stop recording at any time
- Watch the status indicator for recording state
- Check the error display if something goes wrong

## Building

Build for production:
```bash
npm run build
```

Run in production mode:
```bash
npm start
``` 