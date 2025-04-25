const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const LogManager = require('../../utils/LogManager');

// Get a logger for this module
const logger = LogManager.getLogger('AppleScriptExecutor');

/**
 * Utility class for executing AppleScript with timeouts and optimizations
 */
class AppleScriptExecutor {
  /**
   * Execute AppleScript with a timeout
   * @param {string} script - AppleScript to execute
   * @param {number} timeoutMs - Timeout in milliseconds
   * @param {string} logPrefix - Prefix for log messages
   * @param {number} maxBuffer - Maximum buffer size for script output (default: 5MB)
   * @returns {Promise<string>} Result of the script execution
   */
  static async execute(script, timeoutMs = 1000, logPrefix = 'AppleScriptExecutor', maxBuffer = 5 * 1024 * 1024) {
    let timeoutId = null;
    
    try {
      return await Promise.race([
        new Promise((resolve, reject) => {
          execFile('osascript', ['-e', script], { maxBuffer }, (error, stdout, stderr) => {
            if (error) {
              logger.error(`[${logPrefix}] AppleScript execution error:`, { 
                metadata: { 
                  error: error.message,
                  code: error.code,
                  stderr 
                } 
              });
              // Return empty string on error to continue the flow rather than failing
              resolve('');
            } else if (stderr) {
              logger.warn(`[${logPrefix}] AppleScript warning:`, stderr);
            }
            
            resolve(stdout.trim());
          });
        }),
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            logger.warn(`[${logPrefix}] AppleScript execution timed out after ${timeoutMs}ms`);
            reject(new Error(`AppleScript execution timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        })
      ]);
    } catch (error) {
      logger.error(`[${logPrefix}] Error executing AppleScript:`, error);
      return '';
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
  
  /**
   * Execute AppleScript with retries
   * @param {string} script - AppleScript to execute
   * @param {Object} options - Options for execution
   * @param {number} options.timeoutMs - Timeout in milliseconds (default: 1000)
   * @param {number} options.retries - Number of retries (default: 2)
   * @param {number} options.retryDelayMs - Delay between retries in milliseconds (default: 100)
   * @param {string} options.logPrefix - Prefix for log messages (default: 'AppleScriptExecutor')
   * @param {number} options.maxBuffer - Maximum buffer size for script output (default: 5MB)
   * @returns {Promise<string>} Result of the script execution
   */
  static async executeWithRetry(script, options = {}) {
    const {
      timeoutMs = 1000,
      retries = 2,
      retryDelayMs = 100,
      logPrefix = 'AppleScriptExecutor',
      maxBuffer = 5 * 1024 * 1024
    } = options;
    
    let lastError = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          logger.debug(`[${logPrefix}] Retry attempt ${attempt}/${retries}`);
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        }
        
        const result = await this.execute(script, timeoutMs, logPrefix, maxBuffer);
        if (result) {
          return result;
        }
      } catch (error) {
        logger.error(`[${logPrefix}] Error in attempt ${attempt}:`, error);
        lastError = error;
      }
    }
    
    logger.error(`[${logPrefix}] All retry attempts failed`);
    return '';
  }
  
  /**
   * Execute AppleScript from a pre-compiled file for better performance
   * @param {string} scriptPath - Path to compiled script file
   * @param {number} timeoutMs - Timeout in milliseconds
   * @param {string} logPrefix - Prefix for log messages
   * @param {number} maxBuffer - Maximum buffer size for script output (default: 5MB)
   * @returns {Promise<string>} Result of the script execution
   */
  static async executeFile(scriptPath, timeoutMs = 1000, logPrefix = 'AppleScriptExecutor', maxBuffer = 5 * 1024 * 1024) {
    let timeoutId = null;
    
    if (!fs.existsSync(scriptPath)) {
      logger.error(`[${logPrefix}] Script file does not exist: ${scriptPath}`);
      return '';
    }
    
    try {
      return await Promise.race([
        new Promise((resolve, reject) => {
          execFile('osascript', [scriptPath], { maxBuffer }, (error, stdout, stderr) => {
            if (error) {
              logger.error(`[${logPrefix}] AppleScript file execution error:`, { 
                metadata: { 
                  error: error.message,
                  code: error.code,
                  stderr 
                } 
              });
              // Return empty string on error to continue the flow rather than failing
              resolve('');
            } else if (stderr) {
              logger.warn(`[${logPrefix}] AppleScript file warning:`, stderr);
            }
            
            resolve(stdout.trim());
          });
        }),
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            logger.warn(`[${logPrefix}] AppleScript file execution timed out after ${timeoutMs}ms`);
            reject(new Error(`AppleScript file execution timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        })
      ]);
    } catch (error) {
      logger.error(`[${logPrefix}] Error executing AppleScript file:`, error);
      return '';
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
  
  /**
   * Compile an AppleScript to a file for repeated use
   * @param {string} script - AppleScript code
   * @param {string} outputPath - Path to save compiled script (if null, a temp file is created)
   * @returns {Promise<string>} Path to the compiled script file
   */
  static async compileScript(script, outputPath = null) {
    // Create temp file if output path not provided
    const scriptPath = outputPath || path.join(os.tmpdir(), `juno_script_${Date.now()}.scpt`);
    
    // Write script to temp file
    const scriptFilePath = path.join(os.tmpdir(), `juno_script_${Date.now()}.applescript`);
    
    try {
      // Write the script to a temporary file
      await fs.promises.writeFile(scriptFilePath, script);
      
      // Compile the script
      await new Promise((resolve, reject) => {
        execFile('osacompile', ['-o', scriptPath, scriptFilePath], (error) => {
          if (error) {
            logger.error('Failed to compile AppleScript:', error);
            reject(error);
          } else {
            resolve();
          }
        });
      });
      
      // Clean up the script source
      await fs.promises.unlink(scriptFilePath);
      
      return scriptPath;
    } catch (error) {
      logger.error('Error compiling AppleScript:', error);
      
      // Clean up any temp files
      try {
        if (fs.existsSync(scriptFilePath)) {
          await fs.promises.unlink(scriptFilePath);
        }
      } catch (cleanupError) {
        logger.error('Error cleaning up temp files:', cleanupError);
      }
      
      return null;
    }
  }
}

module.exports = AppleScriptExecutor; 