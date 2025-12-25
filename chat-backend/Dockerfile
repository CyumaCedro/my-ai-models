FROM node:18-alpine

# Install necessary packages for document processing
RUN apk add --no-cache \
    python3 \
    py3-pip \
    make \
    g++ \
    curl \
    && ln -sf python3 /usr/bin/python

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --omit=dev

# Install Python dependencies for document processing
RUN pip3 install --no-cache-dir --break-system-packages \
    "pdf-parse==1.1.1" \
    "python-docx==0.8.11" \
    "openpyxl==3.1.2"

# Copy source code
COPY . .

# Create uploads directory with proper permissions
RUN mkdir -p uploads && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Start the application
CMD ["npm", "start"]