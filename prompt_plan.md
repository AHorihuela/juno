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

Prompt 9: Final Integration & Packaging

We have all the main functionality. Let’s do final wiring and packaging.

**Goal**:
1. Ensure all components are connected in a coherent flow:
   - Recording and transcription trigger the text processing steps.
   - AI commands are detected and GPT calls are made.
   - Responses are inserted into active fields or displayed in a pop-up.
   - Settings are saved and loaded properly.
2. Perform an end-to-end test verifying dictation -> AI response -> insertion into a text field.
3. Configure `electron-builder` or a similar tool to package the app for macOS (`.dmg`).
4. Provide final instructions on how to build, test, and run the app.

**Output**:
- A final consolidated codebase.
- Packaging config (e.g., in `package.json` or `electron-builder.yml`).
- End-to-end test scripts and instructions.

Generate the complete integrated code, ensuring no orphan code remains.

5. How to Use These Prompts
	1.	Copy each prompt (in order) into your chosen code-generation LLM.
	2.	Review the generated code carefully.
	3.	Run tests and ensure everything passes.
	4.	Iterate to fix any issues or refine as needed.
	5.	Proceed to the next prompt once you are satisfied with the current step.

This sequence of prompts should yield a stable, test-driven approach to building the dictation & AI-assisted writing tool.

