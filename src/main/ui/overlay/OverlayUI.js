/**
 * OverlayUI.js
 * 
 * This module handles the UI components of the audio recording overlay.
 * It provides methods for generating the HTML, CSS, and JavaScript for the overlay window.
 */

const LogManager = require('../../utils/LogManager');

// Get a logger for this module
const logger = LogManager.getLogger('OverlayUI');

class OverlayUI {
  /**
   * Generate the complete HTML for the overlay window
   * @returns {string} The HTML content
   */
  generateOverlayHTML() {
    try {
      logger.debug('Generating overlay HTML');
      const html = `
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
            <div id="debug-panel" style="display: none; position: fixed; bottom: 10px; left: 10px; background: rgba(0,0,0,0.8); color: white; padding: 10px; font-size: 10px; max-width: 300px; max-height: 200px; overflow: auto; z-index: 9999;"></div>
          </body>
        </html>
      `;
      return html;
    } catch (error) {
      logger.error('Error generating overlay HTML:', { metadata: { error } });
      // Return a minimal fallback HTML in case of error
      return `<html><body><div style="color: white; background: black; padding: 10px;">Recording in progress</div></body></html>`;
    }
  }

  /**
   * For backward compatibility
   * @deprecated Use generateOverlayHTML instead
   */
  getHTML() {
    logger.warn('getHTML is deprecated, use generateOverlayHTML instead');
    return this.generateOverlayHTML();
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
        backface-visibility: hidden;
        perspective: 1000;
        -webkit-backface-visibility: hidden;
        -webkit-perspective: 1000;
        -webkit-transform-style: preserve-3d;
        transform-style: preserve-3d;
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
      let lastLevelsUpdate = 0;
      let debugPanel;
      let isDebugMode = false;
      
      // Initialize when DOM is loaded
      document.addEventListener('DOMContentLoaded', () => {
        console.log('Overlay DOM loaded');
        
        // Get references to DOM elements
        bars = Array.from(document.querySelectorAll('.bar'));
        timerElement = document.querySelector('.timer');
        debugPanel = document.getElementById('debug-panel');
        
        // Set up control button event listeners
        const pauseButton = document.querySelector('.pause-button');
        const cancelButton = document.querySelector('.cancel-button');
        
        if (pauseButton) {
          pauseButton.addEventListener('click', () => {
            if (window.electron) {
              window.electron.send('overlay-pause');
              logDebug('Sent overlay-pause event');
            }
          });
        }
        
        if (cancelButton) {
          cancelButton.addEventListener('click', () => {
            if (window.electron) {
              window.electron.send('overlay-cancel');
              logDebug('Sent overlay-cancel event');
            }
          });
        }
        
        // Set up keyboard shortcuts for debugging
        document.addEventListener('keydown', (e) => {
          // Alt+D to toggle debug panel
          if (e.altKey && e.key === 'd') {
            isDebugMode = !isDebugMode;
            debugPanel.style.display = isDebugMode ? 'block' : 'none';
            logDebug('Debug mode ' + (isDebugMode ? 'enabled' : 'disabled'));
          }
          
          // Alt+T to trigger test animation
          if (e.altKey && e.key === 't') {
            const testLevels = Array(10).fill(0).map(() => Math.random());
            updateVisualization(testLevels);
            logDebug('Test animation triggered with levels: ' + testLevels.map(l => l.toFixed(2)).join(', '));
          }
        });
        
        // Set up IPC listeners
        if (window.electron) {
          // Listen for audio level updates
          window.electron.on('update-audio-levels', (data) => {
            if (data && data.levels && Array.isArray(data.levels)) {
              lastLevelsUpdate = Date.now();
              updateVisualization(data.levels);
              
              if (isDebugMode) {
                logDebug('Received audio levels: ' + data.levels.map(l => l.toFixed(2)).join(', '));
              }
            }
          });
          
          // Listen for state updates
          window.electron.on('update-state', (data) => {
            if (data && data.state) {
              updateState(data.state);
              logDebug('State updated to: ' + data.state);
            }
          });
          
          // Listen for state setting
          window.electron.on('set-state', (data) => {
            if (data && data.state) {
              setInitialState(data.state);
              logDebug('Initial state set to: ' + data.state);
            }
          });
          
          logDebug('IPC listeners set up');
        } else {
          logDebug('WARNING: window.electron not available');
        }
        
        // Start animation loop
        startAnimationLoop();
        
        // Start timer if in active state
        if (currentState === 'active') {
          startTimer();
        }
        
        // Force active state and test animation if no state is set within 1 second
        setTimeout(() => {
          if (currentState === 'idle' && Date.now() - lastLevelsUpdate > 1000) {
            logDebug('No state updates received, forcing active state');
            setInitialState('active');
            
            // Trigger test animation
            const testLevels = Array(10).fill(0).map(() => 0.3 + Math.random() * 0.5);
            updateVisualization(testLevels);
          }
        }, 1000);
      });
      
      // Helper function to log debug messages
      function logDebug(message) {
        console.log('[Overlay Debug]', message);
        if (debugPanel) {
          const timestamp = new Date().toISOString().substr(11, 8);
          debugPanel.innerHTML += \`<div>\${timestamp}: \${message}</div>\`;
          debugPanel.scrollTop = debugPanel.scrollHeight;
          
          // Limit debug panel content
          if (debugPanel.children.length > 50) {
            debugPanel.removeChild(debugPanel.firstChild);
          }
        }
      }
      
      // Animation loop for visualizations
      function startAnimationLoop() {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        
        // Track frame timing for smoother animations
        let lastFrameTime = 0;
        
        function animate(timestamp) {
          // Calculate delta time for smoother animations
          const deltaTime = lastFrameTime ? (timestamp - lastFrameTime) / 1000 : 0.016;
          lastFrameTime = timestamp;
          
          if (currentState === 'idle') {
            states.idle(deltaTime);
          }
          
          // Update timer if active and not paused
          if (currentState === 'active' && !isPaused && startTime > 0) {
            updateTimer();
          }
          
          animationFrameId = requestAnimationFrame(animate);
        }
        
        animationFrameId = requestAnimationFrame(animate);
        logDebug('Animation loop started');
      }
      
      // Update the visualization with audio levels
      function updateVisualization(levels) {
        if (!levels || !Array.isArray(levels)) {
          logDebug('Invalid levels data received');
          return;
        }
        
        if (currentState === 'active' && !isPaused) {
          states.active(levels);
        }
      }
      
      // Set the initial state
      function setInitialState(state) {
        currentState = state;
        
        if (state === 'active') {
          startTimer();
          logDebug('Timer started due to active state');
        } else if (state === 'paused') {
          isPaused = true;
          logDebug('Set to paused state');
        }
      }
      
      // Update the current state
      function updateState(state) {
        const previousState = currentState;
        currentState = state;
        
        if (state === 'active' && previousState !== 'active') {
          startTimer();
          isPaused = false;
          logDebug('State changed to active, timer started');
        } else if (state === 'paused' && !isPaused) {
          isPaused = true;
          pauseStartTime = Date.now();
          logDebug('State changed to paused');
        } else if (state === 'active' && isPaused) {
          isPaused = false;
          if (pauseStartTime > 0) {
            totalPausedTime += (Date.now() - pauseStartTime);
            pauseStartTime = 0;
            logDebug('Resumed from paused state, total paused time: ' + totalPausedTime + 'ms');
          }
        }
      }
      
      // Start the timer
      function startTimer() {
        startTime = Date.now();
        totalPausedTime = 0;
        pauseStartTime = 0;
        updateTimer();
        logDebug('Timer started at: ' + new Date(startTime).toISOString());
      }
      
      // Update the timer display
      function updateTimer() {
        if (!timerElement) return;
        
        const now = Date.now();
        let elapsedSeconds = Math.floor((now - startTime - totalPausedTime) / 1000);
        
        // Handle paused state
        if (isPaused && pauseStartTime > 0) {
          elapsedSeconds = Math.floor((pauseStartTime - startTime - totalPausedTime) / 1000);
        }
        
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        
        timerElement.textContent = \`\${minutes.toString().padStart(2, '0')}:\${seconds.toString().padStart(2, '0')}\`;
      }
      
      const states = {
        idle: (deltaTime) => {
          // Use deltaTime for consistent animation speed regardless of frame rate
          const now = performance.now() / 1000;
          
          // Pre-calculate values outside the loop for better performance
          const baseScale = 0.2;
          
          bars.forEach((bar, i) => {
            const offset = i * 0.05;
            // More efficient sine wave calculation
            const wave1 = Math.sin(now * 2 + offset) * 0.06;
            const wave2 = Math.sin(now * 1.5 + offset * 2) * 0.04;
            const scale = baseScale + wave1 + wave2;
            
            // Only update transform if needed
            const newTransform = \`scaleY(\${scale.toFixed(3)})\`;
            if (bar._lastTransform !== newTransform) {
              bar.style.transform = newTransform;
              bar._lastTransform = newTransform;
            }
            
            // Update color less frequently for better performance
            if (i % 2 === 0 || !bar._lastColorUpdate || now - bar._lastColorUpdate > 0.1) {
              const hue = 355 + Math.floor(Math.sin(now + i * 0.1) * 5);
              const lightness = 50 + Math.floor(Math.sin(now * 0.7 + i * 0.15) * 5);
              const newBackground = \`linear-gradient(to top, 
                hsla(\${hue}, 90%, \${lightness}%, 0.5), 
                hsla(\${hue}, 90%, \${lightness + 10}%, 0.9))\`;
              
              if (bar._lastBackground !== newBackground) {
                bar.style.background = newBackground;
                bar._lastBackground = newBackground;
                bar._lastColorUpdate = now;
              }
            }
          });
        },
        active: (levels) => {
          if (!levels || !Array.isArray(levels)) return;
          
          // Simplified approach - directly map levels to bars
          const barsCount = bars.length;
          const levelsCount = levels.length;
          
          // Pre-calculate common values
          const minScale = 0.05; // Lower minimum scale for more dynamic range
          
          // Apply the levels to the bars with enhanced responsiveness
          bars.forEach((bar, i) => {
            // Map bar index to level index
            const levelIdx = Math.min(levelsCount - 1, Math.floor(i * levelsCount / barsCount));
            
            // Get the level value directly from the analyzer
            let level = levels[levelIdx] || 0;
            
            // Apply a power curve to emphasize changes in level
            // This makes small sounds more visible and large sounds more dramatic
            level = Math.pow(level, 0.7); // Power < 1 emphasizes smaller values
            
            // Apply scale with minimum value
            const scale = minScale + level * (1 - minScale);
            
            // Always update transform for maximum responsiveness
            bar.style.transform = \`scaleY(\${scale.toFixed(3)})\`;
            bar._lastTransform = \`scaleY(\${scale.toFixed(3)})\`;
            
            // Update colors based on intensity
            // Update every bar every frame for more visual impact
            const intensity = Math.min(100, Math.floor(level * 100));
            const hue = Math.max(0, 355 - intensity * 0.6); // More color shift with intensity
            const saturation = 90 + Math.floor(level * 10);
            const lightness = 50 + Math.floor(level * 20); // More brightness change
            
            const newBackground = \`linear-gradient(to top, 
              hsla(\${hue}, \${saturation}%, \${lightness}%, 0.5), 
              hsla(\${hue}, \${saturation}%, \${lightness + 15}%, 0.9))\`; // More contrast in gradient
            
            bar.style.background = newBackground;
            bar._lastBackground = newBackground;
            bar._lastColorUpdate = performance.now() / 1000;
          });
        }
      };
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