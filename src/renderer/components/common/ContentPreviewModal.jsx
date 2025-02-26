import React from 'react';

const ContentPreviewModal = ({ isOpen, onClose, content }) => {
  if (!isOpen) return null;

  // Try to parse JSON content for better display
  let displayContent = content;
  let isJson = false;
  
  try {
    // Check if content is already a JSON string
    if (typeof content === 'string') {
      // Try to parse it to see if it's valid JSON
      JSON.parse(content);
      isJson = true;
      displayContent = content; // Keep it as a formatted string
    }
  } catch (e) {
    // Not valid JSON, use as is
    displayContent = content;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Memory Content</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 focus:outline-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-auto max-h-[calc(80vh-8rem)]">
          {isJson ? (
            <pre className="whitespace-pre-wrap break-words bg-gray-50 p-4 rounded-lg text-sm font-mono">
              {displayContent}
            </pre>
          ) : (
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm whitespace-pre-wrap break-words">
                {displayContent || "No content available"}
              </p>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContentPreviewModal; 