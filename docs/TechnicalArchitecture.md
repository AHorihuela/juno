# Juno Technical Architecture & Optimization Strategy

## Current Architecture

### Service Components
- **RecorderService**: Handles audio recording, microphone management, and UI feedback
- **TranscriptionService**: Processes audio into text, manages API calls to Whisper
- **AIService**: Detects commands, processes text with OpenAI API
- **AICommandDetector**: Detects trigger word and action verbs
- **TextInsertionService**: Handles inserting text into active applications
- **ContextService**: Manages highlighted text and application context

### Current Performance Bottlenecks

1. **Recording Initialization**
   - Sequential operations: permission checks, UI updates, audio setup
   - Delayed recorder start due to unnecessary blocked operations
   - Background audio checking adding latency

2. **Transcription Process**
   - Sequential file operations (converting PCM to WAV, writing temp files)
   - Synchronous API calls blocking the main thread
   - Excessive notifications and UI updates
   - Inefficient dictionary processing

3. **AI Command Detection**
   - Action verb detection failing with common prefixes like "please" or articles
   - Inconsistent handling of highlighted text
   - Extra context retrieval operations

4. **Text Insertion**
   - AppleScript execution timeouts (seen in logs)
   - Clipboard operations adding latency

5. **Multi-Instance Handling**
   - Error when detecting second instance: "mainWindowService.showMainWindow is not a function"

## Implemented Optimizations

### RecorderService Optimizations
- Parallelized initialization operations using Promise.all()
- Moved sound playback to happen concurrently with setup
- Improved background audio handling
- Streamlined overlay management

### TranscriptionService Optimizations
- Parallelized audio preparation and UI notifications
- Preloaded app name for faster text insertion
- Optimized API requests with better parameters
- Background cleanup operations

### AICommandDetector Improvements
- Added fallback action verb list when none configured
- Improved detection to handle articles and common prefixes
- Enhanced logging for troubleshooting

### AIService Enhancements
- Better highlighted text handling
- Improved prompt formatting
- Added detection for redundant responses

### TextInsertionService Optimizations
- Implemented precompiled AppleScript files for faster execution
- Added robust timeout handling with configurable limits
- Improved clipboard verification and recovery
- Added retry mechanism for AppleScript execution
- Enhanced error handling with user-friendly fallbacks
- Optimized delay times based on real-world testing
- Replaced exec with execFile for better security and performance

### SelectionService Optimizations
- Implemented parallel strategy execution as the default method
- Added timeout limits for both individual strategies and overall operations
- Increased cache TTL to reduce redundant selection operations
- Added cancellation support for long-running operations
- Improved fallback mechanisms when strategies fail
- Enhanced logging with detailed metadata
- Used improved AppNameProvider with better caching

### AppleScriptExecutor Improvements
- Added support for compiled script files for better performance
- Implemented proper error handling for timeout rejection
- Added maxBuffer parameter to handle large text selections
- Replaced exec with execFile for better security and performance
- Added script compilation capabilities for frequently used scripts
- Enhanced retry mechanisms with exponential backoff

## Future Optimization Opportunities

1. **Simplify UI Feedback**
   - Consider reducing animations/sounds for performance
   - Make UI elements optional or configurable

2. **Streamline Audio Processing**
   - Explore direct audio streaming to Whisper API
   - Consider in-memory processing without temp files

3. **Enhance Parallel Processing**
   - Convert more sequential operations to parallel
   - Use worker threads for CPU-intensive operations

4. **Improve Context Management**
   - Cache app context for repeated commands
   - Pre-fetch context during recording

5. **API Optimizations**
   - Implement streaming responses for faster feedback
   - Consider local models for basic transcription

## Performance Target Metrics

| Operation | Current Performance | Target Performance |
|-----------|---------------------|-------------------|
| Recording Start | ~600ms | <200ms |
| Transcription | 2-3 seconds | <1 second |
| AI Processing | 3-5 seconds | <2 seconds |
| Text Insertion | Variable | <500ms |

## Testing Strategy

1. **Performance Measurement**
   - Add precise timing logs at key points
   - Implement A/B comparison testing

2. **Functional Testing**
   - Test all trigger methods with various inputs
   - Verify highlighted text handling in different applications

3. **Error Handling**
   - Test graceful degradation on network failures
   - Verify recovery from permission issues 