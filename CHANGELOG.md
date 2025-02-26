# Changelog

All notable changes to the Juno project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Critical path testing script (`npm run test:critical`)
- Comprehensive architecture documentation

### Changed
- Refactored WindowManager to consolidate window management functionality
- Refactored RecorderService into modular components:
  - MicrophoneManager for device handling
  - AudioLevelAnalyzer for audio processing
  - BackgroundAudioController for media control
- Updated documentation to reflect architectural changes

### Fixed
- Improved error handling in audio processing
- Fixed memory leaks in window management

## [1.0.0] - 2024-02-25

### Added
- Initial release of Juno AI Dictation Assistant
- Real-time speech-to-text transcription using OpenAI's Whisper
- AI assistance with GPT-4 and GPT-3.5 Turbo
- Custom dictionary for accurate transcription
- Configurable trigger words and action verbs
- Cross-platform support (macOS, Windows, Linux) 