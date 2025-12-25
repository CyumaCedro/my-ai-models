const express = require('express');
const router = express.Router();
const Joi = require('joi');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const pdf = require('pdf-parse');
const { Document } = require('docx');
const mammoth = require('mammoth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/plain',
      'text/markdown',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/json'
    ];
    
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(txt|md|pdf|docx|doc|xls|xlsx|csv|json)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// Validation schemas
const promptSchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  type: Joi.string().valid('system', 'user_context', 'response_style', 'tone').required(),
  content: Joi.string().required().min(1).max(2000),
  variables: Joi.array().items(Joi.string()).optional(),
  is_active: Joi.boolean().default(true),
  priority: Joi.number().min(1).max(10).default(5),
});

const botConfigSchema = Joi.object({
  name: Joi.string().required().min(1).max(50),
  personality: Joi.string().required().min(1).max(500),
  tone: Joi.string().valid('professional', 'casual', 'friendly', 'formal', 'technical').required(),
  response_style: Joi.string().valid('concise', 'detailed', 'conversational', 'analytical').required(),
  greeting_message: Joi.string().optional().max(200),
  system_prompt: Joi.string().optional().max(2000),
  max_response_length: Joi.number().min(50).max(2000).default(500),
  use_emoji: Joi.boolean().default(false),
  use_context: Joi.boolean().default(true),
});

// In-memory storage (replace with database in production)
let prompts = [];
let botConfigs = [];
let knowledgeBase = [];

// Initialize with default prompts
function initializeDefaultPrompts() {
  prompts = [
    {
      id: 'default_system',
      name: 'Default System Prompt',
      type: 'system',
      content: 'You are a helpful AI assistant. Provide accurate, helpful responses based on the context provided.',
      variables: [],
      is_active: true,
      priority: 1,
      created_at: new Date().toISOString(),
    },
    {
      id: 'user_context',
      name: 'User Context Template',
      type: 'user_context',
      content: 'User: {name} ({email})\nPrevious interactions: {history_count}\nContext: {additional_context}',
      variables: ['name', 'email', 'history_count', 'additional_context'],
      is_active: true,
      priority: 5,
      created_at: new Date().toISOString(),
    },
  ];

  botConfigs = [
    {
      id: 'default_bot',
      name: 'Default Assistant',
      personality: 'Helpful, knowledgeable, and friendly AI assistant',
      tone: 'professional',
      response_style: 'conversational',
      greeting_message: 'Hello! How can I help you today?',
      system_prompt: 'You are a helpful AI assistant designed to provide accurate information and assistance.',
      max_response_length: 500,
      use_emoji: false,
      use_context: true,
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ];
}

// Prompt Management Routes
router.get('/prompts', async (req, res) => {
  try {
    const { type, active } = req.query;
    let filteredPrompts = prompts;

    if (type) {
      filteredPrompts = filteredPrompts.filter(p => p.type === type);
    }

    if (active !== undefined) {
      const isActive = active === 'true';
      filteredPrompts = filteredPrompts.filter(p => p.is_active === isActive);
    }

    filteredPrompts.sort((a, b) => b.priority - a.priority);

    res.json({
      success: true,
      prompts: filteredPrompts,
      total: filteredPrompts.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post('/prompts', async (req, res) => {
  try {
    const { error, value } = promptSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const newPrompt = {
      id: `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...value,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    prompts.push(newPrompt);

    res.json({
      success: true,
      prompt: newPrompt,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.put('/prompts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = promptSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const promptIndex = prompts.findIndex(p => p.id === id);
    if (promptIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Prompt not found',
      });
    }

    prompts[promptIndex] = {
      ...prompts[promptIndex],
      ...value,
      updated_at: new Date().toISOString(),
    };

    res.json({
      success: true,
      prompt: prompts[promptIndex],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.delete('/prompts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const promptIndex = prompts.findIndex(p => p.id === id);
    
    if (promptIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Prompt not found',
      });
    }

    prompts.splice(promptIndex, 1);

    res.json({
      success: true,
      message: 'Prompt deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Bot Configuration Routes
router.get('/bot-configs', async (req, res) => {
  try {
    const { active } = req.query;
    let filteredConfigs = botConfigs;

    if (active !== undefined) {
      const isActive = active === 'true';
      filteredConfigs = filteredConfigs.filter(c => c.is_active === isActive);
    }

    res.json({
      success: true,
      configs: filteredConfigs,
      total: filteredConfigs.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post('/bot-configs', async (req, res) => {
  try {
    const { error, value } = botConfigSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const newConfig = {
      id: `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...value,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    botConfigs.push(newConfig);

    res.json({
      success: true,
      config: newConfig,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.put('/bot-configs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = botConfigSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const configIndex = botConfigs.findIndex(c => c.id === id);
    if (configIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Bot configuration not found',
      });
    }

    botConfigs[configIndex] = {
      ...botConfigs[configIndex],
      ...value,
      updated_at: new Date().toISOString(),
    };

    res.json({
      success: true,
      config: botConfigs[configIndex],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Knowledge Base Routes
router.get('/knowledge', async (req, res) => {
  try {
    const { category } = req.query;
    let filteredKnowledge = knowledgeBase;

    if (category) {
      filteredKnowledge = filteredKnowledge.filter(k => k.category === category);
    }

    res.json({
      success: true,
      knowledge: filteredKnowledge,
      total: filteredKnowledge.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post('/knowledge', async (req, res) => {
  try {
    const { title, content, category, tags } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Title and content are required',
      });
    }

    const newKnowledge = {
      id: `kb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      content,
      category: category || 'general',
      tags: tags || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    knowledgeBase.push(newKnowledge);

    // Add to vector database if available
    if (req.vectorDB) {
      try {
        await req.vectorDB.addDocument(newKnowledge.id, content, {
          type: 'knowledge',
          title,
          category,
          tags,
        });
      } catch (vectorError) {
        console.error('Failed to add to vector database:', vectorError);
      }
    }

    res.json({
      success: true,
      knowledge: newKnowledge,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Document Processing Functions
async function processDocument(filePath, mimeType) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { content, type: 'text' };
  } catch (error) {
    // Handle binary files
    switch (mimeType) {
      case 'application/pdf':
        try {
          const pdfBuffer = await fs.readFile(filePath);
          const pdfData = await pdf(pdfBuffer);
          return { content: pdfData.text, type: 'pdf' };
        } catch (pdfError) {
          throw new Error('Failed to parse PDF: ' + pdfError.message);
        }
        
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        try {
          const docxBuffer = await fs.readFile(filePath);
          const docxResult = await mammoth.extractRawText({ buffer: docxBuffer });
          return { content: docxResult.value, type: 'docx' };
        } catch (docxError) {
          throw new Error('Failed to parse DOCX: ' + docxError.message);
        }
        
      case 'application/msword':
        // For older .doc files, we'd need additional libraries
        throw new Error('DOC files not yet supported. Please convert to DOCX or TXT.');
        
      case 'application/json':
        try {
          const jsonData = JSON.parse(await fs.readFile(filePath, 'utf-8'));
          return { content: JSON.stringify(jsonData, null, 2), type: 'json' };
        } catch (jsonError) {
          throw new Error('Failed to parse JSON: ' + jsonError.message);
        }
        
      case 'text/csv':
      case 'application/vnd.ms-excel':
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        // For Excel files, we'd need additional libraries like xlsx
        throw new Error('Excel files not yet supported. Please convert to CSV or TXT.');
        
      default:
        throw new Error(`Unsupported file type: ${mimeType}`);
    }
  }
}

// Document Upload and Processing
router.post('/upload-document', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }

    const { title, category, tags, autoProcess } = req.body;
    
    // Process the document
    const { content, type } = await processDocument(req.file.path, req.file.mimetype);
    
    // Create document metadata
    const document = {
      id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: title || req.file.originalname,
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      type: type,
      content: content,
      category: category || 'general',
      tags: tags ? tags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
      uploaded_at: new Date().toISOString(),
      processed: false,
    };

    // Add to vector database if auto-processing is enabled
    if (autoProcess === 'true' && req.vectorDB) {
      try {
        await req.vectorDB.addDocument(document.id, content, {
          type: 'document',
          title: document.title,
          category: document.category,
          tags: document.tags,
          filename: document.originalname,
          upload_date: document.uploaded_at,
        });
        document.processed = true;
        document.vector_id = document.id;
      } catch (vectorError) {
        console.error('Failed to add document to vector database:', vectorError);
        document.processing_error = vectorError.message;
      }
    }

    // Store document metadata (in production, use proper database)
    knowledgeBase.push({
      ...document,
      id: document.id,
      title: document.title,
      content: content,
      category: document.category,
      tags: document.tags,
      source: 'file_upload',
      file_info: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
      },
      created_at: document.uploaded_at,
    });

    // Clean up uploaded file
    await fs.unlink(req.file.path);

    res.json({
      success: true,
      document: {
        id: document.id,
        title: document.title,
        category: document.category,
        tags: document.tags,
        type: type,
        processed: document.processed,
        size: document.size,
        upload_date: document.uploaded_at,
      },
    });
  } catch (error) {
    console.error('Document upload error:', error);
    
    // Clean up file on error
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.error('Failed to cleanup file:', cleanupError);
      }
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Batch Document Upload
router.post('/upload-batch', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded',
      });
    }

    const { category, autoProcess } = req.body;
    const results = [];
    
    for (const file of req.files) {
      try {
        const { content, type } = await processDocument(file.path, file.mimetype);
        
        const document = {
          id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: file.originalname,
          filename: file.filename,
          originalname: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
          type: type,
          content: content,
          category: category || 'general',
          tags: [],
          uploaded_at: new Date().toISOString(),
          processed: false,
        };

        // Add to vector database
        if (autoProcess === 'true' && req.vectorDB) {
          try {
            await req.vectorDB.addDocument(document.id, content, {
              type: 'document',
              title: document.title,
              category: document.category,
              tags: document.tags,
              filename: document.originalname,
              upload_date: document.uploaded_at,
            });
            document.processed = true;
          } catch (vectorError) {
            console.error(`Failed to process ${file.originalname}:`, vectorError);
            document.processing_error = vectorError.message;
          }
        }

        knowledgeBase.push({
          ...document,
          source: 'file_upload',
          file_info: {
            filename: file.filename,
            originalname: file.originalname,
            size: file.size,
            mimeType: file.mimetype,
          },
          created_at: document.uploaded_at,
        });

        results.push({
          success: true,
          filename: file.originalname,
          document_id: document.id,
          processed: document.processed,
        });

        // Clean up file
        await fs.unlink(file.path);
      } catch (error) {
        results.push({
          success: false,
          filename: file.originalname,
          error: error.message,
        });
        
        // Clean up file on error
        try {
          await fs.unlink(file.path);
        } catch (cleanupError) {
          console.error('Failed to cleanup file:', cleanupError);
        }
      }
    }

    res.json({
      success: true,
      results,
      summary: {
        total: req.files.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      },
    });
  } catch (error) {
    console.error('Batch upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Process Existing Document
router.post('/process-document/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const document = knowledgeBase.find(doc => doc.id === id);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
      });
    }

    if (!req.vectorDB) {
      return res.status(500).json({
        success: false,
        error: 'Vector database not available',
      });
    }

    // Add to vector database
    await req.vectorDB.addDocument(document.id, document.content, {
      type: 'document',
      title: document.title,
      category: document.category,
      tags: document.tags,
      filename: document.file_info?.originalname || document.title,
      upload_date: document.created_at,
    });

    // Update document status
    document.processed = true;
    document.processed_at = new Date().toISOString();

    res.json({
      success: true,
      message: 'Document processed successfully',
    });
  } catch (error) {
    console.error('Document processing error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Delete Document
router.delete('/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const documentIndex = knowledgeBase.findIndex(doc => doc.id === id);
    
    if (documentIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
      });
    }

    const document = knowledgeBase[documentIndex];

    // Remove from vector database
    if (req.vectorDB) {
      try {
        await req.vectorDB.deleteDocument(document.id);
      } catch (vectorError) {
        console.error('Failed to delete from vector database:', vectorError);
      }
    }

    // Remove from knowledge base
    knowledgeBase.splice(documentIndex, 1);

    res.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    console.error('Document deletion error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get Document Statistics
router.get('/documents/stats', async (req, res) => {
  try {
    const stats = {
      total: knowledgeBase.length,
      processed: knowledgeBase.filter(doc => doc.processed).length,
      by_category: {},
      by_type: {},
      total_size: 0,
    };

    knowledgeBase.forEach(doc => {
      // Category stats
      stats.by_category[doc.category] = (stats.by_category[doc.category] || 0) + 1;
      
      // Type stats
      if (doc.type) {
        stats.by_type[doc.type] = (stats.by_type[doc.type] || 0) + 1;
      }
      
      // Size stats
      if (doc.file_info?.size) {
        stats.total_size += doc.file_info.size;
      }
    });

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Document stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get active configuration
router.get('/active-config', async (req, res) => {
  try {
    const activePrompts = prompts.filter(p => p.is_active).sort((a, b) => b.priority - a.priority);
    const activeBotConfig = botConfigs.find(c => c.is_active);

    res.json({
      success: true,
      prompts: activePrompts,
      bot_config: activeBotConfig,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Initialize default data
initializeDefaultPrompts();

module.exports = router;