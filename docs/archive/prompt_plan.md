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
