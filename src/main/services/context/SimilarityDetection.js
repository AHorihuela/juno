/**
 * SimilarityDetection - Utility for detecting similar content
 * 
 * This module provides functions to detect similarity between text content
 * to avoid duplicates in the context history.
 */

/**
 * Calculate similarity between two strings (0-1)
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score (0-1)
 */
function calculateSimilarity(str1, str2) {
  // Simple implementation of similarity based on common words
  const words1 = new Set(str1.toLowerCase().split(/\s+/));
  const words2 = new Set(str2.toLowerCase().split(/\s+/));
  
  // Count common words
  let commonCount = 0;
  for (const word of words1) {
    if (words2.has(word)) {
      commonCount++;
    }
  }
  
  // Calculate Jaccard similarity
  const totalUniqueWords = new Set([...words1, ...words2]).size;
  return totalUniqueWords > 0 ? commonCount / totalUniqueWords : 0;
}

/**
 * Check if content is similar to existing context items
 * @param {Array} contextHistory - Array of context history items
 * @param {string} content - Content to check
 * @param {string} type - Type of content (e.g., 'clipboard', 'highlight')
 * @param {number} similarityThreshold - Threshold for similarity detection (0-1)
 * @returns {boolean} True if similar content exists
 */
function isSimilarToExistingContext(contextHistory, content, type, similarityThreshold = 0.8) {
  // Simple implementation: check if any existing item contains this content
  // or if this content contains any existing item
  return contextHistory.some(item => {
    // Skip different types
    if (item.type !== type) return false;
    
    const itemContent = item.content || '';
    
    // Check if one contains the other
    if (itemContent.includes(content) || content.includes(itemContent)) {
      return true;
    }
    
    // Check similarity using Levenshtein distance for shorter content
    if (content.length < 200 && itemContent.length < 200) {
      return calculateSimilarity(content, itemContent) > similarityThreshold;
    }
    
    return false;
  });
}

module.exports = {
  calculateSimilarity,
  isSimilarToExistingContext
}; 