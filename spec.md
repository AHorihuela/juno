# **Dictation & AI-Assisted Writing Tool - Developer Specification (Electron + React + Node.js)**

## **1. Overview**
This Mac application is a dictation tool that allows users to transcribe speech into any active text field. Additionally, it integrates with OpenAI’s API to process AI commands when a trigger word or specific action verbs are detected. 

## **2. Core Features & Functionalities**

### **2.1 Dictation & Transcription**
- **Hotkey Activation:**
  - Double-tap `Fn` to start recording (toggle mode).
  - Single-tap `Fn` to stop recording.
  - Press-and-hold `Fn` to record while held, release to stop.
  - `Esc` key always stops recording.
- **Auto-Punctuation:**
  - The system infers sentence structure and applies punctuation automatically.
- **Filler Word Filtering:**
  - Removes "uh," "um," "like," and corrects self-corrections (e.g., *"three, I mean four cups"* → *"four cups"*).
- **Multi-Paragraph Support:**
  - Inserts natural paragraph breaks based on speech patterns.
- **Transcription History:**
  - Stores the last 10 transcriptions locally.

### **2.2 AI Integration & Commands**
- **Triggering AI Processing:**
  - If the first word is the trigger (default: `Juno`), send the full input to OpenAI.
  - If an action verb is detected in the first two words (e.g., *"Summarize this"*), assume AI intent.
  - Exception: If the phrase starts with *"Transcribe the following..."*, it is always transcribed.
- **Clipboard & Highlighted Text Context:**
  - If AI is triggered, automatically append the **clipboard** and **highlighted text** to the AI request.
- **AI Response Handling:**
  - The response is **immediately pasted** into the active text field.
  - If no active field exists, show a pop-up with a *Copy to Clipboard* button.
- **Inline AI Editing:**
  - Users can highlight existing text and dictate a command (e.g., *"Juno, make this more concise"*), replacing the highlighted section in place.
- **AI Settings & Customization:**
  - Users can **change the AI trigger word** (default: `Juno`).
  - Users **must provide their own OpenAI API key**.
  - Users can select their AI model (default: GPT-4o).
  - Users can set persistent AI instructions (e.g., *"Always respond in a formal tone"*).
  - Users can adjust the OpenAI temperature setting.

### **2.3 System Behavior**
- **Background Process:**
  - Runs as a lightweight Electron app.
  - Uses minimal system resources when idle.
- **Startup Behavior:**
  - Automatically launches at system startup.
- **Microphone Selection:**
  - Uses the system’s default microphone.
  - Users can select a different microphone in settings.
- **Error Handling:**
  - **Subtle notification + audible feedback** when errors occur (e.g., API failure, no internet).
  - AI requests are canceled if the user starts a new dictation.
  - The app auto-restarts after a crash.
- **Security & Data Handling:**
  - All transcriptions and settings are **stored locally**.
  - No cloud sync or external data storage.
  - OpenAI API key is stored securely on-device.

## **3. Technical Architecture**

### **3.1 Technology Stack**
- **Frontend:** React (Electron Renderer Process, Tailwind CSS for styling)
- **Backend:** Node.js (Electron Main Process)
- **Speech-to-Text Engine:** OpenAI Whisper API
- **AI Processing:** OpenAI GPT-4o API
- **Electron APIs:**
  - `globalShortcut` for hotkey handling.
  - `robotjs` for inserting transcriptions into active text fields.
  - `node-record-lpcm16` for capturing microphone input.

### **3.2 Data Storage**
- **Settings:** Stored in a local JSON configuration file.
- **Transcription History & AI Responses:** Stored in SQLite or JSON.
- **Custom Dictionary (User Corrections):** Local JSON file for mis-transcribed words.

## **4. Error Handling Strategy**

### **4.1 Common Failure Cases & Solutions**

| Failure Case | Handling Strategy |
|-------------|------------------|
| OpenAI API Failure | Show notification & play error sound |
| No Active Text Field | Pop-up window with a *Copy to Clipboard* option |
| Microphone Access Denied | Show system permission prompt |
| Long Recording (3+ mins) | Warning notification but allow continued dictation |
| Crash | Auto-restart app |

## **5. Testing Plan**

### **5.1 Unit Testing**
- Test speech recognition accuracy.
- Verify trigger word detection.
- Ensure AI integration processes the correct context.

### **5.2 UI/UX Testing**
- Test menu bar interactions.
- Ensure smooth hotkey functionality.
- Verify notification behavior for errors.

### **5.3 Performance Testing**
- Measure background resource usage.
- Ensure AI processing does not cause UI lag.

### **5.4 Edge Cases**
- Test with different text field types (emails, messaging apps, web forms).
- Ensure AI commands work with multi-paragraph text.

## **6. Deployment Plan**

### **6.1 Initial Release (MVP)**
- Basic speech-to-text with AI integration.
- Essential UI (menu bar app + settings page).
- Core error handling & background performance tuning.

### **6.2 Future Enhancements**
- Analytics (words dictated, AI usage tracking).
- Optional offline transcription via local Whisper model.
- Export transcription history.
- Support for additional AI-powered writing features.

## **7. Conclusion**
This specification provides a detailed roadmap for developing the dictation tool. It ensures a balance between **seamless user experience, lightweight performance, and powerful AI-assisted writing features**. The next step is to begin implementation, starting with the **core transcription and AI integration logic**.

## **8. Action Items for Development Kickoff**
1. **Set up Electron project structure** (React frontend, Node.js backend, Electron setup).
2. **Implement hotkey-based recording & transcription** (Whisper API integration).
3. **Develop AI command parsing & processing** (trigger detection, clipboard handling).
4. **Design and implement the menu bar UI**.
5. **Test end-to-end flow** before adding additional refinements.
