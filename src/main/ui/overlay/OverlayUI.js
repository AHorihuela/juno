/**
 * OverlayUI.js
 * 
 * This module handles the UI components of the audio recording overlay.
 * It provides methods for generating the HTML, CSS, and JavaScript for the overlay window.
 */

class OverlayUI {
  /**
   * Get the complete HTML for the overlay window
   * @returns {string} The HTML content
   */
  getHTML() {
    return `
      <html>
        <head>
          <style>${this.getStyles()}</style>
          <script>${this.getScript()}</script>
        </head>
        <body>
          <div class="container">
            <div class="recording-indicator">
              <div class="record-icon"></div>
            </div>
            <div class="visualization-container">
              ${Array(20).fill('<div class="bar"></div>').join('')}
            </div>
            <div class="timer">00:00</div>
            <div class="controls">
              <button class="control-button pause-button" title="Pause recording">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <rect x="2" y="2" width="2" height="6" rx="0.5" fill="white"/>
                  <rect x="6" y="2" width="2" height="6" rx="0.5" fill="white"/>
                </svg>
              </button>
              <button class="control-button cancel-button" title="Cancel recording">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Get the CSS styles for the overlay
   * @returns {string} The CSS styles
   */
  getStyles() {
    return `
      body {
        margin: 0;
        padding: 0;
        background: transparent;
        overflow: hidden;
        user-select: none;
        -webkit-app-region: no-drag;
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }
      
      .container {
        background: linear-gradient(135deg, rgba(30, 30, 30, 0.85) 0%, rgba(10, 10, 10, 0.95) 100%);
        border-radius: 28px;
        padding: 0 14px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        height: 40px;
        min-width: 280px;
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        transition: all 0.3s ease;
      }
      
      .recording-indicator {
        display: flex;
        align-items: center;
        margin-right: 10px;
      }
      
      .record-icon {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background-color: #ff3b30;
        animation: pulse 2s infinite;
      }
      
      .visualization-container {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 2px;
        height: 28px;
        overflow: hidden;
      }
      
      .bar {
        flex: 1;
        height: 28px;
        background: linear-gradient(to top, rgba(255, 59, 48, 0.5), rgba(255, 59, 48, 0.9));
        border-radius: 4px;
        transition: transform 0.1s cubic-bezier(0.4, 0.0, 0.2, 1);
        transform-origin: bottom;
        transform: scaleY(0.15);
        will-change: transform, background;
      }
      
      .timer {
        font-size: 12px;
        font-weight: 500;
        color: white;
        margin-left: 10px;
        min-width: 40px;
        text-align: right;
      }
      
      .controls {
        display: flex;
        align-items: center;
        margin-left: 12px;
        gap: 8px;
      }
      
      .control-button {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background-color: rgba(255, 255, 255, 0.15);
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        padding: 0;
        transition: background-color 0.2s ease, transform 0.1s ease;
        outline: none;
      }
      
      .control-button:hover {
        background-color: rgba(255, 255, 255, 0.25);
      }
      
      .control-button:active {
        transform: scale(0.95);
        background-color: rgba(255, 255, 255, 0.3);
      }
      
      .pause-button {
        margin-right: 2px;
      }
      
      .cancel-button svg {
        stroke: rgba(255, 255, 255, 0.9);
      }
      
      @keyframes pulse {
        0% {
          box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.7);
        }
        70% {
          box-shadow: 0 0 0 5px rgba(255, 59, 48, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(255, 59, 48, 0);
        }
      }
    `;
  }

  /**
   * Get the JavaScript for the overlay
   * @returns {string} The JavaScript code
   */
  getScript() {
    return `
      let bars = [];
      let timerElement;
      let startTime = 0;
      let currentState = 'idle';
      let animationFrameId;
      let isPaused = false;
      let pauseStartTime = 0;
      let totalPausedTime = 0;
      
      const states = {
        idle: () => {
          const now = Date.now() / 1000;
          bars.forEach((bar, i) => {
            const offset = i * 0.05;
            // More pronounced idle animation with multiple sine waves
            const wave1 = Math.sin(now * 2 + offset) * 0.06;
            const wave2 = Math.sin(now * 1.5 + offset * 2) * 0.04;
            const scale = 0.2 + wave1 + wave2;
            
            bar.style.transform = \`scaleY(\${scale})\`;
            
            // Subtle color animation in idle state
            const hue = 355 + Math.floor(Math.sin(now + i * 0.1) * 5);
            const lightness = 50 + Math.floor(Math.sin(now * 0.7 + i * 0.15) * 5);
            bar.style.background = \`linear-gradient(to top, 
              hsla(\${hue}, 90%, \${lightness}%, 0.5), 
              hsla(\${hue}, 90%, \${lightness + 10}%, 0.9))\`;
          });
        },
        active: (levels) => {
          if (!levels || !Array.isArray(levels)) return;
          
          // Expand the levels array to match our number of bars
          const expandedLevels = [];
          const barsCount = bars.length;
          const levelsCount = levels.length;
          
          // Add some artificial peaks for more visual interest
          const enhancedLevels = [...levels];
          for (let i = 0; i < enhancedLevels.length; i++) {
            // Randomly boost some levels to create more dynamic peaks
            if (Math.random() < 0.3) {
              enhancedLevels[i] = Math.min(1, enhancedLevels[i] * 1.8); // Increased boost from 1.5 to 1.8
            }
          }
          
          // Create a wave-like pattern by adding a sine wave to the levels
          const now = Date.now() / 1000;
          for (let i = 0; i < barsCount; i++) {
            // Map the bar index to a level index with some overlap for smoother visualization
            const levelIdx = Math.min(levelsCount - 1, Math.floor(i * levelsCount / barsCount));
            
            // Enhanced randomization for more dynamic visualization
            const randomFactor = 0.85 + Math.random() * 0.4;
            
            // Apply a stronger curve to emphasize peaks
            let level = Math.pow(enhancedLevels[levelIdx] * randomFactor, 0.75); // More aggressive curve (0.75 instead of 0.8)
            
            // Add a subtle sine wave for more fluid motion
            const waveOffset = Math.sin((now * 3) + (i * 0.2)) * 0.05;
            level = Math.min(1, level + waveOffset);
            
            expandedLevels.push(level);
          }
          
          // Apply smoothed levels to bars with minimal delay for more responsive animation
          bars.forEach((bar, i) => {
            // Reduced delay for more responsive animation
            const delay = i * 4; // Further reduced from 5 to 4
            setTimeout(() => {
              // Ensure minimum scale for better visibility
              const scale = Math.max(0.25, Math.min(1, expandedLevels[i] || 0));
              bar.style.transform = \`scaleY(\${scale})\`;
              
              // Enhanced color variation based on intensity
              const intensity = Math.min(0.98, 0.6 + scale * 0.4);
              const hue = 355 - Math.floor(scale * 25); // More pronounced hue shift based on intensity
              bar.style.background = \`linear-gradient(to top, 
                hsla(\${hue}, 95%, 50%, \${intensity * 0.6}), 
                hsla(\${hue}, 95%, 65%, \${intensity}))\`;
            }, delay);
          });
          
          // Update timer
          updateTimer();
        },
        paused: () => {
          // Subtle pulsing animation for paused state
          const now = Date.now() / 1000;
          bars.forEach((bar, i) => {
            const offset = i * 0.1;
            const pulse = Math.sin(now * 1.5 + offset) * 0.05;
            const scale = 0.15 + pulse;
            
            bar.style.transform = \`scaleY(\${scale})\`;
            
            // Blue-ish color for paused state
            bar.style.background = \`linear-gradient(to top, 
              rgba(59, 130, 246, 0.5), 
              rgba(59, 130, 246, 0.9))\`;
          });
          
          // Keep timer frozen at paused time
          updateTimer();
        }
      };

      function updateTimer() {
        if (!timerElement) return;
        
        let elapsedSeconds;
        if (isPaused) {
          // When paused, show the time at which we paused
          elapsedSeconds = Math.floor((pauseStartTime - startTime - totalPausedTime) / 1000);
        } else {
          // When active, calculate current elapsed time minus any paused time
          elapsedSeconds = Math.floor((Date.now() - startTime - totalPausedTime) / 1000);
        }
        
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        
        timerElement.textContent = \`\${minutes.toString().padStart(2, '0')}:\${seconds.toString().padStart(2, '0')}\`;
      }

      function updateState(state, levels) {
        if (state === 'active' && currentState !== 'active') {
          // Starting recording
          if (!startTime) {
            startTime = Date.now();
          } else if (isPaused) {
            // Resuming from pause
            totalPausedTime += (Date.now() - pauseStartTime);
            isPaused = false;
            updatePauseButtonUI();
          }
        } else if (state === 'paused' && currentState !== 'paused') {
          // Pausing recording
          isPaused = true;
          pauseStartTime = Date.now();
          updatePauseButtonUI();
        }
        
        currentState = state;
        
        // Cancel any existing animation frame
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        
        // Start animation loop
        function animate() {
          if (states[currentState]) {
            states[currentState](levels);
          }
          animationFrameId = requestAnimationFrame(animate);
        }
        
        animate();
      }
      
      function updatePauseButtonUI() {
        const pauseButton = document.querySelector('.pause-button');
        if (!pauseButton) return;
        
        if (isPaused) {
          // Show play icon when paused
          pauseButton.innerHTML = \`
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3.5 2.5L7.5 5L3.5 7.5V2.5Z" fill="white" stroke="white" stroke-width="0.5" stroke-linejoin="round"/>
            </svg>
          \`;
          pauseButton.title = "Resume recording";
        } else {
          // Show pause icon when active
          pauseButton.innerHTML = \`
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="2" y="2" width="2" height="6" rx="0.5" fill="white"/>
              <rect x="6" y="2" width="2" height="6" rx="0.5" fill="white"/>
            </svg>
          \`;
          pauseButton.title = "Pause recording";
        }
      }
      
      function handlePauseClick() {
        if (isPaused) {
          // Resume recording
          window.postMessage({ type: 'control-action', action: 'resume' }, '*');
          updateState('active');
        } else {
          // Pause recording
          window.postMessage({ type: 'control-action', action: 'pause' }, '*');
          updateState('paused');
        }
      }
      
      function handleCancelClick() {
        window.postMessage({ type: 'control-action', action: 'cancel' }, '*');
      }

      // Expose updateState globally so it can be called from the main process
      window.updateState = updateState;

      document.addEventListener('DOMContentLoaded', () => {
        bars = Array.from(document.querySelectorAll('.bar'));
        timerElement = document.querySelector('.timer');
        
        // Set up button event listeners
        const pauseButton = document.querySelector('.pause-button');
        const cancelButton = document.querySelector('.cancel-button');
        
        if (pauseButton) {
          pauseButton.addEventListener('click', handlePauseClick);
        }
        
        if (cancelButton) {
          cancelButton.addEventListener('click', handleCancelClick);
        }
        
        // Start with idle animation
        updateState('idle');
        
        // Listen for messages from main process
        window.addEventListener('message', (event) => {
          const { type, data } = event.data;
          
          if (type === 'update-levels' && data.levels) {
            if (!isPaused) {
              updateState('active', data.levels);
            }
          } else if (type === 'set-state') {
            updateState(data.state);
          }
        });
      });
    `;
  }

  /**
   * Set up IPC message handler script for the overlay window
   * @returns {string} JavaScript code for setting up IPC handlers
   */
  getIPCHandlerScript() {
    return `
      // Set up message handler for control actions
      window.addEventListener('message', (event) => {
        const { type, action } = event.data;
        if (type === 'control-action') {
          // Forward to main process via IPC
          window.ipcRenderer.send('control-action', { action });
        }
      });
    `;
  }
}

module.exports = new OverlayUI(); 