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

        {/* Memory Items */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Memory Items</h3>
          </div>
          
          {filteredAndSortedItems.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No memory items found.
            </div>
          ) : (
            <div className="overflow-x-auto max-w-full">
              <table className="w-full divide-y divide-gray-200 table-fixed">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                      ID
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                      Type
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                      Size
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                      Created
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAndSortedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3 text-sm font-medium text-gray-900 truncate">
                        {item.id.substring(0, 8)}...
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-500 truncate">
                        {item.type || 'Unknown'}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-500 truncate">
                        {(item.size / 1024).toFixed(2)} KB
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-500 truncate">
                        {item.createdAt ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true }) : 'Unknown'}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-500 flex space-x-2">
                        <button
                          onClick={() => {
                            setPreviewContent(JSON.stringify(item.content, null, 2));
                            setIsPreviewOpen(true);
                          }}
                          className="text-blue-600 hover:text-blue-900 mr-2"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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