import React from 'react';
import { Link, Routes, Route, useLocation } from 'react-router-dom';
import GeneralSettings from './settings/GeneralSettings';
import AISettings from './settings/AISettings';

const Settings = () => {
  const location = useLocation();
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <h2 className="text-3xl font-bold text-gray-900 mb-6">Settings</h2>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex">
            <Link
              to="general"
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                location.pathname.endsWith('/general') || location.pathname === '/settings'
                  ? 'border-indigo-500 text-indigo-600 bg-indigo-50'
                  : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50 hover:border-gray-300'
              }`}
            >
              General Settings
            </Link>
            <Link
              to="ai"
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                location.pathname.endsWith('/ai')
                  ? 'border-indigo-500 text-indigo-600 bg-indigo-50'
                  : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50 hover:border-gray-300'
              }`}
            >
              AI Settings
            </Link>
          </nav>
        </div>

        {/* Content Area */}
        <div className="p-8">
          <Routes>
            <Route path="general" element={<GeneralSettings />} />
            <Route path="ai" element={<AISettings />} />
            <Route index element={<GeneralSettings />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default Settings; 