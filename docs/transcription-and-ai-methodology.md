# Transcription and AI Interaction Methodology

## Overview
This document outlines how Juno handles transcription of spoken text and determines when to engage the AI for text processing. The system uses a combination of OpenAI's Whisper API for transcription and GPT-4 for AI text processing.

## Transcription Flow

### 1. Audio Recording
- Audio is recorded at 16kHz with 16-bit depth and single channel (mono)
- Recording starts with Command+Shift+Space (double tap)
- Recording stops with either:
  - Command+Shift+Space (single tap)
  - Escape key
- Audio is analyzed in real-time to detect silence/speech

### 2. Basic Transcription
When the recording contains actual speech content (not just silence), the audio is:
1. Converted to WAV format
2. Enhanced with dictionary-based prompting for better accuracy
3. Sent to OpenAI's Whisper API
4. Processed through our text processing pipeline

## AI Interaction

### Trigger Conditions
The system checks for AI commands using two methods:

1. **Trigger Word Detection**
   - First 3 words are checked for the trigger word (default: "Juno")
   - Trigger word can be preceded by greetings: "hey", "hi", "hello", "yo", "ok", "okay", "um", "uh"
   - Example: "Hey Juno, summarize this"

2. **Action Verb Detection**
   - First two words are checked for action verbs
   - Action verbs include: summarize, explain, analyze, rewrite, translate, improve, simplify, elaborate, fix, check, shorten, expand, clarify, write, update, modify, edit, revise, make
   - Example: "Summarize this text"

### Context Gathering
When an AI command is detected, the system gathers context in the following order:

1. **Primary Context**
   - Selected/highlighted text (if any) becomes primary context
   - If no text is selected, recent clipboard content (within 30 seconds) becomes primary context

2. **Secondary Context**
   - If primary context is highlighted text, recent clipboard content becomes secondary context
   - Secondary context is only included if different from primary context

### Special Context Handling
Some commands ("dual context verbs") treat both contexts as equally important:
- compare
- contrast
- differentiate
- merge

For these commands, both contexts are presented to the AI without hierarchy.

## AI Response Processing

### System Instructions
The AI is instructed to:
- Output ONLY the processed text
- Avoid explanations, greetings, or commentary
- Never include phrases like "here's the text" or "I can help"
- Provide direct output without markdown formatting or code blocks

### Response Handling
1. AI response is cleaned to remove any formatting
2. Response is inserted into the active text field
3. If there was highlighted text, it is replaced with the AI response

## Text Processing Pipeline
For non-AI commands, transcribed text goes through:
1. Dictionary processing (custom word replacements)
2. Filler word filtering
3. Self-correction handling
4. Automatic punctuation
5. Paragraph break insertion

## Logging and Monitoring
The system maintains detailed logs of:
- Audio metrics (RMS, peak levels, speech detection)
- Dictionary effectiveness (exact/fuzzy match rates)
- Context gathering results
- AI command detection
- Text processing steps

This logging helps in debugging and improving the system's accuracy over time. 