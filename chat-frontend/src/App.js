import React, { useState, useEffect, useRef } from 'react';
import { Send, Settings, Database, MessageSquare, Trash2, Save, X, Copy, Check, ExternalLink, Image as ImageIcon, Table } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { format } from 'date-fns';
import 'katex/dist/katex.min.css';

function App() {
  const [copiedCode, setCopiedCode] = useState(null);
  const [expandedImages, setExpandedImages] = useState(new Set());

  // Enhanced DataTable component with better styling
  const DataTable = ({ rows }) => {
    if (!rows || !Array.isArray(rows) || rows.length === 0) return null;
    const columns = Object.keys(rows[0] || {});
    if (columns.length === 0) return null;
    
    const formatCell = (val) => {
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') return JSON.stringify(val, null, 2);
      if (typeof val === 'boolean') return val ? '✓' : '✗';
      return String(val);
    };

    return (
      <div className="mt-4">
        <div className="flex items-center space-x-2 mb-2">
          <Table className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">
            Query Results ({rows.length} rows)
          </span>
        </div>
        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
          <table className="enhanced-data-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx}>
                  {columns.map((col) => (
                    <td key={col}>
                      {typeof row[col] === 'object' ? (
                        <pre className="text-xs bg-gray-100 p-1 rounded overflow-x-auto">
                          {formatCell(row[col])}
                        </pre>
                      ) : (
                        formatCell(row[col])
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Custom components for enhanced markdown rendering
  const components = {
    // Code blocks with syntax highlighting and copy button
    code: ({ node, inline, className, children, ...props }) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      const codeContent = String(children).replace(/\n$/, '');
      const codeId = `code-${Math.random().toString(36).substr(2, 9)}`;

      if (!inline && language) {
        return (
          <div className="code-block-wrapper">
            <div className="flex items-center justify-between bg-gray-800 px-4 py-2 text-xs text-gray-300">
              <span>{language}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(codeContent);
                  setCopiedCode(codeId);
                  setTimeout(() => setCopiedCode(null), 2000);
                }}
                className="copy-button flex items-center space-x-1"
              >
                {copiedCode === codeId ? (
                  <>
                    <Check className="w-3 h-3" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <SyntaxHighlighter
              style={vscDarkPlus}
              language={language}
              PreTag="div"
              className="!mt-0 !rounded-t-none"
              {...props}
            >
              {codeContent}
            </SyntaxHighlighter>
          </div>
        );
      }

      // Inline code
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },

    // Enhanced tables
    table: ({ children }) => (
      <div className="overflow-x-auto my-4 rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full">{children}</table>
      </div>
    ),

    // Enhanced headings
    h1: ({ children }) => (
      <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-4 pb-2 border-b border-gray-200">
        {children}
      </h1>
    ),

    h2: ({ children }) => (
      <h2 className="text-xl font-semibold text-gray-900 mt-5 mb-3">
        {children}
      </h2>
    ),

    h3: ({ children }) => (
      <h3 className="text-lg font-semibold text-gray-900 mt-4 mb-2">
        {children}
      </h3>
    ),

    // Enhanced lists
    ul: ({ children }) => (
      <ul className="space-y-2 my-3">{children}</ul>
    ),

    ol: ({ children }) => (
      <ol className="space-y-2 my-3">{children}</ol>
    ),

    li: ({ children }) => (
      <li className="flex items-start space-x-2 text-gray-700 leading-relaxed">
        <span className="text-primary-600 mt-1">•</span>
        <span>{children}</span>
      </li>
    ),

    // Enhanced blockquotes
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-primary-600 pl-4 py-2 my-4 bg-gray-50 italic text-gray-700 rounded-r-lg">
        {children}
      </blockquote>
    ),

    // Enhanced images with lightbox functionality
    img: ({ src, alt, ...props }) => {
      const imageId = src || Math.random().toString(36).substr(2, 9);
      const isExpanded = expandedImages.has(imageId);

      if (isExpanded) {
        return (
          <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
            <div className="relative max-w-6xl max-h-full">
              <img
                src={src}
                alt={alt}
                className="max-w-full max-h-full object-contain rounded-lg"
                {...props}
              />
              <button
                onClick={() => {
                  const newExpanded = new Set(expandedImages);
                  newExpanded.delete(imageId);
                  setExpandedImages(newExpanded);
                }}
                className="absolute top-4 right-4 bg-white text-gray-800 p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="relative group cursor-pointer my-4" onClick={() => {
          const newExpanded = new Set(expandedImages);
          newExpanded.add(imageId);
          setExpandedImages(newExpanded);
        }}>
          <img
            src={src}
            alt={alt}
            className="max-w-full h-auto rounded-lg shadow-md transition-transform duration-200 group-hover:scale-105"
            {...props}
          />
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200 rounded-lg flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </div>
          {alt && (
            <p className="text-sm text-gray-600 mt-2 text-center italic">{alt}</p>
          )}
        </div>
      );
    },

    // Enhanced links with external icon
    a: ({ href, children }) => {
      const isExternal = href && (href.startsWith('http') || href.startsWith('www'));
      
      return (
        <a
          href={href}
          target={isExternal ? '_blank' : '_self'}
          rel={isExternal ? 'noopener noreferrer' : ''}
          className="text-primary-600 hover:text-primary-800 underline decoration-2 hover:decoration-primary-800 transition-colors duration-200 inline-flex items-center space-x-1"
        >
          {children}
          {isExternal && <ExternalLink className="w-3 h-3" />}
        </a>
      );
    },

    // Task lists
    input: ({ type, checked, disabled, ...props }) => {
      if (type === 'checkbox') {
        return (
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            {...props}
          />
        );
      }
      return <input type={type} {...props} />;
    },

    // Horizontal rules
    hr: () => (
      <hr className="my-6 border-gray-300 border-t-2" />
    ),

    // Paragraphs
    p: ({ children }) => (
      <p className="text-gray-700 leading-relaxed my-3">{children}</p>
    ),
  };

  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({});
  const [tables, setTables] = useState([]);
  const [tempSettings, setTempSettings] = useState({});
  const [databaseInfo, setDatabaseInfo] = useState({});
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
    loadDatabaseInfo();
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

  const loadDatabaseInfo = async () => {
    try {
      const response = await fetch('/health');
      const data = await response.json();
      setDatabaseInfo(data);
    } catch (error) {
      console.error('Failed to load database info:', error);
      setDatabaseInfo({ status: 'unknown', databaseType: 'Unknown' });
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
      let friendlyMessage = "I'm having trouble processing your request right now. Please try again.";
      
      // Provide more specific friendly messages for common errors
      if (error.message.includes('fetch')) {
        friendlyMessage = "I can't connect to the server right now. Please check your connection and try again.";
      } else if (error.message.includes('timeout')) {
        friendlyMessage = "The request is taking longer than expected. Please try a simpler question.";
      } else if (error.message.includes('database') || error.message.includes('query')) {
        friendlyMessage = "I'm having trouble accessing the data right now. Please try again in a moment.";
      } else if (error.message.includes('Ollama')) {
        friendlyMessage = "My AI assistant is temporarily unavailable. Please try again later.";
      } else if (error.message.includes('JSON')) {
        friendlyMessage = "I received an unexpected response. Please try your question again.";
      }
      
      const errorMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: friendlyMessage,
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
    setExpandedImages(new Set());
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
                <p className="text-sm text-gray-500">Powered by Ollama & {databaseInfo.databaseType || 'Database'}</p>
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
                    <p className="text-sm">Ask questions, and I will answer directly.</p>
                    <div className="mt-6 text-xs text-gray-400 space-y-1">
                      <p>• Supports markdown formatting</p>
                      <p>• Displays tables, images, and code</p>
                      <p>• Mathematical formulas with LaTeX</p>
                      <p>• Enhanced lists and links</p>
                    </div>
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
                      className={`chat-message max-w-4xl ${
                        message.type === 'user' ? 'user-message' : 'ai-message'
                      } ${message.isError ? 'bg-red-100' : ''}`}
                    >
                      <div className="enhanced-response">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeKatex]}
                          components={components}
                          className="prose prose-sm max-w-none"
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                      {message.type === 'ai' && message.queryResults && Array.isArray(message.queryResults) && message.queryResults.length > 0 && (
                        <DataTable rows={message.queryResults} />
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
                    placeholder="Ask anything... (e.g., 'Show me all customers' or 'How many orders are pending?')"
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
                    checked={(tempSettings.enable_schema_info ?? 'true') === 'true'}
                    onChange={(e) => setTempSettings({ ...tempSettings, enable_schema_info: e.target.checked ? 'true' : 'false' })}
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
