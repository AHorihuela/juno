# Changelog

All notable changes to the Juno project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Documentation index file for easier navigation
- More detailed installation and setup instructions
- Improved text insertion reliability
- Enhanced selection handling

### Changed
- Refactored WindowManager to consolidate window management functionality
- Refactored RecorderService into modular components:
  - MicrophoneManager for device handling
  - AudioLevelAnalyzer for audio processing
  - BackgroundAudioController for media control
- Updated documentation to reflect architectural changes

### Fixed
- Fixed AI command detection issues with trigger word "Juno" and action verbs
- Fixed notification service methods to properly show notifications
- Fixed audio feedback service to enable audio playback by default
- Improved error handling in audio processing
- Fixed memory leaks in window management
- Fixed AIService module export pattern

## [1.0.0] - 2024-02-25

### Added
- Initial release of Juno AI Dictation Assistant
- Real-time speech-to-text transcription using OpenAI's Whisper
- AI assistance with GPT-4 and GPT-3.5 Turbo
- Custom dictionary for accurate transcription
- Configurable trigger words and action verbs
- Cross-platform support (macOS, Windows, Linux) 