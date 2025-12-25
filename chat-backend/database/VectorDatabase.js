const { ChromaApi } = require('chromadb');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class VectorDatabase {
  constructor() {
    this.client = null;
    this.collection = null;
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.embeddingModel = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';
  }

  async initialize() {
    try {
      // Initialize ChromaDB client
      this.client = new ChromaApi({
        path: process.env.CHROMA_URL || 'http://localhost:8000',
      });

      // Get or create collection
      try {
        this.collection = await this.client.getCollection({
          name: 'rag_documents',
        });
      } catch (error) {
        this.collection = await this.client.createCollection({
          name: 'rag_documents',
          metadata: { description: 'RAG document collection' },
        });
      }

      console.log('Vector database initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize vector database:', error);
      // Fallback to in-memory storage
      this.fallbackStorage = [];
      console.log('Using fallback in-memory storage');
      return false;
    }
  }

  async generateEmbedding(text) {
    try {
      const response = await axios.post(
        `${this.ollamaUrl}/api/embeddings`,
        {
          model: this.embeddingModel,
          prompt: text,
        },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (response.data && response.data.embedding) {
        return response.data.embedding;
      } else {
        throw new Error('No embedding returned from Ollama');
      }
    } catch (error) {
      console.error('Failed to generate embedding with Ollama:', error);
      // Fallback: generate dummy embedding (768 dimensions for nomic-embed-text)
      return new Array(768).fill(0).map((_, i) => Math.random() - 0.5);
    }
  }

  async addDocument(id, content, metadata = {}) {
    try {
      const embedding = await this.generateEmbedding(content);
      
      if (this.collection) {
        await this.collection.add({
          ids: [id],
          embeddings: [embedding],
          documents: [content],
          metadatas: [metadata],
        });
      } else {
        // Fallback storage
        this.fallbackStorage.push({
          id,
          content,
          embedding,
          metadata,
          timestamp: new Date().toISOString(),
        });
      }

      console.log(`Document added: ${id}`);
      return true;
    } catch (error) {
      console.error('Failed to add document:', error);
      return false;
    }
  }

  async searchDocuments(query, limit = 5) {
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      
      if (this.collection) {
        const results = await this.collection.query({
          queryEmbeddings: [queryEmbedding],
          nResults: limit,
        });
        
        return {
          documents: results.documents[0] || [],
          metadatas: results.metadatas[0] || [],
          distances: results.distances[0] || [],
        };
      } else {
        // Fallback: simple text matching
        const queryLower = query.toLowerCase();
        const matches = this.fallbackStorage
          .filter(doc => doc.content.toLowerCase().includes(queryLower))
          .slice(0, limit)
          .map(doc => ({
            content: doc.content,
            metadata: doc.metadata,
            distance: 0.5, // Dummy distance
          }));
        
        return {
          documents: matches.map(m => m.content),
          metadatas: matches.map(m => m.metadata),
          distances: matches.map(m => m.distance),
        };
      }
    } catch (error) {
      console.error('Failed to search documents:', error);
      return {
        documents: [],
        metadatas: [],
        distances: [],
      };
    }
  }

  async deleteDocument(id) {
    try {
      if (this.collection) {
        await this.collection.delete({
          ids: [id],
        });
      } else {
        this.fallbackStorage = this.fallbackStorage.filter(doc => doc.id !== id);
      }
      
      console.log(`Document deleted: ${id}`);
      return true;
    } catch (error) {
      console.error('Failed to delete document:', error);
      return false;
    }
  }

  async listDocuments() {
    try {
      if (this.collection) {
        const results = await this.collection.get();
        return {
          ids: results.ids || [],
          metadatas: results.metadatas || [],
        };
      } else {
        return {
          ids: this.fallbackStorage.map(doc => doc.id),
          metadatas: this.fallbackStorage.map(doc => doc.metadata),
        };
      }
    } catch (error) {
      console.error('Failed to list documents:', error);
      return {
        ids: [],
        metadatas: [],
      };
    }
  }

  async loadDocumentsFromDirectory(directoryPath) {
    try {
      const files = await fs.readdir(directoryPath);
      const textFiles = files.filter(file => 
        file.endsWith('.txt') || file.endsWith('.md') || file.endsWith('.pdf')
      );

      for (const file of textFiles) {
        const filePath = path.join(directoryPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const id = `doc_${Date.now()}_${file}`;
        
        await this.addDocument(id, content, {
          filename: file,
          source: 'file_upload',
          uploaded_at: new Date().toISOString(),
        });
      }

      console.log(`Loaded ${textFiles.length} documents from ${directoryPath}`);
      return true;
    } catch (error) {
      console.error('Failed to load documents from directory:', error);
      return false;
    }
  }
}

module.exports = VectorDatabase;