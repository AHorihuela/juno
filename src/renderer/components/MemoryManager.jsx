import React, { useState, useEffect, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import PageHeader from './common/PageHeader';
import ContentPreviewModal from './common/ContentPreviewModal';
import ErrorBoundary from './common/ErrorBoundary';

const MemoryManager = () => {
  const [memoryStats, setMemoryStats] = useState(null);
  const [memoryItems, setMemoryItems] = useState([]);
  const [aiStats, setAiStats] = useState(null);
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

        // Get AI usage stats
        const aiUsageStats = await window.electron.invoke('ai:getStats');
        setAiStats(aiUsageStats);
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

  // Handle sort change
  const handleSort = (field) => {
    if (sortBy === field) {
      // Toggle sort order if clicking the same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new sort field and default to descending
      setSortBy(field);
      setSortOrder('desc');
    }
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
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded relative mb-6">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      ) : (
        <ErrorBoundary>
          {/* Memory Usage Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Memory Usage</h3>
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
                  <span className="text-gray-500">Average Item Size</span>
      <div className="bg-white shadow rounded-lg overflow-hidden hover:shadow-md transition-shadow mt-6">
        <div className="flex flex-col sm:flex-row justify-between items-center p-4 sm:p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-2 sm:mb-0 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
            </svg>
            Memory Items
          </h3>
          <button
            onClick={handleClearMemory}
            className="px-4 py-2 bg-red-50 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Clear All Memory
          </button>
        </div>
        
        {/* Search and Filter */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4">
            <div className="flex-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Search memory items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <select
                className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="clipboard">Clipboard</option>
                <option value="highlight">Highlight</option>
                <option value="conversation">Conversation</option>
                <option value="context">Context</option>
              </select>
              <select
                className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  setSortBy(field);
                  setSortOrder(order);
                }}
              >
                <option value="createdAt-desc">Newest First</option>
                <option value="createdAt-asc">Oldest First</option>
                <option value="size-desc">Largest First</option>
                <option value="size-asc">Smallest First</option>
                <option value="type-asc">Type (A-Z)</option>
                <option value="type-desc">Type (Z-A)</option>
              </select>
            </div>
          </div>
          {filteredAndSortedItems.length > 0 && (
            <div className="mt-2 text-sm text-gray-500">
              Showing {filteredAndSortedItems.length} of {memoryItems.length} items
            </div>
          )}
        </div>
        
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  scope="col" 
                  className="w-1/6 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('id')}
                >
                  <div className="flex items-center">
                    ID
                    {sortBy === 'id' && (
                      <svg xmlns="http://www.w3.org/2000/svg" className={`ml-1 h-4 w-4 ${sortOrder === 'asc' ? 'transform rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="w-1/6 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('type')}
                >
                  <div className="flex items-center">
                    Type
                    {sortBy === 'type' && (
                      <svg xmlns="http://www.w3.org/2000/svg" className={`ml-1 h-4 w-4 ${sortOrder === 'asc' ? 'transform rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="w-1/6 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('size')}
                >
                  <div className="flex items-center">
                    Size
                    {sortBy === 'size' && (
                      <svg xmlns="http://www.w3.org/2000/svg" className={`ml-1 h-4 w-4 ${sortOrder === 'asc' ? 'transform rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="w-1/6 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('createdAt')}
                >
                  <div className="flex items-center">
                    Created
                    {sortBy === 'createdAt' && (
                      <svg xmlns="http://www.w3.org/2000/svg" className={`ml-1 h-4 w-4 ${sortOrder === 'asc' ? 'transform rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </th>
                <th scope="col" className="w-2/6 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Content
                </th>
                <th scope="col" className="relative px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedItems.length > 0 ? (
                filteredAndSortedItems.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.id.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.type || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(item.size / 1024).toFixed(2)} KB
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
      {/* Memory Usage Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Memory Usage</h3>
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
              <span className="text-gray-500">Average Item Size</span>
              <span className="font-medium">{memoryStats?.avgItemSizeKB?.toFixed(2) || '0.00'} KB</span>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Memory Health</h3>
          <div className="flex flex-col space-y-2">
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
            <div className="flex justify-between">
              <span className="text-gray-500">Memory Limit</span>
              <span className="font-medium">{memoryStats?.memoryLimitMB || 100} MB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Usage</span>
              <span className={`font-medium ${
                (memoryStats?.usagePercentage || 0) > 90 ? 'text-red-500' : 
                (memoryStats?.usagePercentage || 0) > 70 ? 'text-yellow-500' : 'text-green-500'
              }`}>
                {memoryStats?.usagePercentage?.toFixed(1) || '0.0'}%
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">AI Usage</h3>
          <div className="flex flex-col space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Total Tokens</span>
              <span className="font-medium">{aiStats?.totalTokens?.toLocaleString() || '0'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Prompt Tokens</span>
              <span className="font-medium">{aiStats?.promptTokens?.toLocaleString() || '0'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Completion Tokens</span>
              <span className="font-medium">{aiStats?.completionTokens?.toLocaleString() || '0'}</span>
            </div>
            {aiStats?.lastRequestTime && (
              <div className="flex justify-between">
                <span className="text-gray-500">Last Request</span>
                <span className="font-medium">
                  {formatDistanceToNow(new Date(aiStats.lastRequestTime), { addSuffix: true })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Memory Items */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Memory Items</h3>
          <button
            onClick={handleClearMemory}
            className="px-4 py-2 bg-red-50 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors"
          >
            Clear All Memory
          </button>
        </div>
        
        {memoryItems.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No memory items found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {memoryItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.id.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.type || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(item.size / 1024).toFixed(2)} KB
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.createdAt ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true }) : 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
    </div>
  );
};

export default MemoryManager; 