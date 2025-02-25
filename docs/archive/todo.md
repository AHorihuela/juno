# TODO Checklist

A structured checklist covering each phase of the Dictation & AI-Assisted Writing Tool project.

---

## 1. Project Initialization & Basic Setup ✓
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

## 2. Basic Menu/Tray & Configuration UI ✓
- [x] **Add System Tray Icon or Minimal Window**
  - [x] Create a tray icon (or minimal menubar window on macOS).
  - [x] Show a placeholder for future settings or status.

- [x] **Settings UI**
  - [x] Create a React component (`Settings.js`) in `renderer/`.
  - [x] Include user preferences (API key, trigger word).
  - [x] Link it from the tray or a simple menu to open the settings window/section.

---

## 3. Hotkey Registration & Audio Capture ✓
- [x] **GlobalShortcut Registration**
  - [x] Register double-tap `Command+Shift+Space`, single-tap `Command+Shift+Space`, and press-and-hold `Command+Shift+Space`.
  - [x] Ensure `Esc` key also stops any ongoing recording.
  - [x] Write tests to confirm shortcuts are registered.

- [x] **Integrate Microphone Access**
  - [x] Install `node-record-lpcm16` or similar library.
  - [x] Create logic to start/stop recording when shortcuts fire.
  - [x] Test raw audio logging to confirm data capture.

---

## 4. Stubbed Transcription ✓
- [x] **Create `transcriptionService.js`**
  - [x] Export a `transcribeAudio` function that returns `"This is a stub transcription."`
  - [x] Update code so that when recording ends, `transcribeAudio` is called.
  - [x] Display/log the stub string in React UI or the console.

- [x] **Add Tests for Stubbed Transcription**
  - [x] Confirm `transcribeAudio` is called upon stopping.
  - [x] Confirm the returned text is as expected.

---

## 5. Whisper API Integration ✓
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

## 6. Text Processing & Cleanup ✓
- [x] **Implement Processing Functions**
  - [x] `autoPunctuate` (adds periods, commas, and capitalizes sentences)
  - [x] `filterFillerWords` (removes "uh", "um", "like")
  - [x] `handleSelfCorrections` (detect "I mean..." patterns)
  - [x] `insertParagraphBreaks` (based on pauses and transitions)

- [x] **Apply Functions in Flow**
  - [x] After receiving transcription, apply these transformations before showing the final text.
  - [x] Integrated with transcriptionService.js
  - [x] Added proper logging and debugging support

- [x] **Unit Tests**
  - [x] Test suite for each function with sample inputs/outputs
  - [x] Edge case handling (empty input, null values)
  - [x] Complex text transformation scenarios
  - [x] Integration tests with transcription flow

---

## 7. AI Command Detection & GPT Integration ✓
- [x] **Parse Transcribed Text**
  - [x] If first word = trigger (default "Juno"), or first two words contain an action verb (e.g., "Summarize"), treat as AI command.
  - [x] If phrase starts with "Transcribe the following...", do not use AI.

- [x] **Gather Context**
  - [x] Collect highlighted text + clipboard if AI is triggered.
  - [x] Build full prompt for GPT (including user preferences like temperature, model, etc.).

- [x] **Call GPT and Insert Response**
  - [x] If there's a highlighted region, replace it with GPT response.
  - [x] If no active field, show a pop-up with the response and "Copy to Clipboard" button.

- [x] **Tests**
  - [x] AI detection logic with various phrases.
  - [x] GPT mock tests (network success/failure).
  - [x] Proper insertion and fallback pop-up scenario.

---

## 8. Settings & Configuration ✓
- [x] **Create Settings UI**
  - [x] Provide fields for:
    - [x] OpenAI API Key
    - [x] AI Trigger Word
    - [x] Model (default GPT-4o)
    - [x] Temperature
    - [x] Startup behavior
    - [x] Default microphone selection

- [x] **Local Storage / Config**
  - [x] Implement logic to save and load these preferences in a local JSON or DB.
  - [x] Securely store API key using encryption.

- [x] **Testing Persistence**
  - [x] Restart the app to confirm settings persist.
  - [x] Unit tests for saving/loading config.

---

## 9. Error Handling & Notifications ✓
- [x] **OpenAI API Errors**
  - [x] Show subtle notification (Electron `new Notification()` or library).
  - [x] Play an error sound or beep.
  - [x] Implemented in `notificationService.js` with custom messages for different error types (401, 429)
  - [x] Platform-specific sound handling (macOS system sounds, custom sounds for others)

- [x] **Microphone Access Denied**
  - [x] Prompt the user to grant microphone permissions.
  - [x] Fallback or instructions if permission remains denied.
  - [x] Implemented in `recorder.js` with `systemPreferences` API
  - [x] Platform-specific handling for macOS permissions

- [x] **Crash & Auto-Restart**
  - [x] Implement logic to catch crashes (`process.on('uncaughtException', ...)`) and relaunch.
  - [x] Test if the app restarts on unexpected errors (mock approach).
  - [x] Added handlers for renderer and GPU process crashes
  - [x] 2-second delay before restart to ensure notification visibility

- [x] **Cancel Ongoing AI Request**
  - [x] If user starts a new dictation, cancel the current request.
  - [x] Implemented with AbortController in aiService.js
  - [x] Clean request cancellation without showing error notifications
  - [x] Proper cleanup of cancelled request resources

- [x] **Test Each Error Scenario**
  - [x] Unit tests and integration tests verifying notifications, handling, and crash recovery.
  - [x] Comprehensive test suite in `notificationService.test.js`
  - [x] Crash recovery tests in `crashRecovery.test.js`
  - [x] AI cancellation tests in `aiService.test.js`
  - [x] Platform-specific test cases for macOS

---

## 10. Final Integration & Packaging (In Progress)
- [x] **Wire All Components**
  - [x] Confirm end-to-end flow: Start recording -> Transcribe -> Process text or AI command -> Output.
  - [x] Verify settings update logic and real-time usage (trigger word, etc.).
  - [x] Check transcription history UI and AI responses.
  - [x] Implement text insertion with robotjs
  - [x] Add clipboard management for text insertion
  - [x] Handle fallback to popup when insertion fails
  - [x] Add tests for text insertion scenarios

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

## Next Steps:
1. Complete Final Integration & Packaging section
2. Configure electron-builder
3. Perform end-to-end testing
4. Generate macOS distribution package
5. Begin optional post-release enhancements

---

## Usage of Prompts
- [x] **Utilize the Provided Code-Generation Prompts** in sequence:
  1. [x] **Project Initialization & Basic Setup**
  2. [x] **Global Hotkey & Audio Capture Setup**
  3. [x] **Stubbed Transcription Function**
  4. [x] **Replace Stub with Whisper API Integration**
  5. [x] **Text Processing (Auto-Punctuation, Filler Word Filtering)**
  6. [x] **AI Command Detection & GPT Integration**
  7. [x] **Settings & Configuration**
  8. [x] **Error Handling & Notifications**
  9. [ ] **Final Integration & Packaging**

- [x] **Iterate** over each prompt, review & refine generated code.
- [x] **Test** thoroughly before moving on to the next step.

---

**End of Checklist**