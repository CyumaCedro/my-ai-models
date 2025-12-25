const VectorDatabase = require('./VectorDatabase');

class RAGEngine {
  constructor(vectorDB) {
    this.vectorDB = vectorDB;
    this.maxContextLength = 4000;
    this.similarityThreshold = 0.7;
  }

  async enhanceQuery(query, userContext = {}) {
    try {
      // Search for relevant documents
      const searchResults = await this.vectorDB.searchDocuments(query, 3);
      
      if (searchResults.documents.length === 0) {
        return {
          enhancedQuery: query,
          context: '',
          sources: [],
        };
      }

      // Build context from retrieved documents
      const context = this.buildContext(searchResults, userContext);
      
      // Create enhanced query with context
      const enhancedQuery = this.createEnhancedQuery(query, context, userContext);

      return {
        enhancedQuery,
        context,
        sources: searchResults.metadatas,
      };
    } catch (error) {
      console.error('Failed to enhance query:', error);
      return {
        enhancedQuery: query,
        context: '',
        sources: [],
      };
    }
  }

  buildContext(searchResults, userContext) {
    let context = 'Relevant information:\n';
    
    searchResults.documents.forEach((doc, index) => {
      const metadata = searchResults.metadatas[index] || {};
      const source = metadata.filename || metadata.source || 'Unknown source';
      
      context += `\n[${index + 1}] From ${source}:\n${doc.substring(0, 500)}...\n`;
    });

    // Add user context if available
    if (userContext.name || userContext.email) {
      context += '\nUser Context:\n';
      if (userContext.name) context += `- Name: ${userContext.name}\n`;
      if (userContext.email) context += `- Email: ${userContext.email}\n`;
    }

    return context;
  }

  createEnhancedQuery(originalQuery, context, userContext) {
    let enhanced = `You are a helpful AI assistant with access to relevant context information. `;
    
    if (userContext.name) {
      enhanced += `You are assisting ${userContext.name}. `;
    }
    
    enhanced += `Use the provided context to answer the question accurately. `;
    enhanced += `If the context doesn't contain the answer, use your general knowledge. `;
    enhanced += `Always cite your sources when using context information.\n\n`;
    
    enhanced += `Context:\n${context}\n\n`;
    enhanced += `Question: ${originalQuery}\n\n`;
    enhanced += `Please provide a comprehensive answer based on the context and your knowledge.`;

    return enhanced;
  }

  async addKnowledgeDocument(content, metadata = {}) {
    const id = `knowledge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return await this.vectorDB.addDocument(id, content, {
      ...metadata,
      type: 'knowledge',
      added_at: new Date().toISOString(),
    });
  }

  async addConversationHistory(sessionId, messages) {
    try {
      for (const message of messages) {
        const id = `conv_${sessionId}_${message.id}`;
        const content = `${message.type}: ${message.content}`;
        
        await this.vectorDB.addDocument(id, content, {
          session_id: sessionId,
          message_type: message.type,
          timestamp: message.timestamp,
          type: 'conversation',
        });
      }
      
      return true;
    } catch (error) {
      console.error('Failed to add conversation history:', error);
      return false;
    }
  }

  async getRelevantHistory(sessionId, query, limit = 3) {
    try {
      const searchQuery = `session:${sessionId} ${query}`;
      const results = await this.vectorDB.searchDocuments(searchQuery, limit);
      
      return results.documents.map((doc, index) => ({
        content: doc,
        metadata: results.metadatas[index],
        relevance: 1 - (results.distances[index] || 0),
      }));
    } catch (error) {
      console.error('Failed to get relevant history:', error);
      return [];
    }
  }

  async updatePromptSettings(settings) {
    this.maxContextLength = settings.max_context_length || 4000;
    this.similarityThreshold = settings.similarity_threshold || 0.7;
    return true;
  }
}

module.exports = RAGEngine;