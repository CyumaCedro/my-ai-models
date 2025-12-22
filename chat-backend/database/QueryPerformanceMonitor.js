/**
 * Query Performance Monitor - Tracks and optimizes query performance
 */
class QueryPerformanceMonitor {
  constructor(dbManager) {
    this.dbManager = dbManager;
    this.performanceData = new Map();
    this.slowQueryThreshold = 1000; // 1 second
    this.optimizationSuggestions = new Map();
  }

  /**
   * Record query performance
   */
  recordQueryPerformance(query, executionTime, resultCount, cacheHit = false) {
    const queryHash = this.generateQueryHash(query);
    const timestamp = Date.now();
    
    if (!this.performanceData.has(queryHash)) {
      this.performanceData.set(queryHash, {
        query,
        executions: [],
        totalExecutions: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0,
        minExecutionTime: Infinity,
        maxExecutionTime: 0,
        totalResults: 0,
        cacheHits: 0,
        firstSeen: timestamp,
        lastSeen: timestamp
      });
    }

    const perf = this.performanceData.get(queryHash);
    perf.executions.push({
      timestamp,
      executionTime,
      resultCount,
      cacheHit
    });
    
    perf.totalExecutions++;
    perf.totalExecutionTime += executionTime;
    perf.averageExecutionTime = perf.totalExecutionTime / perf.totalExecutions;
    perf.minExecutionTime = Math.min(perf.minExecutionTime, executionTime);
    perf.maxExecutionTime = Math.max(perf.maxExecutionTime, executionTime);
    perf.totalResults += resultCount;
    perf.lastSeen = timestamp;
    
    if (cacheHit) {
      perf.cacheHits++;
    }

    // Check for slow query
    if (executionTime > this.slowQueryThreshold) {
      this.handleSlowQuery(queryHash, query, executionTime);
    }

    // Clean old execution data (keep last 100 executions)
    if (perf.executions.length > 100) {
      perf.executions = perf.executions.slice(-100);
    }
  }

  /**
   * Handle slow query detection
   */
  handleSlowQuery(queryHash, query, executionTime) {
    console.warn(`Slow query detected (${executionTime}ms):`, query.substring(0, 100) + '...');
    
    // Generate optimization suggestions
    const suggestions = this.generateOptimizationSuggestions(query, executionTime);
    this.optimizationSuggestions.set(queryHash, suggestions);
  }

  /**
   * Generate optimization suggestions for slow queries
   */
  generateOptimizationSuggestions(query, executionTime) {
    const suggestions = [];
    const lowerQuery = query.toLowerCase();
    
    // Check for missing indexes
    if (/\bwhere\b/i.test(query) && !/\bindex\b/i.test(lowerQuery)) {
      suggestions.push({
        type: 'missing_index',
        priority: 'high',
        description: 'Consider adding indexes on WHERE clause columns',
        suggestion: 'Create indexes on frequently filtered columns'
      });
    }

    // Check for missing JOIN optimizations
    if (/\bjoin\b/i.test(query) && !/\busing\b/i.test(lowerQuery)) {
      suggestions.push({
        type: 'join_optimization',
        priority: 'medium',
        description: 'JOIN operations could be optimized',
        suggestion: 'Ensure JOIN columns are indexed and consider using explicit JOIN syntax'
      });
    }

    // Check for large result sets
    if (executionTime > 5000) {
      suggestions.push({
        type: 'large_result_set',
        priority: 'high',
        description: 'Query returning large result set',
        suggestion: 'Add LIMIT clause or refine WHERE conditions to reduce result size'
      });
    }

    // Check for missing LIMIT
    if (!/\blimit\b/i.test(lowerQuery)) {
      suggestions.push({
        type: 'missing_limit',
        priority: 'medium',
        description: 'Query missing LIMIT clause',
        suggestion: 'Add LIMIT clause to prevent large result sets'
      });
    }

    // Check for subquery optimization
    if (/\bselect.*\(select\b/i.test(lowerQuery)) {
      suggestions.push({
        type: 'subquery_optimization',
        priority: 'medium',
        description: 'Subquery detected that could be optimized',
        suggestion: 'Consider rewriting subqueries as JOINs or using EXISTS instead of IN'
      });
    }

    // Check for GROUP BY optimization
    if (/\bgroup by\b/i.test(query) && !/\border by\b/i.test(lowerQuery)) {
      suggestions.push({
        type: 'group_by_optimization',
        priority: 'low',
        description: 'GROUP BY without ORDER BY',
        suggestion: 'Consider adding ORDER BY to improve GROUP BY performance'
      });
    }

    return suggestions;
  }

  /**
   * Get performance report
   */
  getPerformanceReport() {
    const report = {
      summary: this.generateSummary(),
      slowQueries: this.getSlowQueries(),
      topQueries: this.getTopQueries(),
      optimizationSuggestions: this.getTopOptimizationSuggestions(),
      cachePerformance: this.getCachePerformance(),
      trends: this.getPerformanceTrends()
    };

    return report;
  }

  /**
   * Generate performance summary
   */
  generateSummary() {
    let totalExecutions = 0;
    let totalExecutionTime = 0;
    let totalResults = 0;
    let totalCacheHits = 0;
    let slowQueryCount = 0;

    for (const [hash, data] of this.performanceData.entries()) {
      totalExecutions += data.totalExecutions;
      totalExecutionTime += data.totalExecutionTime;
      totalResults += data.totalResults;
      totalCacheHits += data.cacheHits;
      
      if (data.averageExecutionTime > this.slowQueryThreshold) {
        slowQueryCount++;
      }
    }

    return {
      totalQueries: this.performanceData.size,
      totalExecutions,
      averageExecutionTime: totalExecutions > 0 ? totalExecutionTime / totalExecutions : 0,
      totalResults,
      cacheHitRate: totalExecutions > 0 ? totalCacheHits / totalExecutions : 0,
      slowQueryCount,
      slowQueryRate: this.performanceData.size > 0 ? slowQueryCount / this.performanceData.size : 0
    };
  }

  /**
   * Get slow queries
   */
  getSlowQueries() {
    const slowQueries = [];
    
    for (const [hash, data] of this.performanceData.entries()) {
      if (data.averageExecutionTime > this.slowQueryThreshold) {
        slowQueries.push({
          queryHash: hash,
          query: data.query.substring(0, 100) + '...',
          averageExecutionTime: data.averageExecutionTime,
          maxExecutionTime: data.maxExecutionTime,
          executions: data.totalExecutions,
          suggestions: this.optimizationSuggestions.get(hash) || []
        });
      }
    }

    return slowQueries.sort((a, b) => b.averageExecutionTime - a.averageExecutionTime);
  }

  /**
   * Get most frequently executed queries
   */
  getTopQueries() {
    const topQueries = [];
    
    for (const [hash, data] of this.performanceData.entries()) {
      topQueries.push({
        queryHash: hash,
        query: data.query.substring(0, 100) + '...',
        executions: data.totalExecutions,
        averageExecutionTime: data.averageExecutionTime,
        totalExecutionTime: data.totalExecutionTime,
        cacheHitRate: data.totalExecutions > 0 ? data.cacheHits / data.totalExecutions : 0
      });
    }

    return topQueries.sort((a, b) => b.executions - a.executions).slice(0, 10);
  }

  /**
   * Get top optimization suggestions
   */
  getTopOptimizationSuggestions() {
    const allSuggestions = [];
    
    for (const [hash, suggestions] of this.optimizationSuggestions.entries()) {
      const data = this.performanceData.get(hash);
      if (data) {
        suggestions.forEach(suggestion => {
          allSuggestions.push({
            queryHash: hash,
            query: data.query.substring(0, 100) + '...',
            ...suggestion,
            impact: data.averageExecutionTime
          });
        });
      }
    }

    // Group by suggestion type and count occurrences
    const groupedSuggestions = {};
    allSuggestions.forEach(suggestion => {
      const key = suggestion.type;
      if (!groupedSuggestions[key]) {
        groupedSuggestions[key] = {
          type: suggestion.type,
          count: 0,
          priority: suggestion.priority,
          description: suggestion.description,
          suggestion: suggestion.suggestion,
          totalImpact: 0,
          queries: []
        };
      }
      groupedSuggestions[key].count++;
      groupedSuggestions[key].totalImpact += suggestion.impact;
      groupedSuggestions[key].queries.push({
        queryHash: suggestion.queryHash,
        query: suggestion.query,
        impact: suggestion.impact
      });
    });

    return Object.values(groupedSuggestions).sort((a, b) => b.count - a.count);
  }

  /**
   * Get cache performance metrics
   */
  getCachePerformance() {
    let totalCacheHits = 0;
    let totalExecutions = 0;
    const cacheByQuery = new Map();

    for (const [hash, data] of this.performanceData.entries()) {
      totalCacheHits += data.cacheHits;
      totalExecutions += data.totalExecutions;
      
      if (data.totalExecutions > 0) {
        cacheByQuery.set(hash, {
          queryHash: hash,
          query: data.query.substring(0, 100) + '...',
          cacheHitRate: data.cacheHits / data.totalExecutions,
          executions: data.totalExecutions,
          cacheHits: data.cacheHits
        });
      }
    }

    return {
      overallCacheHitRate: totalExecutions > 0 ? totalCacheHits / totalExecutions : 0,
      totalCacheHits,
      totalExecutions,
      topCachedQueries: Array.from(cacheByQuery.values())
        .sort((a, b) => b.cacheHitRate - a.cacheHitRate)
        .slice(0, 5)
    };
  }

  /**
   * Get performance trends
   */
  getPerformanceTrends() {
    const trends = {
      executionTimeTrend: [],
      queryVolumeTrend: [],
      cacheHitRateTrend: []
    };

    // Calculate trends based on recent executions
    const now = Date.now();
    const timeWindows = [3600000, 86400000, 604800000]; // 1 hour, 1 day, 1 week

    timeWindows.forEach(windowSize => {
      const windowStart = now - windowSize;
      let windowExecutions = 0;
      let windowExecutionTime = 0;
      let windowCacheHits = 0;

      for (const [hash, data] of this.performanceData.entries()) {
        data.executions.forEach(exec => {
          if (exec.timestamp >= windowStart) {
            windowExecutions++;
            windowExecutionTime += exec.executionTime;
            if (exec.cacheHit) {
              windowCacheHits++;
            }
          }
        });
      }

      const windowLabel = windowSize === 3600000 ? '1 hour' : 
                         windowSize === 86400000 ? '1 day' : '1 week';

      trends.executionTimeTrend.push({
        period: windowLabel,
        averageTime: windowExecutions > 0 ? windowExecutionTime / windowExecutions : 0
      });

      trends.queryVolumeTrend.push({
        period: windowLabel,
        executions: windowExecutions
      });

      trends.cacheHitRateTrend.push({
        period: windowLabel,
        cacheHitRate: windowExecutions > 0 ? windowCacheHits / windowExecutions : 0
      });
    });

    return trends;
  }

  /**
   * Generate query hash
   */
  generateQueryHash(query) {
    // Normalize query for hashing
    const normalized = query.toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\s*;\s*$/, '')
      .trim();
    
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  /**
   * Clear performance data
   */
  clearPerformanceData() {
    this.performanceData.clear();
    this.optimizationSuggestions.clear();
  }

  /**
   * Export performance data for analysis
   */
  exportPerformanceData() {
    const exportData = {
      timestamp: new Date().toISOString(),
      summary: this.generateSummary(),
      queries: [],
      suggestions: []
    };

    for (const [hash, data] of this.performanceData.entries()) {
      exportData.queries.push({
        queryHash: hash,
        query: data.query,
        ...data,
        executions: data.executions.slice(-10) // Last 10 executions
      });
    }

    for (const [hash, suggestions] of this.optimizationSuggestions.entries()) {
      exportData.suggestions.push({
        queryHash: hash,
        suggestions
      });
    }

    return exportData;
  }
}

module.exports = QueryPerformanceMonitor;