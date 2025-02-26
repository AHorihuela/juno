const { exec } = require('child_process');

/**
 * Utility class for executing AppleScript with timeouts
 */
class AppleScriptExecutor {
  /**
   * Execute AppleScript with a timeout
   * @param {string} script - AppleScript to execute
   * @param {number} timeoutMs - Timeout in milliseconds
   * @param {string} logPrefix - Prefix for log messages
   * @returns {Promise<string>} Result of the script execution
   */
  static async execute(script, timeoutMs = 1000, logPrefix = 'AppleScriptExecutor') {
    return Promise.race([
      new Promise((resolve, reject) => {
        exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
          if (error) {
            console.error(`[${logPrefix}] AppleScript execution error:`, error);
            resolve(''); // Resolve with empty string on error to continue the flow
          } else if (stderr) {
            console.warn(`[${logPrefix}] AppleScript warning:`, stderr);
          }
          
          resolve(stdout.trim());
        });
      }),
      new Promise((resolve) => {
        setTimeout(() => {
          console.log(`[${logPrefix}] AppleScript execution timed out after ${timeoutMs}ms`);
          resolve('');
        }, timeoutMs);
      })
    ]);
  }
  
  /**
   * Execute AppleScript with retries
   * @param {string} script - AppleScript to execute
   * @param {Object} options - Options for execution
   * @param {number} options.timeoutMs - Timeout in milliseconds (default: 1000)
   * @param {number} options.retries - Number of retries (default: 2)
   * @param {number} options.retryDelayMs - Delay between retries in milliseconds (default: 100)
   * @param {string} options.logPrefix - Prefix for log messages (default: 'AppleScriptExecutor')
   * @returns {Promise<string>} Result of the script execution
   */
  static async executeWithRetry(script, options = {}) {
    const {
      timeoutMs = 1000,
      retries = 2,
      retryDelayMs = 100,
      logPrefix = 'AppleScriptExecutor'
    } = options;
    
    let lastError = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[${logPrefix}] Retry attempt ${attempt}/${retries}`);
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        }
        
        const result = await this.execute(script, timeoutMs, logPrefix);
        if (result) {
          return result;
        }
      } catch (error) {
        console.error(`[${logPrefix}] Error in attempt ${attempt}:`, error);
        lastError = error;
      }
    }
    
    console.error(`[${logPrefix}] All retry attempts failed`);
    return '';
  }
}

module.exports = AppleScriptExecutor; 