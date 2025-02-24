import React from 'react';
import { formatShortcut } from '../../utils/formatters';

const Home = ({ isRecording, error, transcription, settings }) => (
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
      <div className="flex items-center gap-3 mb-8">
        <div className={`w-4 h-4 rounded-full ${
          isRecording 
            ? 'bg-red-500 animate-pulse' 
            : 'bg-green-500'
        }`} />
        <h2 className="text-2xl font-semibold text-gray-900">
          {isRecording ? 'Recording...' : 'Ready to Record'}
        </h2>
      </div>

      <div className="space-y-4">
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
        <div className="border-b border-gray-100 bg-gray-50/50 px-4 py-2">
          <h3 className="text-sm font-medium text-gray-700">Latest Transcription</h3>
        </div>
        <div className="p-4">
          <p className="text-gray-700 whitespace-pre-wrap">{transcription}</p>
        </div>
      </div>
    )}
  </>
);

export default Home; 