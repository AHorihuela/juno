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


## **Prompt 10: User Dictionary & Custom Word Corrections**

We have text processing for auto-punctuation, filler words, and self-corrections. Let’s add a user-maintained dictionary that automatically replaces misheard words with correct versions.

### **Goal & Expanded Requirements**
1. **Local JSON File**  
   - Create a file, for example `userDictionary.json`, that stores user-defined mappings of `incorrect → correct`.
     - Example entry: `"Jhon": "John"`.
   - The dictionary might be loaded at startup and cached in memory for quick lookups.
   - Ensure safe read/write operations:
     - Use file locking or a short read-then-write cycle to avoid concurrency issues.
     - Consider using a small library (like `fs-extra` or Node’s native `fs` with caution).

2. **Extended Text Processing**  
   - Integrate these replacements **after** filler word removal and self-corrections but **before** final output.
   - Decide on matching rules:
     - **Case sensitivity**: Will “jhon” or “JHON” also be replaced by “John”?  
       Typically, you might normalize everything to lowercase before matching, then restore capitalization if needed.
     - **Word boundaries**: Only replace whole words, not substrings within a larger word.
     - Ensure punctuation does not disrupt replacements. For instance, “Jhon.” → “John.”  

3. **React UI for Management**  
   - Provide a simple user interface for:
     - **Viewing** existing dictionary entries (e.g., a list).
     - **Adding** a new mapping (`incorrectWord` and `correctWord` fields).
     - **Removing** or **editing** existing mappings.
   - Consider real-time validation (e.g., ensuring no empty keys).

4. **Tests**  
   - **Unit tests** for the text processing module verifying:
     - Single-word replacements
     - Multiple replacements in a sentence
     - Collision scenarios (two entries for the same incorrect word)
   - **UI tests** verifying:
     - Adding and removing entries updates the JSON file
     - Re-loading the app preserves changes
     - Replacements occur in the final transcription output

### **Potential Pitfalls & Best Practices**
- **Encoding Issues**: Ensure the JSON file is always written with UTF-8 encoding.
- **Performance**: If the dictionary grows large, consider indexing by first letter or using a more efficient data structure. (Likely overkill for typical usage, but worth noting.)
- **Collision Resolution**: Decide how to handle multiple entries for the same key or if that should be disallowed.

### **Expected Output**
- A `dictionaryService.js` (or similar) that:
  - Loads/saves the dictionary from a local JSON file.
  - Provides functions for adding/removing/updating dictionary entries.
- Updated text processing logic that calls the dictionary replacement function after filler/self-correction logic.
- React UI components (Settings or a dedicated page) for managing dictionary entries.
- Tests covering dictionary usage and UI integration.

---

## **Prompt 11: Inline AI Editing & Text Insertion Logic**

Our AI commands can return GPT responses, but we need to finalize how those responses are inserted or replaced in the active text field.

### **Goal & Expanded Requirements**
1. **Detect Highlighted Text**  
   - On macOS, a user might highlight text in an app (e.g., a text editor). We need to:
     - Check via `robotjs` or an Electron API if there is a selection or highlighted portion in the active window.
     - If a selection exists, **replace** that selection in-place with the AI-generated text.

2. **Insert at Cursor if No Highlight**  
   - If there is no selected text, the AI output should be inserted at the **current cursor position**.
   - In many scenarios, we can achieve this with `robotjs.typeString()` or equivalent. However, be mindful of:
     - Handling special characters or newlines.
     - Potential issues with hidden fields or fields that do not accept typed input programmatically.

3. **Fallback Pop-up**  
   - If no active text field is detected at all (e.g., no focusable window or user is on the desktop):
     - Show a small popup or modal with the AI response and a “Copy to Clipboard” button.
     - Allow the user to manually paste it wherever they need.

4. **“Transcribe the following…” Exception**  
   - If the user starts the phrase with “Transcribe the following…”, always do normal transcription. Bypass the AI logic entirely.

5. **Tests**  
   - **Highlight Detection**: Confirm that if text is highlighted, the correct region is replaced.
   - **Cursor Insertion**: Confirm insertion works as expected for single-line and multi-line text fields.
   - **Fallback**: Confirm the pop-up appears when there is no active field.
   - **Exception Handling**: Confirm that “Transcribe the following…” always yields a normal transcription.

### **Potential Pitfalls & Best Practices**
- **OS-Specific Shortcuts**: On macOS, the `Fn` key might have different scancode behavior vs. Windows. Carefully test.
- **Clipboard Permissions**: In some OS contexts, copying to the clipboard may require additional permissions or asynchronous handling.
- **Rate-limiting**: If the user triggers multiple AI commands rapidly, ensure that text insertion tasks don’t step on each other.

### **Expected Output**
- Updated code in the main or a dedicated “AI insertion” module to handle insertion logic.
- UI or small modal component for fallback display.
- Test coverage verifying each insertion scenario.

---

## **Prompt 12: Microphone Selection & Device Management**

Currently, we use the system default microphone. We want users to pick a microphone if they have multiple input devices.

### **Goal & Expanded Requirements**
1. **Enumerate Available Devices**  
   - Use a suitable library or OS call to list available audio input devices.  
   - `node-record-lpcm16` can sometimes list devices, or you might rely on system calls (e.g., `arecord -l` on Linux, or platform-specific APIs on macOS/Windows).

2. **Settings UI**  
   - Display a dropdown/select in the app’s Settings to choose from the enumerated devices.
   - Provide a “Default System Mic” option as a fallback.

3. **Persist & Apply Selection**  
   - Store the chosen device ID or name in your app’s config (JSON or local DB).
   - On next app launch (or immediately upon selection), the transcription should use that device.

4. **Tests**  
   - **Device Enumeration**: Mock the device listing to ensure correct rendering in the dropdown.
   - **Persistence**: Confirm that switching microphones updates the config and is retained after restart.
   - **Edge Cases**: If the selected mic is disconnected or becomes unavailable, fallback gracefully to system default or alert the user.

### **Potential Pitfalls & Best Practices**
- **Platform Differences**: Different OSes represent device names differently. Test on macOS specifically.
- **Access Permissions**: Some macOS versions require explicit user permission for each input device.
- **Real-Time Switching**: Decide if the user can switch mics mid-recording or if changes only take effect after stopping.

### **Expected Output**
- Updated settings UI with a microphone selector.
- Underlying code that enumerates devices and updates the recording library to use the chosen device.
- Tests confirming correct enumeration, selection, and persistence.

---

## **Prompt 13: Auto-Launch at System Startup & Crash Recovery**

The specification requires the app to start when the user logs in, and to auto-restart after crashes.

### **Goal & Expanded Requirements**
1. **Launch at Login on macOS**  
   - Use **electron-builder** `mac` configuration or AppleScript calls (if not building with electron-builder).
   - Alternatively, you can use the system’s “Login Items” approach via `app.setLoginItemSettings()` in Electron.
   - Provide a toggle in Settings for enabling/disabling auto-launch if desired.

2. **Crash Detection & Auto-Restart**  
   - Option 1: A secondary “watcher” process that monitors the main Electron process. If the main process quits unexpectedly (exit code != 0), re-launch it.
   - Option 2: A robust error boundary in the main process that attempts to recover or re-launch internally.

3. **Testing**  
   - Manually confirm (or script) that after installation, the app appears in **System Settings → Login Items** (on macOS).
   - Simulate or force a crash by throwing an unhandled exception, verifying the app restarts automatically.

### **Potential Pitfalls & Best Practices**
- **User Experience**: Some users may not want an app to automatically start. Consider making auto-launch opt-in.
- **Infinite Loop Risk**: If the app consistently crashes on startup, you could get into a crash-restart loop. Provide a failsafe (e.g., disable auto-restart after a certain threshold).
- **Code Signing**: Some macOS settings for login items might require the app be code signed.

### **Expected Output**
- Updated build or app config to include “launch at login” logic.
- Crash recovery approach (a watcher script or Electron-based solution).
- Testing or documentation describing how to verify these features.

---

## **Prompt 14: Final Packaging & Mac Distribution**

We need a distributable version for macOS, likely as a `.dmg` or `.pkg` installer.

### **Goal & Expanded Requirements**
1. **Build with `electron-builder`**  
   - Configure `package.json` to define your mac build target. For example:
     ```json
     "build": {
       "appId": "com.example.dictationtool",
       "mac": {
         "category": "public.app-category.productivity",
         "icon": "assets/icon.icns"
       }
       // ...
     }
     ```
   - A script like `"dist": "electron-builder --mac dmg"` to generate the `.dmg`.
2. **Code-Signing** (Optional)  
   - If you have a Developer ID certificate, configure `electron-builder` to sign the app automatically.
   - This prevents “unidentified developer” warnings on macOS.

3. **Instructions for Building & Distributing**  
   - Document the steps:  
     1. Install dependencies.  
     2. Run `npm run build` or `yarn build` for the React app.  
     3. Run `npm run dist` or `yarn dist` to build the Electron package.  
   - Provide guidance for distributing the `.dmg` or `.pkg` to users (e.g., direct download, private hosting, etc.).

4. **Validation**  
   - Confirm the final app runs without requiring external dependencies.
   - Ensure microphone permissions and accessibility permissions (for keystrokes) are requested automatically.

### **Potential Pitfalls & Best Practices**
- **Notarization**: For macOS 10.15+ (Catalina and above), Apple typically requires notarization. This is separate from code signing but integrated in `electron-builder`.
- **File Paths**: Ensure your app uses relative or dynamic paths for storing user settings so they work in production.

### **Expected Output**
- An updated `package.json` with build configurations.
- Any `electron-builder.yml` or `.json` file specifying mac targets.
- Documentation on how to create a `.dmg` and sign/notarize it.

---

## **Prompt 15: Performance & Resource Usage Tuning**

We want the app to be lightweight, especially when idle in the background.

### **Goal & Expanded Requirements**
1. **Minimize Idle CPU Usage**  
   - Keep watchers, timers, or background tasks to a minimum when the user is not actively dictating.
   - For instance, do not poll for mic input until the user presses the hotkey.

2. **Dynamic/Lazy Loading**  
   - Only import modules like `openai` or certain heavy libraries at the moment they’re needed, rather than at startup.
   - This can reduce memory footprint at idle.

3. **Offload Heavy Tasks**  
   - Consider running Whisper and GPT queries in separate processes or threads (worker processes) to avoid blocking the main UI thread.
   - This ensures smooth UI performance even during heavy AI operations.

4. **Measure and Optimize**  
   - Use built-in Electron profiling or external tools (Activity Monitor on macOS) to track CPU and memory usage.
   - Provide logging or test metrics to show usage during:
     - Idle mode
     - Active dictation
     - AI requests

5. **Tests & Logs**  
   - Document how to run performance tests or gather logs.
   - If possible, automate a script that:
     1. Starts the app.
     2. Waits idle for X seconds, logs CPU/memory usage.
     3. Initiates a transcription, logs usage.
     4. Initiates an AI call, logs usage.

### **Potential Pitfalls & Best Practices**
- **Unintentional Listeners**: Be sure that no event listeners (like `globalShortcut`) cause frequent CPU spikes.  
- **Worker Lifecycle**: If you spawn worker processes, ensure they are properly terminated when no longer needed.

### **Expected Output**
- Code or config changes illustrating lazy loading or modularization.
- Worker process or thread code if used.
- Documented approach (or scripts) for measuring performance and final results.

---

## **Prompt 16: Final Integration & Acceptance Testing**

We now bring everything together for a comprehensive end-to-end check of **all** features.

### **Goal & Expanded Requirements**
1. **Full Integration Test Flow**  
   - **Launch the app** and confirm it starts in the background/tray.
   - **Start dictation**: Press the designated hotkey and speak a short sentence.
     - Confirm transcription accuracy, filler word removal, auto-punctuation, user dictionary corrections.
   - **Trigger an AI command**: e.g., “Juno, summarize this.” 
     - Confirm GPT gets invoked, highlighted text is replaced or appended.
   - **Settings**: Change microphone, change AI model, change trigger word, etc. 
     - Confirm the changes persist after an app restart.
   - **Error Simulation**: Provide invalid OpenAI key or no internet to ensure the error notification appears.
   - **Auto-launch**: Restart the machine or log out/in to verify the app auto-launches.
   - **Crash Recovery**: Force a crash; confirm the app restarts automatically.

2. **Automated Testing Tools**  
   - If feasible, use **Spectron**, **Playwright**, or **Cypress** with an Electron plugin to script these flows.  
   - Otherwise, provide manual test steps with checklists.

3. **Final Readiness Checklist**  
   - All features are present and validated:
     - Dictation, AI, error handling, user dictionary, settings, auto-launch, packaging, etc.
   - All tests (unit, integration, UI) pass without flakiness.
   - Documentation is complete for building, installing, and using the app.

### **Potential Pitfalls & Best Practices**
- **User Variation**: Different user accents or speech patterns may reveal issues in transcription or dictionary logic.  
- **Consent & Privacy**: Ensure microphone usage disclaimers or OS prompts are handled gracefully.

### **Expected Output**
- Scripts or instructions to run these final tests (manual or automated).
- A final test report or summary of coverage and results.

---

## **How to Use These Prompts**

For each prompt (10–16):

1. **Provide the LLM (or developer)** with the entire expanded prompt.
2. **Request full, updated code** (no truncation) that implements all requirements, including UI changes and tests.
3. **Review and refine** the generated code to ensure real-world correctness (e.g., verifying that OS-level integrations like microphone enumeration and login items behave as expected on macOS).
4. **Iterate** until all features match the specification.

This structured approach ensures a smooth path to completing the **Dictation & AI-Assisted Writing Tool** while minimizing bugs and edge-case failures.
