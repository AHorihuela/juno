# Juno Application Functional Specification

## Core Use Cases

### 1. Basic Transcription (No AI)
- **Trigger**: User double-taps shortcut key and speaks
- **Process**: Direct speech-to-text conversion 
- **Goal**: Maximum speed, minimal latency
- **Output**: Verbatim text inserted at cursor position
- **UI Elements**: 
  - Start/stop sounds
  - Overlay animation showing recording state
  - Visual feedback for audio levels

### 2. AI Command Processing

#### Trigger Method A - Keyword ("Juno")
- **Trigger Rule**: Word "Juno" appears within the first THREE words of transcription
  - Examples: "Juno help me", "Hey Juno write", "Can Juno please"
- **Process**: 
  - Transcribe speech
  - Detect "Juno" trigger within first three words
  - Send command to OpenAI
- **Output**: AI-generated response replaces transcription

#### Trigger Method B - Action Verbs
- **Trigger Rule**: Transcription begins with a user-configured action verb
- **Action Verbs**: User-defined list configured in application settings
  - Common examples: "summarize", "rewrite", "translate", "improve"
- **Context Awareness**: 
  - If text is highlighted, that text is sent as context with the command
  - Example: User highlights an email, says "improve this writing"
- **Process**:
  - Transcribe speech
  - Detect action verb at beginning of transcription
  - Capture highlighted text (if any)
  - Send both command and highlighted text to OpenAI
- **Output**: AI-generated response replaces highlighted text or is inserted at cursor

## Technical Architecture

### Recording Pipeline
1. User triggers recording via shortcut
2. System captures audio via microphone
3. Audio is buffered in memory
4. User stops recording via shortcut
5. System processes audio buffer

### Transcription Pipeline
1. Audio buffer is converted to WAV format
2. Whisper API is called for transcription
3. Transcribed text is post-processed:
   - Dictionary word substitution
   - Punctuation normalization
   - Filler word removal

### AI Processing Pipeline
1. System detects if transcription is an AI command
2. If AI command:
   - Retrieve context (highlighted text)
   - Build prompt combining command and context
   - Call OpenAI API
   - Format and insert response
3. If not AI command:
   - Insert transcribed text directly

## Performance Considerations

- Recording initialization should be near-instantaneous
- Complete transcription pipeline should complete in under 2 seconds
- UI feedback should be minimal and non-blocking
- Operations should be parallelized where possible

## Error Handling

- Graceful degradation when no internet connection
- Clear user feedback when speech wasn't detected
- Fallback to transcription if AI processing fails 