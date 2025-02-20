# TODO Checklist

A structured checklist covering each phase of the Dictation & AI-Assisted Writing Tool project.

---

## 1. Project Initialization & Basic Setup
- [x] **Create Electron + React Application**
  - [x] Run `npm init` (or `yarn init`) to initialize project.
  - [x] Install `electron`, `react`, `react-dom`, and necessary build tools.
  - [x] Create an entry file (e.g. `main.js` or `electron.js`) for Electron's main process.
  - [x] Create a `renderer/` folder with a simple React component.
  - [x] Verify that running a start script opens an Electron window with "Hello World" in React.

- [x] **Configure Build & Launch Scripts**
  - [x] Set up `package.json` scripts:
    - [x] `"build"` for building React.
    - [x] `"start"` for launching Electron.
    - [x] `"test"` for running tests.

- [x] **Set Up Testing Framework**
  - [x] Install Jest (or chosen framework) and configure it.
  - [x] Write and run a basic test that checks if the application starts.

---

## 2. Basic Menu/Tray & Configuration UI (Placeholder)
- [ ] **Add System Tray Icon or Minimal Window**
  - [ ] Create a tray icon (or minimal menubar window on macOS).
  - [ ] Show a placeholder for future settings or status.

- [ ] **Placeholder Settings UI**
  - [ ] Create a React component (e.g., `Settings.js`) in `renderer/`.
  - [ ] Include stubs for user preferences (API key, trigger word).
  - [ ] Link it from the tray or a simple menu to open the settings window/section.

---

## 3. Hotkey Registration & Audio Capture
- [x] **GlobalShortcut Registration**
  - [x] Register double-tap `Fn`, single-tap `Fn`, and press-and-hold `Fn`.
  - [x] Ensure `Esc` key also stops any ongoing recording.
  - [x] Write tests to confirm shortcuts are registered.

- [x] **Integrate Microphone Access**
  - [x] Install `node-record-lpcm16` or similar library.
  - [x] Create logic to start/stop recording when shortcuts fire.
  - [x] Test raw audio logging to confirm data capture.

---

## 4. Stubbed Transcription
- [x] **Create `transcriptionService.js`**
  - [x] Export a `transcribeAudio` function that returns `"This is a stub transcription."`
  - [x] Update code so that when recording ends, `transcribeAudio` is called.
  - [x] Display/log the stub string in React UI or the console.

- [x] **Add Tests for Stubbed Transcription**
  - [x] Confirm `transcribeAudio` is called upon stopping.
  - [x] Confirm the returned text is as expected.

---

## 5. Whisper API Integration
- [x] **Replace Stub with Real Whisper Calls**
  - [x] Require a valid OpenAI API key (use environment variable or config).
  - [x] Add error handling for API failures (e.g., 401, network issues).

- [x] **Transcription Storage**
  - [x] Store the last 10 transcriptions in JSON or a local DB (SQLite).
  - [x] Create retrieval and display logic (e.g., a small "History" component).

- [x] **Write/Update Tests**
  - [x] Mock the Whisper API to verify success and error paths.
  - [x] Ensure stored transcriptions match actual results.

---

## 6. Text Processing & Cleanup
- [ ] **Implement Processing Functions**
  - [ ] `autoPunctuate`
  - [ ] `filterFillerWords` (removes "uh", "um", "like")
  - [ ] `handleSelfCorrections` (detect "I mean..." patterns)
  - [ ] `insertParagraphBreaks` (based on pauses or heuristics)

- [ ] **Apply Functions in Flow**
  - [ ] After receiving transcription, apply these transformations before showing the final text.

- [ ] **Unit Tests**
  - [ ] For each function, supply sample input -> expected output.
  - [ ] Confirm transformations are correct and robust.

---

## 7. AI Command Detection & GPT Integration
- [ ] **Parse Transcribed Text**
  - [ ] If first word = trigger (default "Juno"), or first two words contain an action verb (e.g., "Summarize"), treat as AI command.
  - [ ] If phrase starts with "Transcribe the following...", do not use AI.

- [ ] **Gather Context**
  - [ ] Collect highlighted text + clipboard if AI is triggered.
  - [ ] Build full prompt for GPT (including user preferences like temperature, model, etc.).

- [ ] **Call GPT and Insert Response**
  - [ ] If there's a highlighted region, replace it with GPT response.
  - [ ] If no active field, show a pop-up with the response and "Copy to Clipboard" button.

- [ ] **Tests**
  - [ ] AI detection logic with various phrases.
  - [ ] GPT mock tests (network success/failure).
  - [ ] Proper insertion and fallback pop-up scenario.

---

## 8. Settings & Configuration
- [ ] **Create or Expand Settings UI**
  - [ ] Provide fields for:
    - [ ] OpenAI API Key
    - [ ] AI Trigger Word
    - [ ] Model (default GPT-4o)
    - [ ] Temperature
    - [ ] Optionally: Startup behavior, microphone selection

- [ ] **Local Storage / Config**
  - [ ] Implement logic to save and load these preferences in a local JSON or DB.
  - [ ] Securely store API key if possible (OS keychain or encryption).

- [ ] **Testing Persistence**
  - [ ] Restart the app to confirm settings persist.
  - [ ] Unit tests for saving/loading config.

---

## 9. Error Handling & Notifications
- [ ] **OpenAI API Errors**
  - [ ] Show subtle notification (Electron `new Notification()` or library).
  - [ ] Play an error sound or beep.

- [ ] **Microphone Access Denied**
  - [ ] Prompt the user to grant microphone permissions.
  - [ ] Fallback or instructions if permission remains denied.

- [ ] **Crash & Auto-Restart**
  - [ ] Implement logic to catch crashes (`process.on('uncaughtException', ...)`) and relaunch.
  - [ ] Test if the app restarts on unexpected errors (mock approach).

- [ ] **Cancel Ongoing AI Request**
  - [ ] If user starts a new dictation, cancel the current request.

- [ ] **Test Each Error Scenario**
  - [ ] Unit tests and integration tests verifying notifications, handling, and crash recovery.

---

## 10. Final Integration & Packaging
- [ ] **Wire All Components**
  - [ ] Confirm end-to-end flow: Start recording -> Transcribe -> Process text or AI command -> Output.
  - [ ] Verify settings update logic and real-time usage (trigger word, etc.).
  - [ ] Check transcription history UI and AI responses.

- [ ] **Bundle with Electron Builder**
  - [ ] Configure `electron-builder` or equivalent to create .dmg.
  - [ ] Add relevant data in `package.json` (e.g., name, version).
  - [ ] Confirm it builds successfully.

- [ ] **Final End-to-End Testing**
  - [ ] Manual test dictation -> AI responses -> Insert text in various apps.
  - [ ] Evaluate performance and background resource usage.

- [ ] **Distribute & Validate**
  - [ ] Generate .dmg or .pkg for macOS.
  - [ ] Install and run on a clean system to confirm behavior.

---

## 11. Post-Release / Future Enhancements (Optional)
- [ ] **Analytics** (words dictated, AI usage stats).
- [ ] **Offline Whisper Model** (local transcription, no external API).
- [ ] **Additional AI-Powered Writing Tools** (rewrite, grammar check, etc.).
- [ ] **Export/Import Transcription History**.
- [ ] **Multi-Platform** (Windows, Linux).

---

## Usage of Prompts
- [ ] **Utilize the Provided Code-Generation Prompts** in sequence:
  1. [x] **Project Initialization & Basic Setup**
  2. [ ] **Global Hotkey & Audio Capture Setup**
  3. [ ] **Stubbed Transcription Function**
  4. [ ] **Replace Stub with Whisper API Integration**
  5. [ ] **Text Processing (Auto-Punctuation, Filler Word Filtering)**
  6. [ ] **AI Command Detection & GPT Integration**
  7. [ ] **Settings & Configuration**
  8. [ ] **Error Handling & Notifications**
  9. [ ] **Final Integration & Packaging**

- [ ] **Iterate** over each prompt, review & refine generated code.
- [ ] **Test** thoroughly before moving on to the next step.

---

**End of Checklist**