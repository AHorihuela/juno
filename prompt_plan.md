# Dictation & AI-Assisted Writing Tool — Development Prompts

Below is a structured outline followed by iterative breakdowns. After that, you’ll find a series of code-generation prompts for building this application in a test-driven manner. Each prompt is labeled clearly, uses a code block (fenced with ````text```), and builds upon the previous prompt.

---

## 1. **Detailed, Step-by-Step Blueprint**

1. **Initialize Project & Basic Setup**  
   - Create a new Electron + React application.  
   - Configure directory structure (e.g., `main/`, `renderer/`, `test/`).  
   - Install core dependencies (`electron`, `react`, `react-dom`, build tools, etc.).  
   - Create a `main.js` (or `electron.js`) entry point for the Electron main process and a `renderer.js` (or similar) for the React side.  
   - Configure a build and launch script.

2. **Add Basic Menu/Tray & Configuration**  
   - Implement a system tray (menu bar icon) or minimal window to manage application state.  
   - Create a placeholder settings UI in React for user preferences (trigger word, API key, etc.).  
   - Provide stubs for future features.

3. **Set Up Testing Framework**  
   - Add testing tools (e.g., Jest, Testing Library).  
   - Configure basic test scripts.  
   - Write a sanity check test (e.g., ensuring the app window opens without error).

4. **Hotkey Registration & Audio Capture**  
   - Use `globalShortcut` to register the `Fn` toggles (double-tap, single-tap, press-and-hold).  
   - Integrate microphone access with an audio capture library (e.g., `node-record-lpcm16`).  
   - Implement event listeners for start/stop dictation states.

5. **Speech-to-Text Integration (Stubbed)**  
   - Add a function that simulates transcription for early testing (fake data or local mock).  
   - Pipe microphone input into the stub.  
   - Display transcribed text in the console or simple React component for validation.

6. **OpenAI Whisper Integration**  
   - Replace the stubbed transcription with calls to OpenAI Whisper.  
   - Implement error handling for network/API failures.  
   - Maintain local transcription log (in a JSON or SQLite store).

7. **Text Processing & Editing Features**  
   - Implement auto-punctuation (basic approach first).  
   - Filter filler words ("um", "uh", "like").  
   - Handle corrections of self-corrections.  
   - Insert multi-paragraph breaks.  
   - Thoroughly test each text processing rule.

8. **AI Command Detection & GPT Integration**  
   - Parse transcribed text for the trigger word or action verbs.  
   - If triggered, gather context (clipboard + highlighted text).  
   - Call OpenAI’s GPT-4o with user-specified settings (API key, temperature, etc.).  
   - Insert or replace text in the active field with AI output; fallback to a pop-up if no active field.

9. **Finalize Settings & Preferences**  
   - Add persistent user preferences (API key, trigger word, model selection).  
   - Securely store them on disk (e.g., using an encrypted or system-protected store if required).  
   - Provide a React-based settings page.

10. **Robust Error Handling & Notifications**  
    - Handle microphone denial, API errors, no internet, etc.  
    - Offer user feedback via subtle notifications and audible cues.  
    - Verify reliability (auto-restart if crash, etc.).

11. **Deployment**  
    - Configure build scripts for macOS packaging (e.g., using `electron-builder`).  
    - Test the `.dmg` or `.pkg` distribution flow.

---

## 2. **Iterative Chunking**

**Chunk A**: Project Skeleton & Testing  
- Create Electron + React skeleton.  
- Integrate Jest (or preferred testing framework) with a basic test.  

**Chunk B**: Hotkey & Audio Capture  
- Implement `globalShortcut` for `Fn` keys.  
- Add audio capture library.  
- Test capturing raw audio data.  

**Chunk C**: Basic Transcription (Stub)  
- Create a transcription function that simply returns fake transcribed text for now.  
- Write tests verifying the system triggers transcription and processes results.  

**Chunk D**: Real Transcription (OpenAI Whisper)  
- Replace the stub with actual API calls.  
- Ensure error handling if API fails.  
- Store recent transcriptions locally.  

**Chunk E**: Text Processing & Cleanup  
- Auto-punctuation, filler word filtering, paragraph breaks, etc.  
- Test correctness of these text transformations.  

**Chunk F**: AI Command Detection & Response Integration  
- Detect trigger words, handle GPT calls, replace text in active field.  
- Provide fallback pop-up if no active field.  
- Write tests ensuring correct AI invocation and response handling.  

**Chunk G**: Settings & Configuration  
- Create UI to store API key, model, custom trigger word.  
- Verify data is stored locally.  
- Add a test ensuring settings persist across restarts.  

**Chunk H**: Error Handling & Notifications  
- All relevant edge cases (microphone denial, internet down, etc.).  
- Display notifications.  

**Chunk I**: Final Integration & Packaging  
- Connect all functionalities.  
- Thorough end-to-end tests.  
- Package for macOS distribution.  

---

## 3. **Refined Step-by-Step**

1. **Create Project & Basic File Structure**  
2. **Configure Build Tools & Launch Scripts**  
3. **Add Minimal Electron Main Process**  
4. **Add Minimal React Renderer**  
5. **Install and Configure Jest (Or Another Testing Framework)**  
6. **Write a Basic “App Opens” Test**  
7. **Register Global Hotkey (Test with Logging)**  
8. **Integrate Audio Capture (Log raw data in console)**  
9. **Stub Transcription Function (Return Hardcoded String)**  
10. **Write Tests for Stub Transcription**  
11. **Replace Stub with Whisper API**  
12. **Add Error Handling for Whisper**  
13. **Store Transcription History**  
14. **Implement Text Processing (Filler Word Removal, Auto-Punctuation)**  
15. **Test Text Processing**  
16. **Detect AI Commands & GPT Integration**  
17. **Pass Clipboard/Highlighted Text to GPT**  
18. **Insert GPT Response in Active Text Field**  
19. **Add Settings UI**  
20. **Add Notifications & Edge Cases**  
21. **Full Integration Tests**  
22. **Bundle & Package for macOS**  

---

## 4. **Prompts for a Code-Generation LLM**

Below is a sequence of prompts you can feed into a code-generation LLM. Each prompt focuses on a small, well-defined goal. The code generator’s responses to these prompts should be reviewed and tested before moving on.

### **Prompt 1**: Project Initialization & Basic Setup

````text
You are building a dictation and AI-assisted writing tool in Electron + React + Node.js. 

**Goal**: Set up a new Electron + React application with a minimal working structure and testing.

**Requirements**:
1. Initialize a new project (using your preferred boilerplate or from scratch).
2. Create a `main.js` or `electron.js` that launches an Electron BrowserWindow.
3. Create a `renderer/` directory that holds a simple React app (one component that displays "Hello World").
4. Install and configure Jest (or another test framework) with at least one test verifying that the app starts up successfully.
5. Provide scripts in `package.json` for:
   - Building the React app
   - Starting the Electron app
   - Running tests

**Output**:
- The complete file structure.
- All necessary code in each file (no placeholders).
- A short explanation of each file's purpose.
- Confirm that the React app renders in the Electron window.

Please generate fully working code (do not truncate).

Prompt 2: Global Hotkey & Audio Capture Setup

We have a working Electron + React structure and a basic test setup. Next, we want to implement the global hotkey binding (for the Fn key) and set up audio capture.

**Goal**:
1. Register the `Fn` key shortcuts using Electron's `globalShortcut` or an alternative approach if the OS key codes differ.
2. Integrate a microphone capture library (`node-record-lpcm16` or similar).
3. Log any captured audio data (binary or text) to the console when recording is active.

**Requirements**:
- Modify the main process to register the hotkey on app ready.
- A minimal UI indicator (e.g., a console log or React state) that shows when recording starts/stops.
- Jest tests to confirm that:
  - The globalShortcut is registered on app start.
  - Audio capture starts and stops correctly.

**Output**:
- Updated `main.js` with global shortcut registration.
- Updated React component that can show "Recording..." state.
- Tests confirming the shortcuts are registered and the audio capture toggles as intended.

Generate the complete updated code and tests.

Prompt 3: Stubbed Transcription Function

Now that audio capture is in place, create a stubbed transcription function to simulate converting audio data to text. We will not call OpenAI Whisper yet; just return a fixed string, "This is a stub transcription." 

**Goal**:
1. Create a new module, `transcriptionService.js`, that exports a `transcribeAudio` function.
2. Inside `transcribeAudio`, just return the string "This is a stub transcription." 
3. In the main process or a controller, whenever audio capture ends, call `transcribeAudio` and store the result in a React state (or log to console).
4. Write a Jest test that ensures `transcribeAudio` returns the stub text and that it’s called when recording stops.

**Output**:
- `transcriptionService.js` with the stub.
- Updated code to invoke `transcribeAudio` when recording ends.
- Jest test verifying the stub.

Generate complete code, including test files, ensuring nothing is truncated.

Prompt 4: Replace Stub with Whisper API Integration

We have a stubbed transcription. Next, integrate the OpenAI Whisper API.

**Goal**:
1. In `transcriptionService.js`, replace the stub with an actual call to the OpenAI Whisper API.
2. Add error handling for network failures or invalid API keys.
3. Ensure that the transcription result is stored or displayed in the UI.
4. Write/update tests to confirm:
   - A successful API call returns valid text (can be mocked in tests).
   - Errors are handled gracefully (e.g., show a console warning or UI alert).

**Output**:
- Updated `transcriptionService.js` with real Whisper calls.
- Any added configuration for storing the OpenAI API key (in a config file or environment variable).
- Tests for success and failure scenarios.

Include all code in full, including how the tests mock the Whisper API.

Prompt 5: Text Processing (Auto-Punctuation, Filler Word Filtering)

We can now transcribe audio. Next, implement text cleanup routines:

**Goal**:
1. Auto-punctuate transcribed text. A simple heuristic is sufficient (e.g., if there's a pause or sentence break).
2. Remove filler words ("uh", "um", "like").
3. Handle self-corrections. For example, if the user says "three, I mean four cups," the final text should read "four cups."
4. Insert paragraph breaks on longer pauses or other heuristics.
5. Write unit tests for each of these text processing features, verifying correctness on sample strings.

**Output**:
- A `textProcessing.js` module with functions for:
  - `autoPunctuate`
  - `filterFillerWords`
  - `handleSelfCorrections`
  - `insertParagraphBreaks`
- Integration code that applies these functions to the final transcribed text before displaying.
- Tests verifying each text transformation with sample input -> expected output.

Generate the code and tests in full.

Prompt 6: AI Command Detection & GPT Integration

We now have functional transcription and text processing. We want to detect AI commands and integrate GPT-4o responses.

**Goal**:
1. Detect if the user’s first word is the trigger (default "Juno") OR if the first two words contain certain action verbs (like "Summarize").
2. If an AI command is detected:
   - Collect highlighted text + clipboard contents.
   - Send the entire prompt to GPT (OpenAI API).
   - Return the GPT response.
3. If the user says "Transcribe the following..." it should always do normal transcription (no AI).
4. Replace highlighted text with GPT response if there is a highlight, otherwise insert response into the current text field. If no text field, show a pop-up with a “Copy to Clipboard” button.
5. Write tests for:
   - AI trigger detection logic.
   - Proper GPT calls with relevant context.
   - Fallback behavior with pop-up when no active field.

**Output**:
- Code that extends the transcription flow to branch into AI logic when triggered.
- A new `aiService.js` or similar module that handles GPT calls.
- Tests covering the detection logic, GPT calls, and fallback path.

Generate all updated files in full, including test code.

Prompt 7: Settings & Configuration

We now need a settings interface for the user. This includes the AI trigger word, API key, model, temperature, etc.

**Goal**:
1. Create a React Settings page accessible from the tray or main window menu.
2. Store user preferences (in JSON or a local DB) for:
   - OpenAI API Key
   - Trigger Word (default "Juno")
   - AI Model (default GPT-4o)
   - Temperature
   - Possibly more (like startup behavior, microphone selection)
3. Provide a “save” function that updates the stored config and notifies relevant services (e.g., reload the key).
4. Add tests to confirm preferences persist across app restarts.

**Output**:
- React components for viewing/editing settings.
- A small local config storage module (e.g., `configService.js`).
- Unit/integration tests verifying data persistence.

Include all relevant code and instructions for hooking the UI to the storage.

Prompt 8: Error Handling & Notifications

We want robust error handling. Implement notifications or audible feedback.

**Goal**:
1. If the OpenAI API request fails, show a subtle notification and play an error sound.
2. If the user denies mic access, prompt them for system permissions.
3. If the app crashes, attempt to auto-restart.
4. Cancel any ongoing AI request if a new dictation starts.
5. Provide tests verifying:
   - Notification on API error
   - Graceful handling of mic denial
   - Auto-restart logic (can be tested via mocking app relaunch calls)

**Output**:
- Updated main/renderer code for notifications (e.g., `new Notification(...)` in Electron or a library).
- Tests for each error scenario.

Generate the complete code changes and tests.


## **Prompt 9: Transcription History & Storage**

We have transcription working. Now we need to store and manage recent transcriptions and provide a way to review them.

**Goal**:
1. Maintain a history of the last 10 transcriptions in local storage (JSON file or SQLite).
2. Provide a minimal UI (in React) that lists the recent transcriptions.
3. Allow users to clear the history or remove individual entries.
4. Write Jest tests to confirm:
   - Transcription records are added in chronological order.
   - Only the latest 10 are preserved.
   - Deletion/clearing logic works correctly.

**Output**:
- All relevant code (services, UI components, tests).
- A clear description of how and where transcriptions are stored.

---

## **Prompt 10: User Dictionary & Custom Word Corrections**

We have text processing for auto-punctuation, filler words, etc. Let’s add a user-maintained dictionary for corrections.

**Goal**:
1. Implement a local JSON file (e.g., `userDictionary.json`) where users can add “incorrect → correct” mappings (e.g., if “Jhon” is often misheard, map it to “John”).
2. Extend the text processing to replace occurrences of these words after filler word removal, self-correction handling, etc.
3. Provide a simple React UI to let users add/remove entries in the dictionary.
4. Write unit tests verifying that recognized words get replaced according to the dictionary.

**Output**:
- `dictionaryService.js` (or similar) that loads/saves mappings.
- Updated text processing code that applies user-defined replacements.
- UI components to manage dictionary entries, plus tests.

---

## **Prompt 11: Inline AI Editing & Text Insertion Logic**

Our AI commands can return GPT responses, but we need to finalize how text is inserted or replaced in the active text field.

**Goal**:
1. Detect if the user has highlighted text in the active field:
   - If so, replace that highlighted text with the AI output.
2. If no text is highlighted, insert the AI output at the cursor position in the active field (using `robotjs` or similar).
3. If no active field is found, show the pop-up with a “Copy to Clipboard” button.
4. Confirm the logic for the special phrase “Transcribe the following…” (it should bypass AI).
5. Write tests to ensure:
   - Highlight detection triggers replacements correctly.
   - Correct insertion at the cursor.
   - Proper fallback to pop-up when no active field.

**Output**:
- All updated code showing how highlighted text is detected and replaced.
- The fallback pop-up code.
- Test coverage for each insertion scenario.

---

## **Prompt 12: Microphone Selection & Device Management**

We currently use the system default microphone. We want to let users choose a mic from settings.

**Goal**:
1. Enumerate available audio input devices (using a Node library or relevant OS calls).
2. Extend the Settings UI to display a dropdown of devices.
3. On selection, store the user’s mic choice in the config file and use it for dictation.
4. Write tests verifying:
   - The list of devices is fetched and displayed.
   - The chosen device is persisted across app restarts.

**Output**:
- Updated settings UI code and any device enumeration logic.
- Code changes to apply the selected microphone to `node-record-lpcm16` or equivalent.
- Tests covering enumeration, selection, and persistence.

---

## **Prompt 13: Auto-Launch at System Startup & Crash Recovery**

The specification requires the app to auto-start at login and restart after crashes.

**Goal**:
1. Add code to enable “launch at login” on macOS:
   - Use Electron APIs, AppleScript, or `electron-builder` configuration to register the app as a login item.
2. Implement a simple crash detection:
   - On crash, auto-restart the app (e.g., a master process that respawns the main Electron process).
3. Write tests (or describe manual steps) to confirm:
   - The app appears in “Login Items” (macOS).
   - The app restarts on unexpected exit.

**Output**:
- Configuration details for auto-start (e.g., in `package.json` or build scripts).
- Crash recovery code (if using a secondary watcher process or a built-in approach).
- Any relevant test or manual test instructions.

---

## **Prompt 14: Final Packaging & Mac Distribution**

We need a distributable version for macOS.

**Goal**:
1. Use `electron-builder` or similar to create a `.dmg` or `.pkg` installer.
2. Include code-signing (optional, if you have a developer certificate).
3. Provide instructions for building and distributing the app.
4. Confirm that the final package runs the entire feature set out of the box.

**Output**:
- Updated `package.json` scripts for `dist` or `build`.
- Any necessary configuration in `electron-builder.yml` or equivalents.
- Steps to sign the app if applicable, plus a final `.dmg` creation workflow.

---

## **Prompt 15: Performance & Resource Usage Tuning**

We want a lightweight background process that does not strain the system.

**Goal**:
1. Optimize the Electron app so it uses minimal CPU when idle.
2. Load only necessary modules when needed (dynamic imports if required).
3. Ensure that transcription/AI tasks do not block the UI. Consider spawning worker processes for heavy tasks if needed.
4. Provide tests or logs showing average CPU/RAM usage during idle and during active dictation.

**Output**:
- Code or config changes illustrating optimizations (lazy loading, worker processes, etc.).
- Explanation of how to measure performance, e.g., using Electron’s built-in profiling or external tools.
- Any test or measurement results demonstrating improvement.

---

## **Prompt 16: Final Integration & Acceptance Testing**

We now bring everything together to verify the end-to-end flow.

**Goal**:
1. Perform a full integration test:
   - Launch the app.
   - Start dictation.
   - Confirm transcription, text processing, and insertion into a text field.
   - Trigger an AI command and verify GPT output insertion/replacement.
   - Use the settings page to change the microphone, AI model, etc.
   - Check error notifications (simulate API failure).
   - Restart the app; confirm settings persist and auto-launch works.
2. If feasible, automate these flows using a test runner like Spectron or Playwright for Electron.
3. Provide a final readiness checklist:
   - All required features implemented.
   - All tests passing.

**Output**:
- Instructions or scripts for running the full integration test.
- Documentation of test results and final readiness status.

---

## **Next Steps**

Use each prompt above (9–16) to guide your AI through the final stages of development. For each prompt, request **full updated code** (no truncation), including tests, configurations, and any UI changes required. This process ensures all specification items are completed and thoroughly tested.