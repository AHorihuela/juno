/**
 * Controls background audio (pause/resume) during recording
 */
class BackgroundAudioController {
  constructor(services) {
    this.services = services;
    this.backgroundAudioWasPaused = false;
  }

  /**
   * Checks if background audio should be paused based on user settings
   * @returns {Promise<boolean>} - True if background audio should be paused
   */
  async shouldPauseBackgroundAudio() {
    if (!this.services) return false;
    
    const configService = this.services.config;
    if (!configService) return false;
    
    return await configService.store.get('pauseBackgroundAudio', false);
  }

  /**
   * Pauses background audio using system media controls
   */
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
  
  /**
   * Resumes background audio that was previously paused
   */
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

  /**
   * Checks if background audio was paused
   * @returns {boolean} - True if background audio was paused
   */
  wasBackgroundAudioPaused() {
    return this.backgroundAudioWasPaused;
  }
}

module.exports = BackgroundAudioController; 