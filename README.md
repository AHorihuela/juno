# Juno - AI-Powered Dictation Assistant

<img src="assets/icon.png" width="120" alt="Juno Logo">

Juno is a powerful desktop application that combines real-time speech-to-text transcription with AI assistance, making it the perfect tool for efficient voice-to-text workflows. Named after the Roman goddess of protection and guidance, Juno helps you transcribe, process, and enhance your spoken words with intelligent AI assistance.

## ✨ Features

### 🎙️ Voice Recognition
- Real-time speech-to-text transcription using OpenAI's Whisper
- Support for multiple microphones
- Customizable trigger word for AI commands
- Intelligent noise detection and speech processing

### 🤖 AI Assistance
- GPT-4 and GPT-3.5 Turbo support
- Customizable AI rules and preferences
- Action verb recognition for command processing
- Context-aware responses based on highlighted text or clipboard content

### 📚 Smart Dictionary
- Custom dictionary for accurate transcription of specific terms
- Automatic word replacement and correction
- Support for technical terms and proper nouns

### ⚙️ Customization
- Configurable startup behavior
- Adjustable AI temperature for response variety
- Custom action verbs for command recognition
- Personalized AI rules for tailored responses

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm (comes with Node.js)
- sox (Sound eXchange) - Required for audio recording
  ```bash
  # macOS
  brew install sox

  # Linux
  sudo apt-get install sox

  # Windows
  # Download from https://sourceforge.net/projects/sox/
  ```
- OpenAI API key for AI features

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/juno.git
   cd juno
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your OpenAI API key in the settings

### Development

Run in development mode with hot reloading:
```bash
npm run dev
```

Build for production:
```bash
npm run build
```

Run in production mode:
```bash
npm start
```

## 🎯 Usage

### Basic Controls
- **Start Recording**: Double-tap ⌘+⇧+Space (Command+Shift+Space)
- **Stop Recording**: Single-tap ⌘+⇧+Space or press Escape
- **Cancel Recording**: Press Escape

### AI Commands
1. Start recording
2. Say your trigger word (default: "Juno") followed by a command
   - Example: "Hey Juno, summarize this"
3. Or use action verbs directly
   - Example: "Translate this to Spanish"

### Settings Configuration
1. Open the Settings page
2. Configure:
   - OpenAI API key
   - AI model selection
   - Temperature settings
   - Trigger word
   - Custom rules
   - Action verbs

## 🧪 Testing

Run the test suite:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

Generate coverage report:
```bash
npm run test:coverage
```

## 📦 Building for Distribution

Create distribution packages:
```bash
npm run dist
```

This will create platform-specific installers in the `dist` directory:
- macOS: `.dmg` and `.zip`
- Windows: `.exe` (NSIS) and portable
- Linux: `.AppImage` and `.deb`

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 🙏 Acknowledgments

- OpenAI for Whisper and GPT APIs
- Electron community
- React and React Router teams
- All contributors and users

---

Made with ❤️ by the Juno team 