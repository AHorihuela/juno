/**
 * AudioProcessingService - Audio processing for transcription
 * 
 * This service handles all audio-related functionality:
 * - Audio format conversion
 * - Audio chunking
 * - Noise reduction
 * - Volume normalization
 * - Audio caching
 */
const BaseService = require('../BaseService');
const LogManager = require('../../utils/LogManager');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const crypto = require('crypto');
const os = require('os');

// File system promises
const fsPromises = fs.promises;
const statAsync = promisify(fs.stat);
const unlinkAsync = promisify(fs.unlink);
const readFileAsync = promisify(fs.readFile);

// Get a logger for this module
const logger = LogManager.getLogger('AudioProcessingService');

// Constants
const DEFAULT_SAMPLE_RATE = 16000;
const DEFAULT_AUDIO_FORMAT = 'mp3';
const MAX_CACHED_FILES = 20;
const MAX_CACHE_SIZE_MB = 100;

class AudioProcessingService extends BaseService {
  constructor() {
    super('AudioProcessing');
    
    // Temporary directory for audio processing
    this.tempDir = path.join(os.tmpdir(), 'juno-audio-processing');
    
    // Audio cache - Map of hashes to file paths
    this.audioCache = new Map();
    
    // Processing settings
    this.processingSettings = {
      sampleRate: DEFAULT_SAMPLE_RATE,
      format: DEFAULT_AUDIO_FORMAT,
      normalizeVolume: true,
      reduceNoise: true,
      maxChunkDuration: 30, // seconds
      overlapDuration: 0.5  // seconds of overlap between chunks
    };
  }
  
  /**
   * Initialize the service
   * @private
   */
  async _initialize() {
    logger.info('Initializing AudioProcessingService');
    
    // Get required services
    this.configManager = await this.getService('config');
    this.metricsManager = await this.getService('metrics');
    
    // Create temp directory if it doesn't exist
    await this._ensureTempDirectory();
    
    // Load processing settings from config
    const configSettings = this.configManager.get('transcription.audioProcessing');
    if (configSettings && typeof configSettings === 'object') {
      this.processingSettings = {
        ...this.processingSettings,
        ...configSettings
      };
    }
    
    // Setup metrics
    if (this.metricsManager) {
      this.metricsManager.registerCounter('audio_processing.conversions', 'Number of audio conversions performed');
      this.metricsManager.registerCounter('audio_processing.cached_hits', 'Number of audio cache hits');
      this.metricsManager.registerCounter('audio_processing.cached_misses', 'Number of audio cache misses');
      this.metricsManager.registerGauge('audio_processing.cache_size', 'Size of audio cache in bytes');
    }
    
    // Initialize audio cache
    await this._initializeCache();
    
    logger.info('AudioProcessingService initialized');
  }
  
  /**
   * Shutdown the service
   * @private
   */
  async _shutdown() {
    logger.info('Shutting down AudioProcessingService');
    
    // Clear cache
    await this._clearCache();
    
    // Clear references
    this.configManager = null;
    this.metricsManager = null;
    this.audioCache.clear();
  }
  
  /**
   * Ensure temporary directory exists
   * @private
   */
  async _ensureTempDirectory() {
    try {
      // Create temp directory if it doesn't exist
      await fsPromises.mkdir(this.tempDir, { recursive: true });
      logger.debug(`Created temporary directory: ${this.tempDir}`);
    } catch (error) {
      logger.error('Error creating temporary directory:', error);
      throw error;
    }
  }
  
  /**
   * Initialize audio cache
   * @private
   */
  async _initializeCache() {
    try {
      // Create cache directory if it doesn't exist
      const cacheDir = path.join(this.tempDir, 'cache');
      await fsPromises.mkdir(cacheDir, { recursive: true });
      
      // Load existing cache files
      const files = await fsPromises.readdir(cacheDir);
      
      // Build cache map
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(cacheDir, file);
          
          try {
            // Read cache entry metadata
            const metadata = JSON.parse(await readFileAsync(filePath, 'utf8'));
            const audioPath = path.join(cacheDir, metadata.filename);
            
            // Check if audio file still exists
            try {
              await statAsync(audioPath);
              // Add to cache
              this.audioCache.set(metadata.hash, {
                path: audioPath,
                timestamp: metadata.timestamp,
                size: metadata.size,
                duration: metadata.duration,
                metadata: filePath
              });
            } catch (err) {
              // Audio file doesn't exist, remove metadata
              await unlinkAsync(filePath);
            }
          } catch (err) {
            logger.warn(`Invalid cache entry: ${file}`, err);
            // Remove invalid cache entry
            await unlinkAsync(filePath);
          }
        }
      }
      
      // Clean up cache if needed
      await this._cleanupCache();
      
      logger.info(`Initialized audio cache with ${this.audioCache.size} entries`);
    } catch (error) {
      logger.error('Error initializing audio cache:', error);
      // Continue despite cache init failure
    }
  }
  
  /**
   * Clean up audio cache
   * @private
   */
  async _cleanupCache() {
    try {
      // If cache is small enough, do nothing
      if (this.audioCache.size <= MAX_CACHED_FILES) {
        return;
      }
      
      // Calculate total cache size
      let totalSizeBytes = 0;
      for (const entry of this.audioCache.values()) {
        totalSizeBytes += entry.size;
      }
      
      // Convert to MB
      const totalSizeMB = totalSizeBytes / (1024 * 1024);
      
      // If cache is small enough, do nothing
      if (totalSizeMB <= MAX_CACHE_SIZE_MB && this.audioCache.size <= MAX_CACHED_FILES) {
        return;
      }
      
      // Sort entries by timestamp (oldest first)
      const entries = Array.from(this.audioCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Keep deleting until we're under limits
      while (
        (totalSizeMB > MAX_CACHE_SIZE_MB || entries.length > MAX_CACHED_FILES) &&
        entries.length > 0
      ) {
        const [hash, entry] = entries.shift();
        
        // Remove from cache
        this.audioCache.delete(hash);
        
        // Delete files
        await unlinkAsync(entry.path);
        await unlinkAsync(entry.metadata);
        
        // Update size
        totalSizeBytes -= entry.size;
        totalSizeMB = totalSizeBytes / (1024 * 1024);
      }
      
      // Update metrics
      if (this.metricsManager) {
        this.metricsManager.setGauge('audio_processing.cache_size', totalSizeBytes);
      }
      
      logger.info(`Cleaned up audio cache, new size: ${totalSizeMB.toFixed(2)} MB, ${this.audioCache.size} entries`);
    } catch (error) {
      logger.error('Error cleaning up audio cache:', error);
    }
  }
  
  /**
   * Clear audio cache
   * @private
   */
  async _clearCache() {
    try {
      // Delete all cache files
      for (const entry of this.audioCache.values()) {
        try {
          await unlinkAsync(entry.path);
          await unlinkAsync(entry.metadata);
        } catch (err) {
          // Ignore errors during cleanup
        }
      }
      
      // Clear cache map
      this.audioCache.clear();
      
      logger.info('Cleared audio cache');
    } catch (error) {
      logger.error('Error clearing audio cache:', error);
    }
  }
  
  /**
   * Convert audio file to format suitable for transcription
   * @param {string} audioFilePath - Path to audio file
   * @param {Object} options - Conversion options
   * @param {number} [options.sampleRate] - Sample rate in Hz
   * @param {string} [options.format] - Output format
   * @param {boolean} [options.normalizeVolume] - Normalize volume
   * @param {boolean} [options.reduceNoise] - Apply noise reduction
   * @param {boolean} [options.useCache] - Use audio cache
   * @returns {Promise<Object>} Conversion result with processed file path
   */
  async convertAudioForTranscription(audioFilePath, options = {}) {
    if (!audioFilePath) {
      throw new Error('Audio file path is required');
    }
    
    try {
      // Merge options with defaults
      const opts = {
        sampleRate: this.processingSettings.sampleRate,
        format: this.processingSettings.format,
        normalizeVolume: this.processingSettings.normalizeVolume,
        reduceNoise: this.processingSettings.reduceNoise,
        useCache: true,
        ...options
      };
      
      // Calculate hash for cache lookup
      const fileHash = await this._calculateFileHash(audioFilePath);
      const optionsHash = this._calculateOptionsHash(opts);
      const cacheHash = `${fileHash}-${optionsHash}`;
      
      // Check cache if enabled
      if (opts.useCache && this.audioCache.has(cacheHash)) {
        const cacheEntry = this.audioCache.get(cacheHash);
        
        try {
          // Verify file exists
          await statAsync(cacheEntry.path);
          
          // Update cache hit metric
          if (this.metricsManager) {
            this.metricsManager.incrementCounter('audio_processing.cached_hits');
          }
          
          logger.info(`Audio cache hit for ${audioFilePath}`);
          
          return {
            processedPath: cacheEntry.path,
            duration: cacheEntry.duration,
            fromCache: true,
            format: opts.format
          };
        } catch (err) {
          // File doesn't exist, remove from cache
          this.audioCache.delete(cacheHash);
        }
      }
      
      // Update cache miss metric
      if (this.metricsManager) {
        this.metricsManager.incrementCounter('audio_processing.cached_misses');
      }
      
      logger.info(`Converting audio file: ${audioFilePath}`);
      
      // Create output file path
      const outputFileName = `${path.basename(audioFilePath, path.extname(audioFilePath))}-${cacheHash}.${opts.format}`;
      const outputFilePath = path.join(this.tempDir, 'cache', outputFileName);
      
      // Prepare command arguments for ffmpeg
      const ffmpegArgs = this._prepareFfmpegArgs(audioFilePath, outputFilePath, opts);
      
      // Execute ffmpeg
      await this._executeCommand('ffmpeg', ffmpegArgs);
      
      // Get audio duration and file size
      const { duration, size } = await this._getAudioInfo(outputFilePath);
      
      // Add to cache if enabled
      if (opts.useCache) {
        // Create metadata file
        const metadataPath = path.join(this.tempDir, 'cache', `${cacheHash}.json`);
        const metadata = {
          hash: cacheHash,
          filename: outputFileName,
          timestamp: Date.now(),
          size,
          duration,
          source: path.basename(audioFilePath),
          options: opts
        };
        
        // Write metadata
        await fsPromises.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
        
        // Add to cache
        this.audioCache.set(cacheHash, {
          path: outputFilePath,
          timestamp: metadata.timestamp,
          size,
          duration,
          metadata: metadataPath
        });
        
        // Clean up cache if needed
        await this._cleanupCache();
        
        // Update cache size metric
        if (this.metricsManager) {
          let totalSize = 0;
          for (const entry of this.audioCache.values()) {
            totalSize += entry.size;
          }
          this.metricsManager.setGauge('audio_processing.cache_size', totalSize);
        }
      }
      
      // Update conversion metric
      if (this.metricsManager) {
        this.metricsManager.incrementCounter('audio_processing.conversions');
      }
      
      return {
        processedPath: outputFilePath,
        duration,
        fromCache: false,
        format: opts.format
      };
    } catch (error) {
      logger.error(`Error converting audio file: ${audioFilePath}`, error);
      throw error;
    }
  }
  
  /**
   * Split audio file into chunks
   * @param {string} audioFilePath - Path to audio file
   * @param {Object} options - Chunking options
   * @param {number} [options.maxDuration] - Maximum chunk duration in seconds
   * @param {number} [options.overlapDuration] - Duration of overlap between chunks in seconds
   * @returns {Promise<Array<Object>>} Array of chunk objects with paths and timestamps
   */
  async splitAudioIntoChunks(audioFilePath, options = {}) {
    if (!audioFilePath) {
      throw new Error('Audio file path is required');
    }
    
    try {
      // Merge options with defaults
      const opts = {
        maxDuration: this.processingSettings.maxChunkDuration,
        overlapDuration: this.processingSettings.overlapDuration,
        ...options
      };
      
      // Get audio duration
      const { duration } = await this._getAudioInfo(audioFilePath);
      
      // If audio is shorter than max duration, return as single chunk
      if (duration <= opts.maxDuration) {
        return [{
          path: audioFilePath,
          startTime: 0,
          endTime: duration,
          duration
        }];
      }
      
      logger.info(`Splitting audio file (${duration.toFixed(2)}s) into chunks of max ${opts.maxDuration}s`);
      
      const chunks = [];
      const fileExt = path.extname(audioFilePath);
      const fileBase = path.basename(audioFilePath, fileExt);
      
      // Calculate chunk boundaries
      for (let startTime = 0; startTime < duration; startTime += (opts.maxDuration - opts.overlapDuration)) {
        const endTime = Math.min(startTime + opts.maxDuration, duration);
        const chunkDuration = endTime - startTime;
        
        // Create output path for chunk
        const chunkFileName = `${fileBase}-chunk-${startTime.toFixed(2)}-${endTime.toFixed(2)}${fileExt}`;
        const chunkFilePath = path.join(this.tempDir, chunkFileName);
        
        // Prepare ffmpeg arguments
        const ffmpegArgs = [
          '-ss', startTime.toString(),
          '-t', chunkDuration.toString(),
          '-i', audioFilePath,
          '-c', 'copy',
          chunkFilePath
        ];
        
        // Execute ffmpeg to extract chunk
        await this._executeCommand('ffmpeg', ffmpegArgs);
        
        // Add chunk to result
        chunks.push({
          path: chunkFilePath,
          startTime,
          endTime,
          duration: chunkDuration
        });
        
        // Break if we've reached the end
        if (endTime >= duration) {
          break;
        }
      }
      
      logger.info(`Split audio into ${chunks.length} chunks`);
      
      return chunks;
    } catch (error) {
      logger.error(`Error splitting audio file: ${audioFilePath}`, error);
      throw error;
    }
  }
  
  /**
   * Get information about an audio file
   * @param {string} audioFilePath - Path to audio file
   * @returns {Promise<Object>} Audio information
   */
  async getAudioInfo(audioFilePath) {
    if (!audioFilePath) {
      throw new Error('Audio file path is required');
    }
    
    try {
      return await this._getAudioInfo(audioFilePath);
    } catch (error) {
      logger.error(`Error getting audio info: ${audioFilePath}`, error);
      throw error;
    }
  }
  
  /**
   * Clean up temporary files
   * @param {Array<string>} filePaths - Paths to files to clean up
   * @returns {Promise<void>}
   */
  async cleanupTempFiles(filePaths) {
    if (!filePaths || !Array.isArray(filePaths)) {
      return;
    }
    
    for (const filePath of filePaths) {
      try {
        // Skip if not in temp directory
        if (!filePath.startsWith(this.tempDir)) {
          continue;
        }
        
        // Skip if it's a cache file
        if (filePath.includes(path.join(this.tempDir, 'cache'))) {
          continue;
        }
        
        // Delete file
        await unlinkAsync(filePath);
        logger.debug(`Deleted temporary file: ${filePath}`);
      } catch (error) {
        logger.warn(`Error deleting temporary file: ${filePath}`, error);
      }
    }
  }
  
  /**
   * Calculate hash for a file
   * @param {string} filePath - Path to file
   * @returns {Promise<string>} File hash
   * @private
   */
  async _calculateFileHash(filePath) {
    try {
      // Get file stats
      const stats = await statAsync(filePath);
      
      // Use file size + modification time as a quick hash
      return crypto
        .createHash('md5')
        .update(`${filePath}-${stats.size}-${stats.mtime.getTime()}`)
        .digest('hex');
    } catch (error) {
      logger.error(`Error calculating file hash: ${filePath}`, error);
      throw error;
    }
  }
  
  /**
   * Calculate hash for options
   * @param {Object} options - Options to hash
   * @returns {string} Options hash
   * @private
   */
  _calculateOptionsHash(options) {
    try {
      return crypto
        .createHash('md5')
        .update(JSON.stringify(options))
        .digest('hex')
        .substring(0, 8); // Use shorter hash for options
    } catch (error) {
      logger.error('Error calculating options hash', error);
      return crypto.randomBytes(4).toString('hex');
    }
  }
  
  /**
   * Prepare ffmpeg arguments for audio conversion
   * @param {string} inputPath - Input file path
   * @param {string} outputPath - Output file path
   * @param {Object} options - Conversion options
   * @returns {Array<string>} ffmpeg arguments
   * @private
   */
  _prepareFfmpegArgs(inputPath, outputPath, options) {
    const args = ['-i', inputPath];
    
    // Add sample rate
    if (options.sampleRate) {
      args.push('-ar', options.sampleRate.toString());
    }
    
    // Add audio channel (mono)
    args.push('-ac', '1');
    
    // Add volume normalization if enabled
    if (options.normalizeVolume) {
      args.push('-filter:a', 'loudnorm');
    }
    
    // Add noise reduction if enabled
    if (options.reduceNoise) {
      // If already using filters, append to existing filter chain
      const filterIndex = args.findIndex(arg => arg === '-filter:a');
      if (filterIndex !== -1) {
        args[filterIndex + 1] += ',afftdn=nf=-25';
      } else {
        args.push('-filter:a', 'afftdn=nf=-25');
      }
    }
    
    // Add output format if specified
    if (options.format === 'wav') {
      args.push('-f', 'wav');
    } else if (options.format === 'mp3') {
      args.push('-codec:a', 'libmp3lame', '-qscale:a', '2');
    } else if (options.format === 'flac') {
      args.push('-codec:a', 'flac');
    }
    
    // Add output path
    args.push(outputPath);
    
    return args;
  }
  
  /**
   * Execute command with arguments
   * @param {string} command - Command to execute
   * @param {Array<string>} args - Command arguments
   * @returns {Promise<string>} Command output
   * @private
   */
  async _executeCommand(command, args) {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      // Build command string
      const cmdString = `${command} ${args.map(arg => {
        // Add quotes to arguments with spaces
        if (arg.includes(' ')) {
          return `"${arg}"`;
        }
        return arg;
      }).join(' ')}`;
      
      logger.debug(`Executing command: ${cmdString}`);
      
      // Execute command
      const { stdout, stderr } = await execAsync(cmdString);
      
      if (stderr && !stderr.includes('Output #0')) {
        logger.warn(`Command stderr: ${stderr}`);
      }
      
      return stdout;
    } catch (error) {
      logger.error(`Error executing command: ${command}`, error);
      throw error;
    }
  }
  
  /**
   * Get information about an audio file
   * @param {string} audioFilePath - Path to audio file
   * @returns {Promise<Object>} Audio information
   * @private
   */
  async _getAudioInfo(audioFilePath) {
    try {
      // Use ffprobe to get audio info
      const ffprobeArgs = [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-show_entries', 'stream=codec_name,channels,sample_rate',
        '-of', 'json',
        audioFilePath
      ];
      
      const output = await this._executeCommand('ffprobe', ffprobeArgs);
      const info = JSON.parse(output);
      
      // Get file stats
      const stats = await statAsync(audioFilePath);
      
      return {
        duration: parseFloat(info.format.duration || 0),
        format: info.format.format_name,
        codec: info.streams[0]?.codec_name,
        channels: parseInt(info.streams[0]?.channels || 1),
        sampleRate: parseInt(info.streams[0]?.sample_rate || 0),
        size: stats.size
      };
    } catch (error) {
      logger.error(`Error getting audio info: ${audioFilePath}`, error);
      
      // Return default values on error
      return {
        duration: 0,
        format: 'unknown',
        codec: 'unknown',
        channels: 1,
        sampleRate: 0,
        size: 0
      };
    }
  }
}

// Export a factory function instead of a singleton
module.exports = () => new AudioProcessingService(); 