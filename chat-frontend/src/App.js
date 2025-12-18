import React, { useState, useEffect, useRef } from 'react';
import { Send, Settings, Database, MessageSquare, Trash2, Save, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';

function App() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({});
  const [tables, setTables] = useState([]);
  const [tempSettings, setTempSettings] = useState({});
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Initialize session and load data
    const newSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    setSessionId(newSessionId);
    loadSettings();
    loadTables();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      if (data.success) {
        setSettings(data.settings);
        setTempSettings(data.settings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const loadTables = async () => {
    try {
      const response = await fetch('/api/tables');
      const data = await response.json();
      if (data.success) {
        setTables(data.tables);
      }
    } catch (error) {
      console.error('Failed to load tables:', error);
    }
  };

  const saveSettings = async () => {
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ settings: tempSettings }),
      });
      const data = await response.json();
      if (data.success) {
        setSettings(tempSettings);
        setShowSettings(false);
        loadTables(); // Reload tables to reflect changes
      } else {
        alert('Failed to save settings: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId: sessionId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        const aiMessage = {
          id: Date.now() + 1,
          type: 'ai',
          content: data.response,
          timestamp: new Date(),
          tablesAccessed: data.tablesAccessed,
          queryResults: data.queryResults,
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: `Error: ${error.message}`,
        timestamp: new Date(),
        isError: true,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  const TypingIndicator = () => (
    <div className="flex items-center space-x-2 text-gray-500">
      <div className="typing-indicator">
        <div className="typing-dot"></div>
        <div className="typing-dot"></div>
        <div className="typing-dot"></div>
      </div>
      <span className="text-sm">AI is thinking...</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <MessageSquare className="w-8 h-8 text-primary-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">AI Database Chat</h1>
                <p className="text-sm text-gray-500">Powered by Ollama & MySQL</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={clearChat}
                className="btn-secondary flex items-center space-x-2"
                title="Clear chat"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Clear</span>
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="btn-secondary flex items-center space-x-2"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Database Info */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center space-x-2 mb-3">
                <Database className="w-5 h-5 text-primary-600" />
                <h3 className="font-semibold text-gray-900">Database Tables</h3>
              </div>
              <div className="space-y-2">
                {tables.map((table) => (
                  <div key={table.name} className="flex justify-between items-center text-sm">
                    <span className="font-medium text-gray-700">{table.name}</span>
                    <span className="text-gray-500">{table.count} rows</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Current Settings */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Current Settings</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Enabled Tables:</span>
                  <div className="text-gray-600 mt-1">
                    {settings.enabled_tables?.split(',').map(t => t.trim()).join(', ') || 'None'}
                  </div>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Max Results:</span>
                  <span className="text-gray-600 ml-2">{settings.max_results || '100'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Response Style:</span>
                  <span className="text-gray-600 ml-2 capitalize">{settings.response_style || 'professional'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Schema Info:</span>
                  <span className="text-gray-600 ml-2">{settings.enable_schema_info === 'true' ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Chat Area */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-lg h-[600px] flex flex-col">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                  <div className="text-center text-gray-500 mt-8">
                    <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">Start a conversation</p>
                    <p className="text-sm">Ask questions about your database, and I'll help you analyze the data!</p>
                  </div>
                )}
                
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`message-enter ${
                      message.type === 'user' ? 'flex justify-end' : 'flex justify-start'
                    }`}
                  >
                    <div
                      className={`chat-message ${
                        message.type === 'user' ? 'user-message' : 'ai-message'
                      } ${message.isError ? 'bg-red-100' : ''}`}
                    >
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                      {message.tablesAccessed && message.tablesAccessed.length > 0 && (
                        <div className="mt-2 text-xs text-gray-600">
                          <strong>Tables accessed:</strong> {message.tablesAccessed.join(', ')}
                        </div>
                      )}
                      <div className="mt-2 text-xs text-gray-400">
                        {format(message.timestamp, 'HH:mm:ss')}
                      </div>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="chat-message ai-message">
                      <TypingIndicator />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-gray-200 p-4">
                <div className="flex space-x-2">
                  <textarea
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask about your database... (e.g., 'Show me all customers' or 'How many orders are pending?')"
                    className="chat-input resize-none"
                    rows={2}
                    disabled={isLoading}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={isLoading || !inputMessage.trim()}
                    className="btn-primary self-end"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="settings-panel max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enabled Tables (comma-separated)
                </label>
                <input
                  type="text"
                  value={tempSettings.enabled_tables || ''}
                  onChange={(e) => setTempSettings({ ...tempSettings, enabled_tables: e.target.value })}
                  className="chat-input"
                  placeholder="customers,orders,products"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Results per Query
                </label>
                <input
                  type="number"
                  value={tempSettings.max_results || '100'}
                  onChange={(e) => setTempSettings({ ...tempSettings, max_results: e.target.value })}
                  className="chat-input"
                  min="1"
                  max="1000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Response Style
                </label>
                <select
                  value={tempSettings.response_style || 'professional'}
                  onChange={(e) => setTempSettings({ ...tempSettings, response_style: e.target.value })}
                  className="chat-input"
                >
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                  <option value="technical">Technical</option>
                </select>
              </div>

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={tempSettings.enable_schema_info === 'true'}
                    onChange={(e) => setTempSettings({ ...tempSettings, enable_schema_info: e.target.value.toString() })}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Include table schema information in AI context
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cache Duration (seconds)
                </label>
                <input
                  type="number"
                  value={tempSettings.cache_duration || '300'}
                  onChange={(e) => setTempSettings({ ...tempSettings, cache_duration: e.target.value })}
                  className="chat-input"
                  min="0"
                  max="3600"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setTempSettings(settings);
                  setShowSettings(false);
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={saveSettings}
                className="btn-primary flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>Save Settings</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
