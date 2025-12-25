import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Plus, Edit2, Trash2, Save, X, Bot, FileText, Database, MessageSquare, Upload, File, CheckCircle, AlertCircle, BarChart3, Clock, HardDrive, Tag } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

function AdminInterface({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('prompts');
  const [prompts, setPrompts] = useState([]);
  const [botConfigs, setBotConfigs] = useState([]);
  const [knowledge, setKnowledge] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [documentStats, setDocumentStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [processingStatus, setProcessingStatus] = useState({});

  // Form states
  const [promptForm, setPromptForm] = useState({
    name: '',
    type: 'system',
    content: '',
    variables: [],
    is_active: true,
    priority: 5,
  });

  const [botForm, setBotForm] = useState({
    name: '',
    personality: '',
    tone: 'professional',
    response_style: 'conversational',
    greeting_message: '',
    system_prompt: '',
    max_response_length: 500,
    use_emoji: false,
    use_context: true,
  });

  const [knowledgeForm, setKnowledgeForm] = useState({
    title: '',
    content: '',
    category: 'general',
    tags: [],
  });

  const [uploadForm, setUploadForm] = useState({
    title: '',
    category: 'general',
    tags: '',
    autoProcess: true,
  });

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'prompts') {
        const response = await fetch('/api/admin/prompts');
        const data = await response.json();
        if (data.success) setPrompts(data.prompts);
      } else if (activeTab === 'bots') {
        const response = await fetch('/api/admin/bot-configs');
        const data = await response.json();
        if (data.success) setBotConfigs(data.configs);
      } else if (activeTab === 'knowledge') {
        const response = await fetch('/api/admin/knowledge');
        const data = await response.json();
        if (data.success) setKnowledge(data.knowledge);
      } else if (activeTab === 'documents') {
        const response = await fetch('/api/admin/knowledge');
        const data = await response.json();
        if (data.success) {
          setDocuments(data.knowledge);
          loadDocumentStats();
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDocumentStats = async () => {
    try {
      const response = await fetch('/api/admin/documents/stats');
      const data = await response.json();
      if (data.success) setDocumentStats(data.stats);
    } catch (error) {
      console.error('Failed to load document stats:', error);
    }
  };

  const handleSavePrompt = async () => {
    try {
      const url = editingItem ? `/api/admin/prompts/${editingItem.id}` : '/api/admin/prompts';
      const method = editingItem ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(promptForm),
      });

      const data = await response.json();
      if (data.success) {
        setShowForm(false);
        setEditingItem(null);
        setPromptForm({
          name: '',
          type: 'system',
          content: '',
          variables: [],
          is_active: true,
          priority: 5,
        });
        loadData();
      }
    } catch (error) {
      console.error('Failed to save prompt:', error);
    }
  };

  const handleSaveBot = async () => {
    try {
      const url = editingItem ? `/api/admin/bot-configs/${editingItem.id}` : '/api/admin/bot-configs';
      const method = editingItem ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(botForm),
      });

      const data = await response.json();
      if (data.success) {
        setShowForm(false);
        setEditingItem(null);
        setBotForm({
          name: '',
          personality: '',
          tone: 'professional',
          response_style: 'conversational',
          greeting_message: '',
          system_prompt: '',
          max_response_length: 500,
          use_emoji: false,
          use_context: true,
        });
        loadData();
      }
    } catch (error) {
      console.error('Failed to save bot config:', error);
    }
  };

  const handleSaveKnowledge = async () => {
    try {
      const response = await fetch('/api/admin/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(knowledgeForm),
      });

      const data = await response.json();
      if (data.success) {
        setShowForm(false);
        setKnowledgeForm({
          title: '',
          content: '',
          category: 'general',
          tags: [],
        });
        loadData();
      }
    } catch (error) {
      console.error('Failed to save knowledge:', error);
    }
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    
    try {
      const response = await fetch(`/api/admin/${type === 'prompt' ? 'prompts' : type === 'bot' ? 'bot-configs' : 'knowledge'}/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadData();
      }
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  const startEdit = (item, type) => {
    setEditingItem(item);
    if (type === 'prompt') {
      setPromptForm(item);
    } else if (type === 'bot') {
      setBotForm(item);
    }
    setShowForm(true);
  };

  // File upload handlers
  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    for (const file of acceptedFiles) {
      await uploadDocument(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
      'application/json': ['.json']
    },
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const uploadDocument = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', uploadForm.title || file.name);
    formData.append('category', uploadForm.category);
    formData.append('tags', uploadForm.tags);
    formData.append('autoProcess', uploadForm.autoProcess);

    setUploadProgress(prev => ({
      ...prev,
      [file.name]: { uploading: true, progress: 0 }
    }));

    try {
      const response = await fetch('/api/admin/upload-document', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      setUploadProgress(prev => ({
        ...prev,
        [file.name]: { uploading: false, success: data.success, error: data.error }
      }));

      if (data.success) {
        setTimeout(() => {
          setUploadProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[file.name];
            return newProgress;
          });
        }, 3000);
        
        loadData();
      }
    } catch (error) {
      setUploadProgress(prev => ({
        ...prev,
        [file.name]: { uploading: false, success: false, error: error.message }
      }));
    }
  };

  const processDocument = async (docId) => {
    setProcessingStatus(prev => ({
      ...prev,
      [docId]: { processing: true }
    }));

    try {
      const response = await fetch(`/api/admin/process-document/${docId}`, {
        method: 'POST',
      });

      const data = await response.json();
      
      setProcessingStatus(prev => ({
        ...prev,
        [docId]: { processing: false, success: data.success, error: data.error }
      }));

      if (data.success) {
        loadData();
      }
    } catch (error) {
      setProcessingStatus(prev => ({
        ...prev,
        [docId]: { processing: false, success: false, error: error.message }
      }));
    }
  };

  const deleteDocument = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    
    try {
      const response = await fetch(`/api/admin/documents/${docId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadData();
      }
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const tabs = [
    { id: 'prompts', label: 'Prompts', icon: FileText },
    { id: 'bots', label: 'Bot Configurations', icon: Bot },
    { id: 'knowledge', label: 'Knowledge Base', icon: Database },
    { id: 'documents', label: 'Document Management', icon: File },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Settings className="w-6 h-6 text-primary-600" />
            <h2 className="text-2xl font-bold text-gray-900">Admin Panel</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-6 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600 bg-primary-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading...</p>
            </div>
          ) : activeTab === 'documents' ? (
            // Document Management Tab
            <div className="space-y-6">
              {/* Document Statistics */}
              {documentStats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-2">
                      <File className="w-5 h-5 text-blue-600" />
                      <h3 className="text-sm font-medium text-gray-700">Total Documents</h3>
                    </div>
                    <p className="text-2xl font-bold text-blue-600 mt-2">{documentStats.total}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <h3 className="text-sm font-medium text-gray-700">Processed</h3>
                    </div>
                    <p className="text-2xl font-bold text-green-600 mt-2">{documentStats.processed}</p>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-5 h-5 text-yellow-600" />
                      <h3 className="text-sm font-medium text-gray-700">Pending</h3>
                    </div>
                    <p className="text-2xl font-bold text-yellow-600 mt-2">{documentStats.total - documentStats.processed}</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <div className="flex items-center space-x-2">
                      <HardDrive className="w-5 h-5 text-purple-600" />
                      <h3 className="text-sm font-medium text-gray-700">Total Size</h3>
                    </div>
                    <p className="text-2xl font-bold text-purple-600 mt-2">{formatFileSize(documentStats.total_size)}</p>
                  </div>
                </div>
              )}

              {/* Upload Area */}
              <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-6">
                <div
                  {...getRootProps()}
                  className={`cursor-pointer text-center ${isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300'}`}
                >
                  <input {...getInputProps()} />
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {isDragActive ? 'Drop files here' : 'Upload Documents'}
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Drag and drop files here, or click to select files
                  </p>
                  <p className="text-sm text-gray-400">
                    Supports: TXT, MD, PDF, DOCX, DOC, XLS, XLSX, CSV, JSON (Max 50MB)
                  </p>
                </div>

                {/* Upload Form */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Default Title</label>
                    <input
                      type="text"
                      value={uploadForm.title}
                      onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Auto-generated from filename"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={uploadForm.category}
                      onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="general">General</option>
                      <option value="technical">Technical</option>
                      <option value="business">Business</option>
                      <option value="legal">Legal</option>
                      <option value="medical">Medical</option>
                      <option value="education">Education</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
                    <input
                      type="text"
                      value={uploadForm.tags}
                      onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="tag1, tag2, tag3"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={uploadForm.autoProcess}
                      onChange={(e) => setUploadForm({ ...uploadForm, autoProcess: e.target.checked })}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">Automatically process documents for RAG</span>
                  </label>
                </div>

                {/* Upload Progress */}
                {Object.keys(uploadProgress).length > 0 && (
                  <div className="mt-6 space-y-2">
                    <h4 className="text-sm font-medium text-gray-700">Upload Progress</h4>
                    {Object.entries(uploadProgress).map(([filename, status]) => (
                      <div key={filename} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center space-x-2">
                          {status.uploading && (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                          )}
                          {status.success && <CheckCircle className="w-4 h-4 text-green-600" />}
                          {!status.success && status.error && <AlertCircle className="w-4 h-4 text-red-600" />}
                          <span className="text-sm text-gray-700 truncate max-w-xs">{filename}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {status.uploading && 'Uploading...'}
                          {status.success && 'Success'}
                          {!status.success && status.error && 'Failed'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Documents List */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Uploaded Documents</h3>
                {documents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <File className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No documents uploaded yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div key={doc.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <h4 className="font-semibold text-gray-900">{doc.title}</h4>
                              {doc.processed && (
                                <CheckCircle className="w-4 h-4 text-green-600" title="Processed for RAG" />
                              )}
                              {!doc.processed && (
                                <Clock className="w-4 h-4 text-yellow-600" title="Not processed" />
                              )}
                            </div>
                            <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                              <span>Category: {doc.category}</span>
                              {doc.file_info?.size && (
                                <span>Size: {formatFileSize(doc.file_info.size)}</span>
                              )}
                              {doc.created_at && (
                                <span>Uploaded: {new Date(doc.created_at).toLocaleDateString()}</span>
                              )}
                            </div>
                            {doc.tags && doc.tags.length > 0 && (
                              <div className="flex items-center space-x-2 mt-2">
                                <Tag className="w-4 h-4 text-gray-400" />
                                <div className="flex flex-wrap gap-1">
                                  {doc.tags.map((tag, index) => (
                                    <span key={index} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            {!doc.processed && (
                              <button
                                onClick={() => processDocument(doc.id)}
                                disabled={processingStatus[doc.id]?.processing}
                                className="text-green-600 hover:text-green-800 disabled:text-gray-400"
                                title="Process for RAG"
                              >
                                {processingStatus[doc.id]?.processing ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                                ) : (
                                  <CheckCircle className="w-4 h-4" />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => deleteDocument(doc.id)}
                              className="text-red-600 hover:text-red-800"
                              title="Delete document"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Add Button */}
              <div className="mb-6">
                <button
                  onClick={() => {
                    setEditingItem(null);
                    if (activeTab === 'prompts') {
                      setPromptForm({
                        name: '',
                        type: 'system',
                        content: '',
                        variables: [],
                        is_active: true,
                        priority: 5,
                      });
                    } else if (activeTab === 'bots') {
                      setBotForm({
                        name: '',
                        personality: '',
                        tone: 'professional',
                        response_style: 'conversational',
                        greeting_message: '',
                        system_prompt: '',
                        max_response_length: 500,
                        use_emoji: false,
                        use_context: true,
                      });
                    } else if (activeTab === 'knowledge') {
                      setKnowledgeForm({
                        title: '',
                        content: '',
                        category: 'general',
                        tags: [],
                      });
                    }
                    setShowForm(true);
                  }}
                  className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 transition-colors flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New {activeTab === 'prompts' ? 'Prompt' : activeTab === 'bots' ? 'Bot Config' : 'Knowledge'}</span>
                </button>
              </div>

              {/* Lists */}
              {activeTab === 'prompts' && (
                <div className="space-y-4">
                  {prompts.map((prompt) => (
                    <div key={prompt.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{prompt.name}</h3>
                          <p className="text-sm text-gray-500 mt-1">Type: {prompt.type} | Priority: {prompt.priority}</p>
                          <p className="text-sm text-gray-600 mt-2 line-clamp-2">{prompt.content}</p>
                          <div className="flex items-center space-x-2 mt-2">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              prompt.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {prompt.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={() => startEdit(prompt, 'prompt')}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete('prompt', prompt.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'bots' && (
                <div className="space-y-4">
                  {botConfigs.map((config) => (
                    <div key={config.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{config.name}</h3>
                          <p className="text-sm text-gray-500 mt-1">Tone: {config.tone} | Style: {config.response_style}</p>
                          <p className="text-sm text-gray-600 mt-2">{config.personality}</p>
                          {config.greeting_message && (
                            <p className="text-sm text-gray-500 mt-2 italic">"{config.greeting_message}"</p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={() => startEdit(config, 'bot')}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete('bot', config.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'knowledge' && (
                <div className="space-y-4">
                  {knowledge.map((item) => (
                    <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{item.title}</h3>
                          <p className="text-sm text-gray-500 mt-1">Category: {item.category}</p>
                          <p className="text-sm text-gray-600 mt-2 line-clamp-3">{item.content}</p>
                          {item.tags && item.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {item.tags.map((tag, index) => (
                                <span key={index} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={() => handleDelete('knowledge', item.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-60">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">
                {editingItem ? 'Edit' : 'Add New'} {activeTab === 'prompts' ? 'Prompt' : activeTab === 'bots' ? 'Bot Configuration' : 'Knowledge'}
              </h3>

              {activeTab === 'prompts' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={promptForm.name}
                      onChange={(e) => setPromptForm({ ...promptForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={promptForm.type}
                      onChange={(e) => setPromptForm({ ...promptForm, type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="system">System</option>
                      <option value="user_context">User Context</option>
                      <option value="response_style">Response Style</option>
                      <option value="tone">Tone</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                    <textarea
                      value={promptForm.content}
                      onChange={(e) => setPromptForm({ ...promptForm, content: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      rows={4}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <input
                      type="number"
                      value={promptForm.priority}
                      onChange={(e) => setPromptForm({ ...promptForm, priority: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      min="1"
                      max="10"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'bots' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={botForm.name}
                      onChange={(e) => setBotForm({ ...botForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Personality</label>
                    <textarea
                      value={botForm.personality}
                      onChange={(e) => setBotForm({ ...botForm, personality: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
                      <select
                        value={botForm.tone}
                        onChange={(e) => setBotForm({ ...botForm, tone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="professional">Professional</option>
                        <option value="casual">Casual</option>
                        <option value="friendly">Friendly</option>
                        <option value="formal">Formal</option>
                        <option value="technical">Technical</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Response Style</label>
                      <select
                        value={botForm.response_style}
                        onChange={(e) => setBotForm({ ...botForm, response_style: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="concise">Concise</option>
                        <option value="detailed">Detailed</option>
                        <option value="conversational">Conversational</option>
                        <option value="analytical">Analytical</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Greeting Message</label>
                    <input
                      type="text"
                      value={botForm.greeting_message}
                      onChange={(e) => setBotForm({ ...botForm, greeting_message: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt</label>
                    <textarea
                      value={botForm.system_prompt}
                      onChange={(e) => setBotForm({ ...botForm, system_prompt: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      rows={3}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'knowledge' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                      type="text"
                      value={knowledgeForm.title}
                      onChange={(e) => setKnowledgeForm({ ...knowledgeForm, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                    <textarea
                      value={knowledgeForm.content}
                      onChange={(e) => setKnowledgeForm({ ...knowledgeForm, content: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      rows={6}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <input
                      type="text"
                      value={knowledgeForm.category}
                      onChange={(e) => setKnowledgeForm({ ...knowledgeForm, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
                    <input
                      type="text"
                      value={knowledgeForm.tags.join(', ')}
                      onChange={(e) => setKnowledgeForm({ ...knowledgeForm, tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2 mt-6">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (activeTab === 'prompts') handleSavePrompt();
                    else if (activeTab === 'bots') handleSaveBot();
                    else if (activeTab === 'knowledge') handleSaveKnowledge();
                  }}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Save</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminInterface;