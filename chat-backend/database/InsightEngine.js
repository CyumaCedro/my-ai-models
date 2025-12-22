/**
 * Insight Engine - Generates automated insights from database queries
 */
class InsightEngine {
  constructor(dbManager) {
    this.dbManager = dbManager;
    this.insightTemplates = new Map();
    this.initializeTemplates();
  }

  /**
   * Initialize insight templates
   */
  initializeTemplates() {
    // Trend analysis templates
    this.insightTemplates.set('trend_analysis', {
      description: 'Analyze trends over time',
      patterns: [
        'SELECT.*FROM.*WHERE.*ORDER BY.*timestamp',
        'SELECT.*FROM.*GROUP BY.*date',
        'SELECT.*COUNT.*FROM.*GROUP BY'
      ],
      generateInsight: this.generateTrendInsight.bind(this)
    });

    // Comparison templates
    this.insightTemplates.set('comparison', {
      description: 'Compare values across categories',
      patterns: [
        'SELECT.*FROM.*GROUP BY.*category',
        'SELECT.*SUM.*FROM.*GROUP BY',
        'SELECT.*AVG.*FROM.*GROUP BY'
      ],
      generateInsight: this.generateComparisonInsight.bind(this)
    });

    // Anomaly detection templates
    this.insightTemplates.set('anomaly_detection', {
      description: 'Detect unusual patterns or outliers',
      patterns: [
        'SELECT.*FROM.*ORDER BY.*DESC',
        'SELECT.*MAX.*FROM',
        'SELECT.*MIN.*FROM'
      ],
      generateInsight: this.generateAnomalyInsight.bind(this)
    });

    // Relationship analysis templates
    this.insightTemplates.set('relationship_analysis', {
      description: 'Analyze relationships between entities',
      patterns: [
        'SELECT.*FROM.*JOIN.*ON',
        'SELECT.*FROM.*WHERE.*_id.*=',
        'SELECT.*COUNT.*FROM.*GROUP BY.*_id'
      ],
      generateInsight: this.generateRelationshipInsight.bind(this)
    });
  }

  /**
   * Generate insights from query results
   */
  async generateInsights(query, results, schema = null) {
    const insights = [];
    
    if (!results || results.length === 0) {
      return insights;
    }

    // Identify query type
    const queryType = this.identifyQueryType(query);
    
    // Get appropriate template
    const template = this.insightTemplates.get(queryType);
    if (template) {
      try {
        const insight = await template.generateInsight(query, results, schema);
        if (insight) {
          insights.push(insight);
        }
      } catch (error) {
        console.warn(`Failed to generate ${queryType} insight:`, error);
      }
    }

    // Generate general statistical insights
    const generalInsights = this.generateStatisticalInsights(results);
    insights.push(...generalInsights);

    return insights;
  }

  /**
   * Identify query type based on SQL patterns
   */
  identifyQueryType(query) {
    const lowerQuery = query.toLowerCase();
    
    for (const [type, template] of this.insightTemplates.entries()) {
      for (const pattern of template.patterns) {
        if (new RegExp(pattern, 'i').test(lowerQuery)) {
          return type;
        }
      }
    }
    
    return 'general';
  }

  /**
   * Generate trend analysis insight
   */
  async generateTrendInsight(query, results, schema) {
    if (results.length < 2) {
      return null;
    }

    // Look for time-based columns
    const timeColumns = this.findTimeColumns(results[0]);
    if (timeColumns.length === 0) {
      return null;
    }

    const timeColumn = timeColumns[0];
    const values = this.extractNumericValues(results);
    
    if (values.length === 0) {
      return null;
    }

    // Calculate trend
    const trend = this.calculateTrend(values);
    const trendDirection = trend > 0.1 ? 'increasing' : trend < -0.1 ? 'decreasing' : 'stable';
    
    return {
      type: 'trend_analysis',
      title: `Trend Analysis: ${trendDirection} pattern detected`,
      description: `The data shows a ${trendDirection} trend with ${Math.abs(trend * 100).toFixed(1)}% change over the period.`,
      confidence: this.calculateConfidence(results.length, values.length),
      details: {
        timeColumn,
        trendDirection,
        changePercent: (trend * 100).toFixed(2),
        dataPoints: results.length
      }
    };
  }

  /**
   * Generate comparison insight
   */
  async generateComparisonInsight(query, results, schema) {
    if (results.length < 2) {
      return null;
    }

    // Find categorical and numeric columns
    const categoricalColumns = this.findCategoricalColumns(results);
    const numericColumns = this.findNumericColumns(results);
    
    if (categoricalColumns.length === 0 || numericColumns.length === 0) {
      return null;
    }

    const categoryColumn = categoricalColumns[0];
    const valueColumn = numericColumns[0];
    
    // Calculate comparison metrics
    const values = results.map(row => parseFloat(row[valueColumn])).filter(v => !isNaN(v));
    const categories = [...new Set(results.map(row => row[categoryColumn]))];
    
    const max = Math.max(...values);
    const min = Math.min(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const range = max - min;
    
    // Find top performer
    const topPerformer = results.reduce((max, row) => {
      const value = parseFloat(row[valueColumn]);
      return value > parseFloat(max[valueColumn]) ? row : max;
    });

    return {
      type: 'comparison',
      title: `Comparison Analysis: ${categories.length} categories compared`,
      description: `Analysis shows ${categories.length} distinct categories with values ranging from ${min.toFixed(2)} to ${max.toFixed(2)}. Top performer: ${topPerformer[categoryColumn]} with ${topPerformer[valueColumn]}.`,
      confidence: this.calculateConfidence(results.length, categories.length),
      details: {
        categoryColumn,
        valueColumn,
        categories: categories.length,
        range: range.toFixed(2),
        average: avg.toFixed(2),
        topPerformer: topPerformer[categoryColumn]
      }
    };
  }

  /**
   * Generate anomaly detection insight
   */
  async generateAnomalyInsight(query, results, schema) {
    if (results.length < 3) {
      return null;
    }

    const numericColumns = this.findNumericColumns(results);
    if (numericColumns.length === 0) {
      return null;
    }

    const anomalies = [];
    
    for (const column of numericColumns) {
      const values = results.map(row => parseFloat(row[column])).filter(v => !isNaN(v));
      const columnAnomalies = this.detectOutliers(values, results, column);
      anomalies.push(...columnAnomalies);
    }

    if (anomalies.length === 0) {
      return null;
    }

    return {
      type: 'anomaly_detection',
      title: `Anomaly Detection: ${anomalies.length} unusual patterns found`,
      description: `Detected ${anomalies.length} potential outliers in the data that may require further investigation.`,
      confidence: this.calculateConfidence(results.length, anomalies.length),
      details: {
        anomalyCount: anomalies.length,
        anomalies: anomalies.slice(0, 5) // Limit to top 5
      }
    };
  }

  /**
   * Generate relationship analysis insight
   */
  async generateRelationshipInsight(query, results, schema) {
    if (results.length < 2) {
      return null;
    }

    // Look for join patterns or foreign key relationships
    const joinColumns = this.findJoinColumnPatterns(query);
    
    if (joinColumns.length === 0) {
      return null;
    }

    // Analyze relationship strength
    const relationshipStrength = this.calculateRelationshipStrength(results, joinColumns);
    
    return {
      type: 'relationship_analysis',
      title: `Relationship Analysis: ${joinColumns.length} relationships analyzed`,
      description: `Analysis reveals ${relationshipStrength > 0.7 ? 'strong' : relationshipStrength > 0.4 ? 'moderate' : 'weak'} relationships between connected entities.`,
      confidence: this.calculateConfidence(results.length, joinColumns.length),
      details: {
        relationships: joinColumns,
        strength: relationshipStrength.toFixed(2),
        connectedEntities: results.length
      }
    };
  }

  /**
   * Generate statistical insights
   */
  generateStatisticalInsights(results) {
    const insights = [];
    const numericColumns = this.findNumericColumns(results);
    
    for (const column of numericColumns) {
      const values = results.map(row => parseFloat(row[column])).filter(v => !isNaN(v));
      
      if (values.length > 1) {
        const stats = this.calculateStatistics(values);
        
        insights.push({
          type: 'statistical',
          title: `Statistical Summary for ${column}`,
          description: `${column}: mean=${stats.mean.toFixed(2)}, median=${stats.median.toFixed(2)}, std=${stats.stdDev.toFixed(2)}`,
          confidence: 0.8,
          details: stats
        });
      }
    }
    
    return insights;
  }

  /**
   * Helper methods
   */
  findTimeColumns(row) {
    const timePatterns = ['time', 'date', 'created', 'updated', 'timestamp'];
    return Object.keys(row).filter(col => 
      timePatterns.some(pattern => col.toLowerCase().includes(pattern))
    );
  }

  findNumericColumns(row) {
    return Object.keys(row).filter(col => {
      const value = row[col];
      return !isNaN(parseFloat(value)) && isFinite(value);
    });
  }

  findCategoricalColumns(row) {
    return Object.keys(row).filter(col => {
      const value = row[col];
      return isNaN(parseFloat(value)) || !isFinite(value);
    });
  }

  extractNumericValues(results) {
    const numericColumns = this.findNumericColumns(results[0]);
    if (numericColumns.length === 0) return [];
    
    return results.map(row => parseFloat(row[numericColumns[0]])).filter(v => !isNaN(v));
  }

  calculateTrend(values) {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgY = sumY / n;
    
    return slope / avgY; // Normalize by average
  }

  detectOutliers(values, results, column) {
    if (values.length < 3) return [];
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
    const threshold = 2; // 2 standard deviations
    
    const outliers = [];
    results.forEach((row, index) => {
      const value = parseFloat(row[column]);
      if (!isNaN(value) && Math.abs(value - mean) > threshold * stdDev) {
        outliers.push({
          row: index,
          column,
          value,
          zScore: (value - mean) / stdDev
        });
      }
    });
    
    return outliers;
  }

  calculateStatistics(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const median = sorted.length % 2 === 0 
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
    
    return {
      mean,
      median,
      stdDev,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length
    };
  }

  findJoinColumnPatterns(query) {
    const joinPatterns = [
      /join\s+(\w+)\s+on\s+(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/gi,
      /where\s+(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/gi
    ];
    
    const joins = [];
    joinPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(query)) !== null) {
        joins.push({
          table1: match[1] || match[2],
          column1: match[3] || match[4],
          table2: match[4] || match[6],
          column2: match[5] || match[7]
        });
      }
    });
    
    return joins;
  }

  calculateRelationshipStrength(results, joinColumns) {
    // Simple heuristic based on result diversity
    const uniqueValues = new Set();
    joinColumns.forEach(join => {
      results.forEach(row => {
        if (row[join.column1]) uniqueValues.add(row[join.column1]);
        if (row[join.column2]) uniqueValues.add(row[join.column2]);
      });
    });
    
    return Math.min(uniqueValues.size / results.length, 1);
  }

  calculateConfidence(dataPoints, patternMatches) {
    const baseConfidence = Math.min(dataPoints / 100, 1);
    const patternBonus = Math.min(patternMatches / 10, 0.3);
    return Math.min(baseConfidence + patternBonus, 1);
  }
}

module.exports = InsightEngine;