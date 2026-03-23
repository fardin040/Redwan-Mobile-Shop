FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY backend/package*.json ./backend/

# Install dependencies
RUN cd backend && npm install --legacy-peer-deps && cd ..

# Copy application code
COPY backend ./backend
COPY frontend ./frontend

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production

# Start application
CMD ["node", "backend/server.js"]
