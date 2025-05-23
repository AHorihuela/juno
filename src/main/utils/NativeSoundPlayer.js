/**
 * Native Sound Player Utility
 *
 * Provides a cross-platform method to play sound files using native OS commands.
 * This is typically used as a fallback or for specific system sounds.
 */
const { exec } = require('child_process');
const LogManager = require('./LogManager'); // Assuming LogManager is in the same directory

const logger = LogManager.getLogger('NativeSoundPlayer');

/**
 * Plays a sound file using native OS commands.
 *
 * @param {string} soundPath - The absolute path to the sound file.
 * @param {boolean} [isSync=false] - If true, waits for the sound to finish playing.
 * @returns {Promise<void>} A promise that resolves when the sound has been initiated (or finished if isSync is true),
 *                          or rejects on error.
 */
function playSound(soundPath, isSync = false) {
  return new Promise((resolve, reject) => {
    if (!soundPath) {
      logger.error('No soundPath provided.');
      return reject(new Error('No soundPath provided.'));
    }

    let cmd;
    const platform = process.platform;

    if (platform === 'darwin') { // macOS
      // Note: -v option for volume is removed for simplicity here.
      // Users should use appropriately volumed sound files.
      cmd = `afplay "${soundPath}"`;
    } else if (platform === 'win32') { // Windows
      cmd = isSync
        ? `powershell -ExecutionPolicy Bypass -NoProfile -Command "(New-Object Media.SoundPlayer '${soundPath}').PlaySync()"`
        : `powershell -ExecutionPolicy Bypass -NoProfile -Command "(New-Object Media.SoundPlayer '${soundPath}').Play()"`;
    } else if (platform === 'linux') { // Linux
      cmd = `paplay "${soundPath}"`;
      // Note: Linux 'paplay' typically plays asynchronously by default.
      // For true synchronous playback on Linux, more complex solutions might be needed,
      // but for typical notification sounds, async is usually acceptable.
      // If isSync is true, we're still using the Promise to wait for the command completion,
      // though paplay itself might not block.
    } else {
      logger.warn(`Unsupported platform for native sound playback: ${platform}`);
      return reject(new Error(`Unsupported platform: ${platform}`));
    }

    logger.debug(`Executing native sound command: ${cmd}`);

    const child = exec(cmd, (error) => {
      if (error) {
        logger.error(`Error playing sound '${soundPath}' using native command:`, error);
        reject(error);
      } else {
        // For async, this means the command was successfully initiated.
        // For sync, this means the command completed.
        resolve();
      }
    });

    // If synchronous, we also need to handle the 'exit' event for commands that do block.
    if (isSync) {
      child.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          const error = new Error(`Native sound command exited with code ${code}`);
          logger.error(`Native sound command for '${soundPath}' exited with code: ${code}`, error);
          reject(error);
        }
      });
      child.on('error', (processError) => {
         logger.error(`Error with sound process for '${soundPath}':`, processError);
         reject(processError);
      });
    }
  });
}

module.exports = {
  playSound,
};
