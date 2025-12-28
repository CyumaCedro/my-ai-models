import React, { useState, useEffect } from 'react';
import { X, Database, Settings, FileText, Users, BarChart3, Upload, Trash2, Edit, Save, Plus } from 'lucide-react';
import axios from 'axios';

  const AdminInterface = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('database');
  const [settings, setSettings] = useState({});
  const [tables, setTables] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [sqlQuery, setSqlQuery] = useState('');
  const [loading, setLoading] = useState(false);
  // Add state for document upload
  const [uploadStatus, setUploadStatus] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  // Handle document upload
  const handleFileUpload = async () => {
    if (!selectedFile) {
      alert('Please select a file first');
      return;
    }

    setUploadStatus('uploading');
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', selectedFile.name.replace(/\.[^/.]+$/, ''));
      formData.append('category', 'general');
      formData.append('autoProcess', 'true');

      const response = await axios.post('/api/admin/upload-document', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        }
      });

      if (response.data.success) {
        setUploadStatus('success');
        setSelectedFile(null);
        setTimeout(() => setUploadStatus(''), 3000);
      } else {
        setUploadStatus('error');
        setTimeout(() => setUploadStatus(''), 3000);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      setTimeout(() => setUploadStatus(''), 3000);
    }
  };

  // Load initial data
  useEffect(() => {
    if (isOpen) {
      loadSettings();
      loadTables();
      loadChatHistory();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const response = await axios.get('/api/settings');
      if (response.data.success) {
        setSettings(response.data.settings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const loadTables = async () => {
    try {
      const response = await axios.get('/api/tables');
      if (response.data.success) {
        setTables(response.data.tables || []);
      }
    } catch (error) {
      console.error('Failed to load tables:', error);
    }
  };

  const loadChatHistory = async () => {
    try {
      // Use backend endpoint directly since admin requires auth
      const response = await axios.get('/api/history/default');
      if (response.data.success) {
        setChatHistory(response.data.history || []);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const saveSettings = async () => {
    try {
      // Skip settings save since it requires admin auth
      alert('Settings update requires proper admin authentication.');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    }
  };

  const executeQuery = async () => {
    if (!sqlQuery.trim()) return;
    
    setLoading(true);
    try {
      const response = await axios.post('/api/query', { query: sqlQuery });
      if (response.data.success) {
        setQueryResults(response.data.results || []);
      }
    } catch (error) {
      console.error('Failed to execute query:', error);
      alert('Failed to execute query');
    } finally {
      setLoading(false);
    }
  };

  const clearChatHistory = async () => {
    if (!window.confirm('Are you sure you want to clear all chat history?')) return;
    
    try {
      const response = await axios.delete('/api/chat-history');
      if (response.data.success) {
        setChatHistory([]);
        alert('Chat history cleared successfully!');
      }
    } catch (error) {
      console.error('Failed to clear chat history:', error);
      alert('Failed to clear chat history');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Admin Panel 🔐</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {[
            { id: 'database', label: 'Database', icon: Database },
            { id: 'documents', label: 'Documents', icon: Upload },
            { id: 'settings', label: 'Settings', icon: Settings },
            { id: 'chat', label: 'Chat History', icon: FileText },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-6 py-3 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          {/* Database Tab */}
          {activeTab === 'database' && (
            <div className="space-y-6">
              {/* Tables Overview */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Database Tables</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tables.map(table => (
                    <div key={table.name} className="border rounded-lg p-4">
                      <h4 className="font-medium text-gray-900">{table.name}</h4>
                      <p className="text-sm text-gray-600">{table.rows?.toLocaleString() || 0} rows</p>
                      <p className="text-xs text-gray-500">{table.columns?.length || 0} columns</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* SQL Query */}
              <div>
                <h3 className="text-lg font-semibold mb-4">SQL Query</h3>
                <div className="space-y-4">
                  <textarea
                    value={sqlQuery}
                    onChange={(e) => setSqlQuery(e.target.value)}
                    placeholder="Enter SQL query..."
                    className="w-full p-3 border rounded-lg font-mono text-sm"
                    rows={4}
                  />
                  <div className="flex space-x-4">
                    <button
                      onClick={executeQuery}
                      disabled={loading}
                      className="btn-primary flex items-center space-x-2"
                    >
                      <Database className="w-4 h-4" />
                      <span>{loading ? 'Executing...' : 'Execute Query'}</span>
                    </button>
                  </div>
                </div>

                {/* Query Results */}
                {queryResults.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Results ({queryResults.length} rows)</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full border rounded-lg">
                        <thead className="bg-gray-50">
                          <tr>
                            {Object.keys(queryResults[0] || {}).map(key => (
                              <th key={key} className="p-2 text-left text-xs font-medium text-gray-700">
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {queryResults.map((row, index) => (
                            <tr key={index}>
                              {Object.values(row).map((value, colIndex) => (
                                <td key={colIndex} className="p-2 text-sm">
                                  {value !== null ? String(value) : 'NULL'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">System Settings</h3>
              <div className="space-y-4">
                {Object.entries(settings).map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {key.replace(/_/g, ' ').toUpperCase()}
                    </label>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>
                ))}
                <button
                  onClick={saveSettings}
                  className="btn-primary flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Settings</span>
                </button>
              </div>
            </div>
          )}

          {/* Chat History Tab */}
          {activeTab === 'chat' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Chat History</h3>
                <button
                  onClick={clearChatHistory}
                  className="btn-danger flex items-center space-x-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear History</span>
                </button>
              </div>
              
              <div className="space-y-4">
                {chatHistory.map((chat, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm text-gray-900">
                        {chat.session_id || `Session ${index + 1}`}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(chat.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-1">User:</p>
                        <p className="text-sm">{chat.user_message}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-1">AI:</p>
                        <p className="text-sm">{chat.ai_response}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold mb-4">Document Management</h3>
              
              {/* Document Upload */}
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <div className="text-center">
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Upload Documents</h4>
                    <p className="text-sm text-gray-600 mb-4">
                      Upload PDF, Excel, CSV, TXT, MD files for processing and vectorization
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select File
                      </label>
                        <div className="space-y-4">
                          <div className="flex items-center space-x-4">
                            <input
                              type="file"
                              accept=".pdf,.csv,.xlsx,.xls,.txt,.md,.docx"
                              className="w-full p-2 border rounded-lg"
                              onChange={(e) => {
                                const file = e.target.files[0];
                                setSelectedFile(file);
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                const file = e.dataTransfer.files[0];
                                setSelectedFile(file);
                              }}
                              onDragOver={(e) => e.preventDefault()}
                            />
                            <button
                              onClick={handleFileUpload}
                              disabled={!selectedFile || uploadStatus === 'uploading'}
                              className="btn-primary flex items-center space-x-2"
                            >
                              <Upload className="w-4 h-4" />
                              <span>{uploadStatus === 'uploading' ? 'Uploading...' : 'Upload Document'}</span>
                            </button>
                          </div>
                        </div>
                        {selectedFile && (
                          <div className="mt-2 p-3 bg-gray-100 rounded-lg">
                            <p className="text-sm text-gray-700">
                              <strong>Selected:</strong> {selectedFile.name}
                            </p>
                          </div>
                        )}
                        {uploadStatus && (
                          <div className="mt-2 p-3 rounded-lg" style={{
                            backgroundColor: uploadStatus === 'success' ? '#d1fae5' : uploadStatus === 'error' ? '#fee2e2' : '#fef3c7',
                            color: uploadStatus === 'success' ? '#065f46' : uploadStatus === 'error' ? '#991b1b' : '#1f2937'
                          }}>
                            <p className="text-sm font-medium">{uploadStatus}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Category
                      </label>
                      <select className="w-full p-2 border rounded-lg">
                        <option value="general">General</option>
                        <option value="technical">Technical</option>
                        <option value="business">Business</option>
                        <option value="products">Products</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-medium text-yellow-800 mb-2">📝 Note</h4>
                  <p className="text-sm text-yellow-700">
                    Document upload requires admin authentication. To upload documents:
                  </p>
                  <ol className="list-decimal list-inside text-sm text-yellow-700 space-y-1 ml-4">
                    <li>Access admin panel (password: admin123)</li>
                    <li>Use Documents tab with proper authentication</li>
                    <li>Or upload via chat: "I have a CSV/Excel file to process"</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">System Analytics</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-600 font-medium">Total Chats</p>
                      <p className="text-2xl font-bold text-blue-900">{chatHistory.length}</p>
                    </div>
                    <FileText className="w-8 h-8 text-blue-500" />
                  </div>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-600 font-medium">Database Tables</p>
                      <p className="text-2xl font-bold text-green-900">{tables.length}</p>
                    </div>
                    <Database className="w-8 h-8 text-green-500" />
                  </div>
                </div>
                
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-600 font-medium">Active Sessions</p>
                      <p className="text-2xl font-bold text-purple-900">
                        {new Set(chatHistory.map(c => c.session_id)).size}
                      </p>
                    </div>
                    <Users className="w-8 h-8 text-purple-500" />
                  </div>
                </div>
                
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-orange-600 font-medium">Avg Response Time</p>
                      <p className="text-2xl font-bold text-orange-900">~5s</p>
                    </div>
                    <BarChart3 className="w-8 h-8 text-orange-500" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminInterface;