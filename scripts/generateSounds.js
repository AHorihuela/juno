const fs = require('fs');
const path = require('path');
const WavEncoder = require('wav-encoder');

// Function to generate a simple beep sound
function generateBeep(frequency, duration, sampleRate = 44100) {
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples);
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Generate sine wave
    samples[i] = Math.sin(2 * Math.PI * frequency * t);
    // Apply envelope
    const envelope = Math.sin(Math.PI * t / duration);
    samples[i] *= envelope;
  }
  
  return samples;
}

// Generate start sound (rising tone)
async function generateStartSound() {
  const sampleRate = 44100;
  const duration = 0.15;
  
  // Generate two beeps
  const beep1 = generateBeep(392, duration, sampleRate); // G4
  const beep2 = generateBeep(523.25, duration, sampleRate); // C5
  
  // Combine the beeps with a slight delay
  const delayInSamples = Math.floor(0.08 * sampleRate);
  const totalSamples = Math.max(beep1.length, beep2.length + delayInSamples);
  const combined = new Float32Array(totalSamples);
  
  // Add first beep
  for (let i = 0; i < beep1.length; i++) {
    combined[i] = beep1[i];
  }
  
  // Add second beep with delay
  for (let i = 0; i < beep2.length; i++) {
    combined[i + delayInSamples] = (combined[i + delayInSamples] || 0) + beep2[i];
  }
  
  return WavEncoder.encode({
    sampleRate,
    channelData: [combined]
  });
}

// Generate stop sound (falling tone)
async function generateStopSound() {
  const sampleRate = 44100;
  const duration = 0.15;
  
  // Generate two beeps
  const beep1 = generateBeep(523.25, duration, sampleRate); // C5
  const beep2 = generateBeep(392, duration, sampleRate); // G4
  
  // Combine the beeps with a slight delay
  const delayInSamples = Math.floor(0.08 * sampleRate);
  const totalSamples = Math.max(beep1.length, beep2.length + delayInSamples);
  const combined = new Float32Array(totalSamples);
  
  // Add first beep
  for (let i = 0; i < beep1.length; i++) {
    combined[i] = beep1[i];
  }
  
  // Add second beep with delay
  for (let i = 0; i < beep2.length; i++) {
    combined[i + delayInSamples] = (combined[i + delayInSamples] || 0) + beep2[i];
  }
  
  return WavEncoder.encode({
    sampleRate,
    channelData: [combined]
  });
}

async function main() {
  try {
    // Generate start sound
    console.log('Generating start sound...');
    const startBuffer = await generateStartSound();
    fs.writeFileSync(path.join(__dirname, '../assets/sounds/start.wav'), Buffer.from(startBuffer));
    console.log('Start sound generated successfully');
    
    // Generate stop sound
    console.log('Generating stop sound...');
    const stopBuffer = await generateStopSound();
    fs.writeFileSync(path.join(__dirname, '../assets/sounds/stop.wav'), Buffer.from(stopBuffer));
    console.log('Stop sound generated successfully');
  } catch (error) {
    console.error('Error generating sounds:', error);
  }
}

main(); 