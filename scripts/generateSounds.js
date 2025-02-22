const fs = require('fs');
const path = require('path');
const WavEncoder = require('wav-encoder');

// Base function for generating a simple beep
function generateBeep(frequency, duration, sampleRate = 44100, volume = 1.0) {
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples);
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    samples[i] = Math.sin(2 * Math.PI * frequency * t);
    const envelope = 0.5 * (1 - Math.cos(2 * Math.PI * t / duration));
    samples[i] *= envelope * volume;
  }
  
  return samples;
}

// Gentle pop sound
function generatePop(duration, sampleRate = 44100, volume = 1.0) {
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples);
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const frequency = 300 * Math.exp(-t * 15);
    samples[i] = Math.sin(2 * Math.PI * frequency * t);
    const envelope = Math.exp(-t * 20);
    samples[i] *= envelope * volume * 0.8;
  }
  
  return samples;
}

// Soft click sound
function generateClick(duration, sampleRate = 44100, volume = 1.0) {
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples);
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    samples[i] = (Math.random() * 2 - 1) * Math.exp(-t * 80);
    samples[i] *= volume * 0.3;
  }
  
  return samples;
}

// Low chime sound
function generateLowChime(frequency, duration, sampleRate = 44100, volume = 1.0) {
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples);
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const main = Math.sin(2 * Math.PI * frequency * t);
    const harmonic1 = Math.sin(2 * Math.PI * frequency * 2 * t) * 0.2;
    const harmonic2 = Math.sin(2 * Math.PI * frequency * 3 * t) * 0.05;
    samples[i] = (main + harmonic1 + harmonic2) / 1.25;
    const envelope = Math.exp(-t * 6);
    samples[i] *= envelope * volume * 0.4;
  }
  
  return samples;
}

// Enhanced hybrid sound with directional frequency shift
function generateDirectionalHybridSound(startFreq, endFreq, duration, sampleRate = 44100, volume = 1.0) {
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples);
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Linear frequency transition from start to end
    const currentFreq = startFreq + (endFreq - startFreq) * (t / duration);
    // Sine wave base
    samples[i] = Math.sin(2 * Math.PI * currentFreq * t);
    // Smooth envelope with quick attack and gentle decay
    const envelope = Math.exp(-t * 8) * (1 - Math.exp(-t * 40));
    samples[i] *= envelope * volume * 0.35;
  }
  
  return samples;
}

// Generate variations of start sounds
async function generateStartSoundVariations() {
  const sampleRate = 44100;
  
  // Rising tone for start (150Hz to 200Hz)
  const startSound = generateDirectionalHybridSound(150, 200, 0.12, sampleRate, 0.4);
  
  return {
    'start': await WavEncoder.encode({ sampleRate, channelData: [startSound] })
  };
}

// Generate variations of stop sounds
async function generateStopSoundVariations() {
  const sampleRate = 44100;
  
  // Falling tone for stop (200Hz to 150Hz)
  const stopSound = generateDirectionalHybridSound(200, 150, 0.12, sampleRate, 0.35);
  
  return {
    'stop': await WavEncoder.encode({ sampleRate, channelData: [stopSound] })
  };
}

async function main() {
  try {
    const soundsDir = path.join(__dirname, '../assets/sounds');
    
    // Ensure the sounds directory exists
    if (!fs.existsSync(soundsDir)) {
      fs.mkdirSync(soundsDir, { recursive: true });
    }
    
    // Generate hybrid sounds
    console.log('Generating hybrid sounds...');
    const startSounds = await generateStartSoundVariations();
    const stopSounds = await generateStopSoundVariations();
    
    // Save the sounds
    for (const [name, buffer] of Object.entries(startSounds)) {
      fs.writeFileSync(path.join(soundsDir, `${name}.wav`), Buffer.from(buffer));
      console.log(`Generated ${name}.wav`);
    }
    
    for (const [name, buffer] of Object.entries(stopSounds)) {
      fs.writeFileSync(path.join(soundsDir, `${name}.wav`), Buffer.from(buffer));
      console.log(`Generated ${name}.wav`);
    }
    
    console.log('Hybrid sounds generated successfully');
  } catch (error) {
    console.error('Error generating sounds:', error);
  }
}

main(); 