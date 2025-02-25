import React, { useState, useEffect } from 'react';
import { formatShortcut } from '../../utils/formatters';
import { getIpcRenderer } from '../../utils/electron';

const Home = ({ isRecording, error, transcription, settings }) => {
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevels, setAudioLevels] = useState(Array(10).fill(0));
  
  // Handle recording duration timer
  useEffect(() => {
    let timer;
    if (isRecording) {
      timer = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
      // Simulate audio levels (in a real app, you'd get this from the audio API)
      const audioTimer = setInterval(() => {
        setAudioLevels(prev => {
          const newLevels = [...prev];
          newLevels.shift();
          newLevels.push(Math.random() * 0.8 + 0.2); // Random value between 0.2 and 1
          return newLevels;
        });
      }, 100);
      
      return () => {
        clearInterval(timer);
        clearInterval(audioTimer);
      };
    } else {
      setRecordingDuration(0);
      setAudioLevels(Array(10).fill(0));
    }
    
    return () => clearInterval(timer);
  }, [isRecording]);
  
  // Format seconds to MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Handle record button click
  const handleRecordClick = () => {
    const ipcRenderer = getIpcRenderer();
    if (!ipcRenderer) return;
    
    if (isRecording) {
      ipcRenderer.invoke('stop-recording');
    } else {
      ipcRenderer.invoke('start-recording');
    }
  };
  
  return (
    <>
      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-700">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">{typeof error === 'string' ? error : error.message || 'An error occurred'}</p>
          </div>
        </div>
      )}

      {/* Recording Status Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-4 h-4 rounded-full ${
              isRecording 
                ? 'bg-red-500 animate-pulse' 
                : 'bg-green-500'
            }`} />
            <h2 className="text-2xl font-semibold text-gray-900">
              {isRecording ? 'Recording...' : 'Ready to Record'}
            </h2>
          </div>
          
          {/* Audio Visualization */}
          <div className="w-full max-w-md mb-6 bg-gray-50 rounded-lg p-4 border border-gray-100">
            <div className="flex items-end justify-center h-16 gap-1 mb-2">
              {audioLevels.map((level, i) => (
                <div 
                  key={i}
                  className={`w-6 rounded-t transition-all duration-75 ${isRecording ? 'bg-red-500' : 'bg-gray-300'}`}
                  style={{ 
                    height: `${isRecording ? level * 100 : 10 + Math.sin(Date.now()/1000 + i*0.2) * 5}%`, 
                    opacity: isRecording ? (0.7 + (i * 0.03)) : 0.5,
                    background: isRecording 
                      ? `linear-gradient(to top, rgba(255, 59, 48, ${0.5 + level * 0.4}), rgba(255, 59, 48, ${0.7 + level * 0.3}))`
                      : `linear-gradient(to top, rgba(209, 213, 219, 0.5), rgba(209, 213, 219, 0.8))`,
                    transform: `scaleY(${isRecording ? level : 0.15 + Math.sin(Date.now()/1000 + i*0.2) * 0.05})`,
                    transformOrigin: 'bottom',
                    transition: 'transform 0.12s cubic-bezier(0.4, 0.0, 0.2, 1), background 0.2s ease'
                  }}
                />
              ))}
            </div>
            <div className="text-center text-gray-500 font-medium">
              {isRecording ? formatTime(recordingDuration) : 'Press button to start recording'}
            </div>
          </div>
          
          {/* Record Button */}
          <button
            onClick={handleRecordClick}
            className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg ${
              isRecording 
                ? 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 animate-pulse' 
                : 'bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
            }`}
            aria-label={isRecording ? 'Stop Recording' : 'Start Recording'}
          >
            {isRecording ? (
              <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" />
              </svg>
            ) : (
              <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            )}
            <span className="sr-only">{isRecording ? 'Stop Recording' : 'Start Recording'}</span>
          </button>
        </div>

        <div className="space-y-4 border-t border-gray-100 pt-6 mt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Keyboard Shortcuts</h3>
          <div className="flex items-center">
            <span className="text-gray-600 w-32">Start/Stop:</span>
            <div className="flex items-center gap-1" 
              dangerouslySetInnerHTML={{ __html: formatShortcut(settings.keyboardShortcut) }} />
          </div>
          <div className="flex items-center">
            <span className="text-gray-600 w-32">Cancel:</span>
            <div className="flex items-center">
              <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-md">Esc</kbd>
            </div>
          </div>
        </div>
      </div>

      {/* Latest Transcription */}
      {transcription && (
        <div className="mt-6 bg-white rounded-lg border border-gray-200">
          <div className="border-b border-gray-100 bg-gray-50/50 px-4 py-2 flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-700">Latest Transcription</h3>
            <div className="flex gap-2">
              <button 
                className="text-xs text-blue-600 hover:text-blue-800"
                onClick={() => {
                  navigator.clipboard.writeText(transcription)
                    .then(() => alert('Transcription copied to clipboard'))
                    .catch(err => console.error('Failed to copy:', err));
                }}
              >
                Copy
              </button>
            </div>
          </div>
          <div className="p-4">
            <p className="text-gray-700 whitespace-pre-wrap">{transcription}</p>
          </div>
        </div>
      )}
      
      {/* Empty State for No Transcription */}
      {!transcription && !isRecording && (
        <div className="mt-6 bg-white rounded-lg border border-gray-200 p-8 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-700 mb-2">No Transcriptions Yet</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Click the record button or use the keyboard shortcut to start recording. Your transcriptions will appear here.
          </p>
        </div>
      )}
    </>
  );
};

export default Home; 