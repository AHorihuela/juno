// REFACTORING OPPORTUNITY:
// This file could be split into multiple modules:
// 1. RecorderService.js - Core recording functionality
// 2. AudioLevelAnalyzer.js - Audio level detection and visualization
// 3. BackgroundAudioController.js - Background audio pausing/resuming
// 4. MicrophoneManager.js - Microphone permission and device handling

const { EventEmitter } = require('events');
const record = require('node-record-lpcm16');
const { systemPreferences, app } = require('electron');
const BaseService = require('./BaseService');

class RecorderService extends BaseService {
  constructor() {
    super('Recorder');
    this.recording = false;
    this.paused = false;
    this.recorder = null;
    this.audioData = [];
    this.hasAudioContent = false;
    this.silenceThreshold = 20;
    this.currentDeviceId = null;
    this.levelSmoothingFactor = 0.7;
    this.currentLevels = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    this.recordingStartTime = null;
    this.totalPausedTime = 0;
    this.pauseStartTime = null;
    this.backgroundAudioWasPaused = false;
  }

  async _initialize() {
    // Nothing to initialize yet
    console.log('RecorderService initialized');
  }

  async _shutdown() {
    if (this.recording) {
      await this.stop();
    }
  }

  async checkMicrophonePermission(deviceId = null) {
    if (process.platform === 'darwin') {
      const status = systemPreferences.getMediaAccessStatus('microphone');
      
      if (status === 'not-determined') {
        const granted = await systemPreferences.askForMediaAccess('microphone');
        if (!granted) {
          throw new Error('Microphone access denied');
        }
        return true;
      }
      
      if (status !== 'granted') {
        throw new Error('Microphone access denied');
      }

      // For macOS, we need to check if this specific device is accessible
      if (deviceId && deviceId !== 'default') {
        try {
          const { desktopCapturer } = require('electron');
          const sources = await desktopCapturer.getSources({
            types: ['audio'],
            thumbnailSize: { width: 0, height: 0 }
          });
          
          const deviceExists = sources.some(source => source.id === deviceId);
          if (!deviceExists) {
            throw new Error('Selected microphone is no longer available');
          }
        } catch (error) {
          console.error('Error checking device availability:', error);
          throw new Error('Failed to verify microphone access');
        }
      }
      
      return true;
    }
    
    return true;
  }

  /**
   * Tests microphone access by attempting to start a short recording
   * This is useful for detecting if microphones are available
   * @returns {Promise<boolean>} True if microphone access is available
   */
  async testMicrophoneAccess() {
    console.log('[Recorder] Testing microphone access...');
    
    try {
      // Check microphone permission first
      await this.checkMicrophonePermission();
      
      // Try to create a recorder instance
      const record = require('node-record-lpcm16');
      
      const recordingOptions = {
        sampleRate: 16000,
        channels: 1,
        audioType: 'raw'
      };
      
      console.log('[Recorder] Creating test recorder with options:', recordingOptions);
      const testRecorder = record.record(recordingOptions);
      
      // Start recording for a very short time
      console.log('[Recorder] Starting test recording...');
      const stream = testRecorder.stream();
      
      // Set up data handler
      let dataReceived = false;
      const dataPromise = new Promise((resolve) => {
        const timeout = setTimeout(() => {
          if (!dataReceived) {
            console.log('[Recorder] No audio data received during test');
            resolve(false);
          }
        }, 500);
        
        stream.once('data', () => {
          console.log('[Recorder] Successfully received audio data in test');
          dataReceived = true;
          clearTimeout(timeout);
          resolve(true);
        });
        
        stream.once('error', (err) => {
          console.error('[Recorder] Error during test recording:', err);
          clearTimeout(timeout);
          resolve(false);
        });
      });
      
      // Wait for data or timeout
      await dataPromise;
      
      // Stop the test recorder
      console.log('[Recorder] Stopping test recording');
      testRecorder.stop();
      
      return dataReceived;
    } catch (error) {
      console.error('[Recorder] Error testing microphone access:', error);
      return false;
    }
  }

  async setDevice(deviceId) {
    try {
      console.log('Setting device:', deviceId);
      
      // Check if we're currently recording
      const wasRecording = this.recording;
      if (wasRecording) {
        await this.stop();
      }

      // Validate device access
      await this.checkMicrophonePermission(deviceId);
      
      // Store the device ID
      this.currentDeviceId = deviceId;
      
      // Test the device by trying to open it
      try {
        const testRecorder = record.record({
          sampleRate: 16000,
          channels: 1,
          audioType: 'raw',
          device: deviceId === 'default' ? null : deviceId
        });
        
        // If we can start recording, the device is valid
        testRecorder.stream();
        testRecorder.stop();
        
        console.log('Successfully tested device:', deviceId);
      } catch (error) {
        console.error('Failed to test device:', error);
        this.currentDeviceId = 'default'; // Reset to default
        throw new Error('Failed to access the selected microphone. Please try another device.');
      }
      
      // If we were recording, restart with new device
      if (wasRecording) {
        await this.start();
      }

      return true;
    } catch (error) {
      console.error('Error setting device:', error);
      this.getService('notification').showNotification(
        'Microphone Error',
        error.message,
        'error'
      );
      return false;
    }
  }

  async start(deviceId = null) {
    if (this.recording) return;
    
    try {
      // Reset recording state
      this.audioData = [];
      this.hasAudioContent = false;
      this.recordingStartTime = Date.now();
      this.totalPausedTime = 0;
      this.pauseStartTime = null;
      
      // Use the specified device or default
      const selectedDeviceId = deviceId || this.currentDeviceId;
      if (selectedDeviceId) {
        console.log('Using selected device for recording:', selectedDeviceId);
      } else {
        console.log('Using system default device for recording');
      }
      
      // Check microphone permission
      await this.checkMicrophonePermission(selectedDeviceId);
      
      // Configure recording options
      const recordingOptions = {
        sampleRate: 16000,
        channels: 1,
        audioType: 'raw'
      };
      
      if (selectedDeviceId) {
        recordingOptions.device = selectedDeviceId;
      }
      
      console.log('Starting recording with settings:', recordingOptions);
      
      // Start tracking recording session in context service
      this.getService('context').startRecording();

      // Show the overlay
      const overlayService = this.getService('overlay');
      if (overlayService) {
        overlayService.showOverlay();
        overlayService.setOverlayState('idle');
      }

      // Check if we should pause background audio
      const configService = this.getService('config');
      const shouldPauseBackgroundAudio = await configService.store.get('pauseBackgroundAudio', false);
      
      if (shouldPauseBackgroundAudio) {
        this.pauseBackgroundAudio();
      }

      // Play start sound BEFORE starting the recorder
      try {
        console.log('Playing start sound before recording...');
        await this.getService('audio').playStartSound();
        console.log('Start sound completed, now starting recorder');
      } catch (soundError) {
        console.error('Error playing start sound:', soundError);
        // Continue with recording even if sound fails
      }

      // Initialize and start the recorder AFTER the sound has played
      this.recorder = record.record(recordingOptions);

      // Log audio data for testing
      this.recorder.stream()
        .on('data', (data) => {
          // Check audio levels
          const hasSound = this.checkAudioLevels(data);
          if (hasSound) {
            this.hasAudioContent = true;
          }

          this.audioData.push(data);
          this.emit('data', data);
          console.log('Audio data chunk received:', {
            chunkSize: data.length,
            totalSize: this.audioData.reduce((sum, chunk) => sum + chunk.length, 0),
            chunks: this.audioData.length,
            hasSound
          });
        })
        .on('error', (err) => {
          console.error('Recording error:', err);
          this.getService('notification').showNotification(
            'Recording Error',
            err.message || 'Failed to record audio',
            'error'
          );
          this.emit('error', err);
          this.stop();
        });

      this.recording = true;
      this.emit('start');
      console.log('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      this.getService('notification').showNotification(
        'Recording Error',
        error.message || 'Failed to start recording',
        'error'
      );
      this.emit('error', error);
    }
  }

  checkAudioLevels(buffer) {
    if (!buffer || this.paused) return false;
    
    // Convert buffer to 16-bit samples
    const samples = new Int16Array(buffer.buffer);
    
    // Calculate RMS (Root Mean Square) of the audio samples
    let sum = 0;
    let max = 0;
    let min = 0;
    let samplesAboveThreshold = 0;
    let consecutiveSamplesAboveThreshold = 0;
    let maxConsecutiveSamplesAboveThreshold = 0;
    let currentConsecutive = 0;
    
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.abs(samples[i]);
      sum += sample * sample;
      max = Math.max(max, sample);
      min = Math.min(min, sample);
      
      if (sample > this.silenceThreshold) {
        samplesAboveThreshold++;
        currentConsecutive++;
        maxConsecutiveSamplesAboveThreshold = Math.max(
          maxConsecutiveSamplesAboveThreshold,
          currentConsecutive
        );
      } else {
        currentConsecutive = 0;
      }
    }
    
    const rms = Math.sqrt(sum / samples.length);
    
    // Even more sensitive normalization (reduced from 2000 to 1800)
    // Apply an even stronger non-linear curve to significantly amplify quieter sounds
    // The power of 0.5 makes the curve more aggressive for low values
    const normalizedLevel = Math.min(1, Math.pow(rms / 1800, 0.5));
    
    // Update smoothed levels with enhanced randomization for more visual interest
    for (let i = 0; i < this.currentLevels.length; i++) {
      // Higher minimum level (0.28) to ensure bars are always visibly moving
      // Add more randomization for more dynamic visualization
      const targetLevel = Math.max(0.28, normalizedLevel * (0.6 + Math.random() * 0.8));
      
      // Apply smoothing with the updated factor
      this.currentLevels[i] = this.currentLevels[i] * (1 - this.levelSmoothingFactor) +
                           targetLevel * this.levelSmoothingFactor;
    }

    // Send levels to overlay service
    const overlayService = this.getService('overlay');
    if (overlayService) {
      overlayService.updateOverlayAudioLevels(this.currentLevels);
    }
    
    // Calculate percentage of samples above threshold
    const percentageAboveThreshold = (samplesAboveThreshold / samples.length) * 100;
    
    // More stringent thresholds to better distinguish between ambient noise and actual speech
    // Requires both a minimum percentage of samples above threshold AND a minimum RMS value
    const isActualSpeech = percentageAboveThreshold > 12 && 
                          maxConsecutiveSamplesAboveThreshold > 30 &&
                          rms > 300;
    
    // Log detailed audio metrics for debugging
    if (isActualSpeech) {
      console.log('Speech detected:', {
        rms: Math.round(rms),
        percentageAboveThreshold: Math.round(percentageAboveThreshold),
        maxConsecutive: maxConsecutiveSamplesAboveThreshold
      });
    }
    
    return isActualSpeech;
  }

  async stop() {
    if (!this.recording) return;
    
    try {
      console.log('Stopping recording...');
      if (this.recorder) {
        this.recorder.stop();
        this.recorder = null;
      }
      this.recording = false;
      this.paused = false;

      // Resume background audio if it was paused
      this.resumeBackgroundAudio();

      // Stop tracking recording session in context service
      this.getService('context').stopRecording();

      // Hide the overlay
      const overlayService = this.getService('overlay');
      if (overlayService) {
        overlayService.hideOverlay();
      }

      // Play stop sound
      await this.getService('audio').playStopSound();

      // Calculate recording duration
      const recordingDuration = this.recordingStartTime ? 
        (Date.now() - this.recordingStartTime - this.totalPausedTime) / 1000 : 0;
      
      // Calculate final audio metrics
      const totalSamples = this.audioData.reduce((sum, chunk) => sum + chunk.length, 0);
      const samplesAboveThreshold = this.audioData.reduce((sum, chunk) => {
        const samples = new Int16Array(chunk.buffer);
        return sum + samples.filter(s => Math.abs(s) > this.silenceThreshold).length;
      }, 0);
      
      const percentageAboveThreshold = (samplesAboveThreshold / totalSamples) * 100;
      
      // Calculate RMS value for better audio content detection
      const averageRMS = Math.round(
        this.audioData.reduce((sum, chunk) => {
          const samples = new Int16Array(chunk.buffer);
          const rms = Math.sqrt(samples.reduce((s, sample) => s + sample * sample, 0) / samples.length);
          return sum + rms;
        }, 0) / this.audioData.length
      );
      
      // More stringent check for audio content - requires both percentage above threshold
      // and minimum RMS value to consider it valid speech
      const hasRealSpeech = percentageAboveThreshold > 15 && averageRMS > 300;
      
      // Check for minimum recording duration (at least 1.5 seconds)
      const hasMinimumDuration = recordingDuration >= 1.5;
      
      console.log('Final audio analysis:', {
        totalDuration: (totalSamples / 16000).toFixed(2) + 's',
        recordingDuration: recordingDuration.toFixed(2) + 's',
        percentageAboveThreshold: Math.round(percentageAboveThreshold) + '%',
        totalChunks: this.audioData.length,
        hasAudioContent: this.hasAudioContent,
        averageRMS,
        hasRealSpeech,
        hasMinimumDuration
      });

      // Skip transcription if no real audio content detected or recording is too short
      if (!this.hasAudioContent || !hasRealSpeech || !hasMinimumDuration) {
        console.log('No significant audio content detected or recording too short, skipping transcription');
        
        // Show different messages based on the issue
        if (!hasMinimumDuration) {
          this.getService('notification').showNotification({
            title: 'Recording Too Short',
            body: 'Please record for at least 1.5 seconds.',
            type: 'info'
          });
        } else {
          this.getService('notification').showNoAudioDetected();
        }
        
        this.emit('stop');
        return;
      }

      // Combine all audio data into a single buffer
      const completeAudioData = Buffer.concat(this.audioData);
      console.log('Complete audio data:', {
        totalSize: completeAudioData.length,
        chunks: this.audioData.length,
        hadAudioContent: this.hasAudioContent
      });
      
      // Get transcription
      try {
        console.log('Sending audio for transcription...');
        const transcription = await this.getService('transcription').transcribeAudio(completeAudioData);
        this.emit('transcription', transcription);
        console.log('Transcription received:', transcription);
      } catch (error) {
        console.error('Transcription error:', error);
        this.getService('notification').showTranscriptionError(error);
        this.emit('error', error);
      }

      this.emit('stop');
      console.log('Recording stopped');
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.getService('notification').showNotification(
        'Recording Error',
        error.message || 'Failed to stop recording',
        'error'
      );
      this.emit('error', error);
    }
  }

  async pause() {
    if (!this.recording || this.paused) return;
    
    console.log('Pausing recording');
    this.paused = true;
    this.pauseStartTime = Date.now();
    
    if (this.recorder) {
      // Stop the recorder temporarily
      this.recorder.pause();
    }
    
    // Update the overlay to show paused state
    const overlayService = this.getService('overlay');
    if (overlayService) {
      overlayService.updateOverlayState('paused');
    }
    
    // Note: We intentionally don't resume background audio when pausing
    // the recording, as we want to keep it paused until recording is stopped
    
    // Emit pause event
    this.emit('paused');
  }
  
  async resume() {
    if (!this.recording || !this.paused) return;
    
    console.log('Resuming recording');
    this.paused = false;
    
    // Calculate total paused time
    if (this.pauseStartTime) {
      this.totalPausedTime += (Date.now() - this.pauseStartTime);
      this.pauseStartTime = null;
    }
    
    if (this.recorder) {
      // Resume the recorder
      this.recorder.resume();
    }
    
    // Update the overlay to show active state
    const overlayService = this.getService('overlay');
    if (overlayService) {
      overlayService.updateOverlayState('active');
    }
    
    // Emit resume event
    this.emit('resumed');
  }

  async cancel() {
    if (!this.recording) return;
    
    console.log('Cancelling recording');
    this.recording = false;
    this.paused = false;
    
    if (this.recorder) {
      this.recorder.stop();
      this.recorder = null;
    }
    
    // Resume background audio if it was paused
    this.resumeBackgroundAudio();
    
    // Clear the audio data without saving
    this.audioData = [];
    this.hasAudioContent = false;
    
    // Hide the overlay
    const overlayService = this.getService('overlay');
    if (overlayService) {
      overlayService.hideOverlay();
    }
    
    // Emit cancel event
    this.emit('cancelled');
    
    // Update context service
    this.getService('context').cancelRecording();
  }

  // Method to pause background audio using system media controls
  pauseBackgroundAudio() {
    try {
      console.log('Attempting to pause background audio...');
      
      // Reset the flag - we'll only set it to true if we actually pause something
      this.backgroundAudioWasPaused = false;
      
      // For macOS, use a universal approach to pause all media
      if (process.platform === 'darwin') {
        const { exec } = require('child_process');
        
        // First check if any media is actually playing before trying to pause
        exec('osascript -e \'tell application "System Events" to set mediaPlaying to false\' -e \'tell application "System Events" to set mediaPlaying to mediaPlaying or ((name of processes) contains "Spotify" and application "Spotify" is running and application "Spotify" is playing)\' -e \'tell application "System Events" to set mediaPlaying to mediaPlaying or ((name of processes) contains "Music" and application "Music" is running and application "Music" is playing)\' -e \'tell application "System Events" to set mediaPlaying to mediaPlaying or ((name of processes) contains "QuickTime Player" and application "QuickTime Player" is running)\' -e \'tell application "System Events" to set mediaPlaying to mediaPlaying or ((name of processes) contains "VLC" and application "VLC" is running)\' -e \'return mediaPlaying\'', (error, stdout) => {
          if (error) {
            console.error('Failed to check if media is playing:', error);
            return;
          }
          
          // Only pause if media is actually playing
          const isPlaying = stdout.trim() === 'true';
          console.log('Media playing check result:', isPlaying);
          
          if (isPlaying) {
            this.backgroundAudioWasPaused = true;
            
            // Use the media key approach as the primary method - this is universal
            // Key code 100 is the Play/Pause media key on macOS
            exec('osascript -e \'tell application "System Events" to key code 100\'', (error) => {
              if (error) {
                console.error('Failed to send universal media pause command:', error);
              } else {
                console.log('Sent universal media pause command successfully');
              }
            });
            
            // Also try specific approaches for common players as backup
            
            // Spotify - Check if running first
            exec('osascript -e \'tell application "System Events" to set isRunning to (exists process "Spotify")\' -e \'if isRunning then tell application "Spotify" to pause\'', (error) => {
              if (error) {
                console.error('Failed to pause Spotify with direct command:', error);
              } else {
                console.log('Sent direct Spotify pause command');
              }
            });
            
            // Music app - Check if running first
            exec('osascript -e \'tell application "System Events" to set isRunning to (exists process "Music")\' -e \'if isRunning then tell application "Music" to pause\'', (error) => {
              if (error) {
                console.error('Failed to pause Music with direct command:', error);
              } else {
                console.log('Sent direct Music pause command');
              }
            });
            
            // QuickTime Player - Check if running first
            exec('osascript -e \'tell application "System Events" to set isRunning to (exists process "QuickTime Player")\' -e \'if isRunning then tell application "QuickTime Player" to pause\'', (error) => {
              if (error) {
                console.error('Failed to pause QuickTime with direct command:', error);
              } else {
                console.log('Sent direct QuickTime pause command');
              }
            });
            
            // VLC - Check if running first, then use the correct command
            exec('osascript -e \'tell application "System Events" to set isRunning to (exists process "VLC")\' -e \'if isRunning then tell application "VLC" to play with state false\'', (error) => {
              if (error) {
                console.error('Failed to pause VLC with direct command:', error);
              } else {
                console.log('Sent direct VLC pause command');
              }
            });
            
            // Chrome (for YouTube, Netflix, etc.) - Fixed escaping
            exec("osascript -e 'tell application \"System Events\" to set chromeRunning to (name of processes) contains \"Google Chrome\"' -e 'if chromeRunning then tell application \"Google Chrome\" to execute front window\\'s active tab javascript \"const videoElements = document.querySelectorAll(\\\"video\\\"); let videoWasPlaying = false; videoElements.forEach(video => { if (!video.paused) { video.pause(); videoWasPlaying = true; } }); const audioElements = document.querySelectorAll(\\\"audio\\\"); let audioWasPlaying = false; audioElements.forEach(audio => { if (!audio.paused) { audio.pause(); audioWasPlaying = true; } }); videoWasPlaying || audioWasPlaying;\"'", (error) => {
              if (error) {
                console.error('Failed to pause Chrome media:', error);
              } else {
                console.log('Sent Chrome media pause command');
              }
            });
            
            // Safari (for YouTube, Netflix, etc.) - Fixed escaping
            exec("osascript -e 'tell application \"System Events\" to set safariRunning to (name of processes) contains \"Safari\"' -e 'if safariRunning then tell application \"Safari\" to do JavaScript \"const videoElements = document.querySelectorAll(\\\"video\\\"); let videoWasPlaying = false; videoElements.forEach(video => { if (!video.paused) { video.pause(); videoWasPlaying = true; } }); const audioElements = document.querySelectorAll(\\\"audio\\\"); let audioWasPlaying = false; audioElements.forEach(audio => { if (!audio.paused) { audio.pause(); audioWasPlaying = true; } }); videoWasPlaying || audioWasPlaying;\" in current tab of front window'", (error) => {
              if (error) {
                console.error('Failed to pause Safari media:', error);
              } else {
                console.log('Sent Safari media pause command');
              }
            });
          } else {
            console.log('No media appears to be playing, skipping pause commands');
          }
        });
      }
      
      // For Windows, we would use a similar approach with different key codes
      else if (process.platform === 'win32') {
        const { exec } = require('child_process');
        // TODO: Add a check for Windows to see if media is playing
        exec('powershell -command "(New-Object -ComObject WScript.Shell).SendKeys(\' {MEDIA_PLAY_PAUSE}\')"', (error) => {
          if (error) {
            console.error('Failed to send media pause command:', error);
          } else {
            console.log('Sent media pause command successfully');
            this.backgroundAudioWasPaused = true;
          }
        });
      }
      
      // For Linux, we would use a different approach
      else if (process.platform === 'linux') {
        const { exec } = require('child_process');
        // TODO: Add a check for Linux to see if media is playing
        exec('dbus-send --type=method_call --dest=org.mpris.MediaPlayer2.spotify /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Player.Pause', (error) => {
          if (error) {
            console.error('Failed to send media pause command:', error);
          } else {
            console.log('Sent media pause command successfully');
            this.backgroundAudioWasPaused = true;
          }
        });
      }
    } catch (error) {
      console.error('Error pausing background audio:', error);
    }
  }
  
  // Method to resume background audio
  resumeBackgroundAudio() {
    // Only resume if we previously paused
    if (!this.backgroundAudioWasPaused) {
      console.log('No background audio was paused, skipping resume');
      return;
    }
    
    try {
      console.log('Attempting to resume background audio that was previously paused...');
      
      // Reset the flag
      this.backgroundAudioWasPaused = false;
      
      // For macOS, use a universal approach to resume all media
      if (process.platform === 'darwin') {
        const { exec } = require('child_process');
        
        // Use the media key approach as the primary method - this is universal
        // Key code 101 is the Play media key on macOS
        exec('osascript -e \'tell application "System Events" to key code 101\'', (error) => {
          if (error) {
            console.error('Failed to send universal media play command:', error);
          } else {
            console.log('Sent universal media play command successfully');
          }
        });
        
        // Also try specific approaches for common players as backup
        
        // Spotify - Check if running first
        exec('osascript -e \'tell application "System Events" to set isRunning to (exists process "Spotify")\' -e \'if isRunning then tell application "Spotify" to play\'', (error) => {
          if (error) {
            console.error('Failed to resume Spotify with direct command:', error);
          } else {
            console.log('Sent direct Spotify play command');
          }
        });
        
        // Music app - Check if running first
        exec('osascript -e \'tell application "System Events" to set isRunning to (exists process "Music")\' -e \'if isRunning then tell application "Music" to play\'', (error) => {
          if (error) {
            console.error('Failed to resume Music with direct command:', error);
          } else {
            console.log('Sent direct Music play command');
          }
        });
        
        // QuickTime Player - Check if running first
        exec('osascript -e \'tell application "System Events" to set isRunning to (exists process "QuickTime Player")\' -e \'if isRunning then tell application "QuickTime Player" to play\'', (error) => {
          if (error) {
            console.error('Failed to resume QuickTime with direct command:', error);
          } else {
            console.log('Sent direct QuickTime play command');
          }
        });
        
        // VLC - Check if running first, then use the correct command
        exec('osascript -e \'tell application "System Events" to set isRunning to (exists process "VLC")\' -e \'if isRunning then tell application "VLC" to play with state true\'', (error) => {
          if (error) {
            console.error('Failed to resume VLC with direct command:', error);
          } else {
            console.log('Sent direct VLC play command');
          }
        });
        
        // Chrome (for YouTube, Netflix, etc.) - Fixed escaping
        exec("osascript -e 'tell application \"System Events\" to set chromeRunning to (name of processes) contains \"Google Chrome\"' -e 'if chromeRunning then tell application \"Google Chrome\" to execute front window\\'s active tab javascript \"const videoElements = document.querySelectorAll(\\\"video\\\"); videoElements.forEach(video => { if (video.paused) { video.play(); } }); const audioElements = document.querySelectorAll(\\\"audio\\\"); audioElements.forEach(audio => { if (audio.paused) { audio.play(); } });\"'", (error) => {
          if (error) {
            console.error('Failed to resume Chrome media:', error);
          } else {
            console.log('Sent Chrome media play command');
          }
        });
        
        // Safari (for YouTube, Netflix, etc.) - Fixed escaping
        exec("osascript -e 'tell application \"System Events\" to set safariRunning to (name of processes) contains \"Safari\"' -e 'if safariRunning then tell application \"Safari\" to do JavaScript \"const videoElements = document.querySelectorAll(\\\"video\\\"); videoElements.forEach(video => { if (video.paused) { video.play(); } }); const audioElements = document.querySelectorAll(\\\"audio\\\"); audioElements.forEach(audio => { if (audio.paused) { audio.play(); } });\" in current tab of front window'", (error) => {
          if (error) {
            console.error('Failed to resume Safari media:', error);
          } else {
            console.log('Sent Safari media play command');
          }
        });
      }
      
      // For Windows
      else if (process.platform === 'win32') {
        const { exec } = require('child_process');
        exec('powershell -command "(New-Object -ComObject WScript.Shell).SendKeys(\' {MEDIA_PLAY_PAUSE}\')"', (error) => {
          if (error) {
            console.error('Failed to send media play command:', error);
          } else {
            console.log('Sent media play command successfully');
          }
        });
      }
      
      // For Linux
      else if (process.platform === 'linux') {
        const { exec } = require('child_process');
        exec('dbus-send --type=method_call --dest=org.mpris.MediaPlayer2.spotify /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Player.Play', (error) => {
          if (error) {
            console.error('Failed to send media play command:', error);
          } else {
            console.log('Sent media play command successfully');
          }
        });
      }
    } catch (error) {
      console.error('Error resuming background audio:', error);
    }
  }

  isRecording() {
    return this.recording;
  }
}

// Export a factory function
module.exports = () => new RecorderService(); 