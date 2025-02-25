import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import PageHeader from './common/PageHeader';

const MemoryManager = () => {
  const [memoryStats, setMemoryStats] = useState(null);
  const [memoryItems, setMemoryItems] = useState([]);
  const [aiStats, setAiStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
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
        setIsLoading(false);
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

  if (isLoading) {
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
    <div className="flex flex-col space-y-8">
      <PageHeader title="Memory Manager" description="Manage application memory and view usage statistics" />
      
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