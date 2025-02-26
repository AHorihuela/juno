import React, { useState, useEffect, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import PageHeader from './common/PageHeader';
import ContentPreviewModal from './common/ContentPreviewModal';
import ErrorBoundary from './common/ErrorBoundary';

const MemoryManager = () => {
  const [memoryStats, setMemoryStats] = useState(null);
  const [memoryItems, setMemoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previewContent, setPreviewContent] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Get memory stats
        const stats = await window.electron.invoke('memory:getStats');
        setMemoryStats(stats);

        // Get memory items from context
        const contextMemory = await window.electron.invoke('context:getMemoryStats');
        setMemoryItems(contextMemory.items || []);
      } catch (err) {
        console.error('Error fetching memory data:', err);
        setError('Failed to load memory data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    
    // Set up a refresh interval
    const intervalId = setInterval(fetchData, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(intervalId);
  }, []);

  const handleDeleteItem = async (id) => {
    if (window.confirm('Are you sure you want to delete this memory item?')) {
      try {
        await window.electron.invoke('memory:deleteItem', { id });
        setMemoryItems(memoryItems.filter(item => item.id !== id));
        if (selectedItem && selectedItem.id === id) {
          setSelectedItem(null);
        }
      } catch (err) {
        console.error('Error deleting memory item:', err);
        setError('Failed to delete memory item. Please try again.');
      }
    }
  };

  const handleClearMemory = async () => {
    if (window.confirm('Are you sure you want to clear all memory? This action cannot be undone.')) {
      try {
        await window.electron.invoke('memory:clearMemory');
        setMemoryItems([]);
        setSelectedItem(null);
        // Refresh stats
        const stats = await window.electron.invoke('memory:getStats');
        setMemoryStats(stats);
      } catch (err) {
        console.error('Error clearing memory:', err);
        setError('Failed to clear memory. Please try again.');
      }
    }
  };

  // Filter and sort memory items
  const filteredAndSortedItems = useMemo(() => {
    // First filter by search term and type
    let filtered = memoryItems.filter(item => {
      const matchesSearch = searchTerm === '' || 
        (item.content && item.content.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.id && item.id.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.type && item.type.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesType = filterType === 'all' || item.type === filterType;
      
      return matchesSearch && matchesType;
    });
    
    // Then sort
    return filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      // Handle special cases
      if (sortBy === 'size') {
        aValue = parseFloat(a.size) || 0;
        bValue = parseFloat(b.size) || 0;
      } else if (sortBy === 'createdAt') {
        aValue = new Date(a.createdAt || 0).getTime();
        bValue = new Date(b.createdAt || 0).getTime();
      }
      
      // Apply sort order
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [memoryItems, searchTerm, filterType, sortBy, sortOrder]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setPreviewContent(JSON.stringify(item.content, null, 2));
  };

  if (loading) {
    return (
      <div className="flex flex-col space-y-4">
        <PageHeader title="Memory Manager" description="Manage application memory and view usage statistics" />
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col space-y-4">
        <PageHeader title="Memory Manager" description="Manage application memory and view usage statistics" />
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-2 text-sm font-medium text-red-700 hover:text-red-800"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Memory Manager</h2>
      
      <ErrorBoundary>
        {/* Memory Explanation */}
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg mb-6">
          <h3 className="font-medium mb-2">What is Memory?</h3>
          <p className="text-sm mb-2">
            Memory stores information from your conversations with Juno. This helps Juno remember context from previous interactions.
          </p>
          <p className="text-sm mb-2">
            <strong>Memory vs. AI Rules:</strong> While AI Rules define how Juno should behave (preferences, writing style, etc.), 
            Memory contains actual conversation data and context that Juno can recall.
          </p>
          <p className="text-sm mb-2">
            <strong>Memory Persistence:</strong> Juno uses a multi-tiered memory system:
          </p>
          <ul className="text-sm list-disc pl-5 mb-2">
            <li><strong>Working Memory:</strong> Short-lived items from the last 5 minutes</li>
            <li><strong>Short-Term Memory:</strong> Important items from your current session</li>
            <li><strong>Long-Term Memory:</strong> Valuable information that persists across sessions</li>
          </ul>
          <p className="text-sm">
            Items move between these tiers based on their relevance, usage, and importance.
          </p>
        </div>

        {/* Memory Usage Stats - Simplified */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Memory Usage</h3>
          <div className="flex flex-col space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Total Items</span>
              <span className="font-medium">{memoryStats?.totalItems || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total Size</span>
              <span className="font-medium">{memoryStats?.totalSizeMB?.toFixed(2) || '0.00'} MB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className={`font-medium ${
                memoryStats?.status === 'Good' ? 'text-green-500' : 
                memoryStats?.status === 'Warning' ? 'text-yellow-500' : 
                memoryStats?.status === 'Critical' ? 'text-red-500' : 'text-gray-500'
              }`}>
                {memoryStats?.status || 'Unknown'}
              </span>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search memory items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="conversation">Conversation</option>
                <option value="command">Command</option>
                <option value="system">System</option>
              </select>
              <button
                onClick={handleClearMemory}
                className="px-4 py-2 bg-red-50 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors"
              >
                Clear All Memory
              </button>
            </div>
          </div>
        </div>

        {/* Memory Items - Improved UI */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Memory Items</h3>
          </div>
          
          {filteredAndSortedItems.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No memory items found.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
              {/* Left panel - Item list */}
              <div className="col-span-1 border-r border-gray-200 max-h-[500px] overflow-y-auto">
                <div className="sticky top-0 bg-gray-50 p-3 border-b border-gray-200 flex items-center text-xs font-medium text-gray-500 uppercase">
                  <div className="flex-1 cursor-pointer" onClick={() => handleSort('id')}>
                    ID {sortBy === 'id' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </div>
                  <div className="flex-1 cursor-pointer" onClick={() => handleSort('type')}>
                    Type {sortBy === 'type' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </div>
                  <div className="flex-1 cursor-pointer text-right" onClick={() => handleSort('createdAt')}>
                    Created {sortBy === 'createdAt' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </div>
                </div>
                {filteredAndSortedItems.map((item) => (
                  <div 
                    key={item.id}
                    onClick={() => handleSelectItem(item)}
                    className={`p-3 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedItem && selectedItem.id === item.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-center">
                      <div className="flex-1 truncate text-sm font-medium text-gray-900">
                        {item.id.substring(0, 8)}...
                      </div>
                      <div className="flex-1 truncate text-sm text-gray-500">
                        {item.type || 'Unknown'}
                      </div>
                      <div className="flex-1 text-right text-sm text-gray-500">
                        {item.createdAt ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true }) : 'Unknown'}
                      </div>
                    </div>
                    {item.tier && (
                      <div className="mt-1">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          item.tier === 'working' ? 'bg-yellow-100 text-yellow-800' :
                          item.tier === 'short-term' ? 'bg-blue-100 text-blue-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {item.tier === 'working' ? 'Working' : 
                           item.tier === 'short-term' ? 'Short-term' : 'Long-term'}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Right panel - Item details */}
              <div className="col-span-2 max-h-[500px] overflow-y-auto">
                {selectedItem ? (
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-lg font-medium text-gray-900 mb-1">
                          {selectedItem.id}
                        </h4>
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <span>{selectedItem.type || 'Unknown'}</span>
                          <span>•</span>
                          <span>{(selectedItem.size / 1024).toFixed(2)} KB</span>
                          <span>•</span>
                          <span>
                            {selectedItem.createdAt 
                              ? formatDistanceToNow(new Date(selectedItem.createdAt), { addSuffix: true }) 
                              : 'Unknown'}
                          </span>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setPreviewContent(JSON.stringify(selectedItem.content, null, 2));
                            setIsPreviewOpen(true);
                          }}
                          className="px-3 py-1 bg-blue-50 text-blue-700 text-sm font-medium rounded-md hover:bg-blue-100 transition-colors"
                        >
                          View Full Content
                        </button>
                        <button
                          onClick={() => handleDeleteItem(selectedItem.id)}
                          className="px-3 py-1 bg-red-50 text-red-700 text-sm font-medium rounded-md hover:bg-red-100 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Content Preview</h5>
                      <pre className="text-xs whitespace-pre-wrap break-words overflow-auto max-h-[200px]">
                        {typeof selectedItem.content === 'string' 
                          ? selectedItem.content.substring(0, 500) + (selectedItem.content.length > 500 ? '...' : '')
                          : JSON.stringify(selectedItem.content, null, 2).substring(0, 500) + '...'}
                      </pre>
                    </div>
                    
                    {selectedItem.tier && (
                      <div className="mb-4">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Memory Tier</h5>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full ${
                            selectedItem.tier === 'working' ? 'bg-yellow-100 text-yellow-800' :
                            selectedItem.tier === 'short-term' ? 'bg-blue-100 text-blue-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {selectedItem.tier === 'working' ? 'Working Memory' : 
                             selectedItem.tier === 'short-term' ? 'Short-term Memory' : 'Long-term Memory'}
                          </span>
                          <span className="text-sm text-gray-500">
                            {selectedItem.tier === 'working' 
                              ? '(Expires after 5 minutes)' 
                              : selectedItem.tier === 'short-term'
                                ? '(Persists for current session)'
                                : '(Persists across sessions)'}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {(selectedItem.accessCount !== undefined || selectedItem.usefulnessScore !== undefined) && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Usage Statistics</h5>
                        <div className="grid grid-cols-2 gap-4">
                          {selectedItem.accessCount !== undefined && (
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <div className="text-sm text-gray-500">Access Count</div>
                              <div className="text-lg font-medium">{selectedItem.accessCount}</div>
                            </div>
                          )}
                          {selectedItem.usefulnessScore !== undefined && (
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <div className="text-sm text-gray-500">Usefulness Score</div>
                              <div className="text-lg font-medium">{selectedItem.usefulnessScore}/10</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500 p-6">
                    Select a memory item to view details
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </ErrorBoundary>

      {/* Content Preview Modal */}
      <ContentPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        content={previewContent}
      />
    </div>
  );
};

export default MemoryManager; 