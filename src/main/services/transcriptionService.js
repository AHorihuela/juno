/**
 * A stub implementation of the transcription service.
 * This will be replaced with actual Whisper API integration later.
 */
class TranscriptionService {
  /**
   * Stub method that simulates transcribing audio data to text.
   * @param {Buffer} audioData - The raw audio data to transcribe
   * @returns {Promise<string>} A promise that resolves to the transcribed text
   */
  async transcribeAudio(audioData) {
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // For now, just return a fixed string
    return "This is a stub transcription.";
  }
}

module.exports = new TranscriptionService(); 