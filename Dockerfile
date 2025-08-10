# Use the official Node.js 22 image as the base
FROM node:22-slim

# Install Python 3.12 and pip for gTTS
RUN apt-get update && \
    apt-get install -y python3 python3-pip python3-venv \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Install nodemon globally
RUN npm install -g nodemon

# Install gTTS globally for Python3
RUN pip3 install --break-system-packages gtts

# Copy the rest of the application
COPY . .

# Ensure temp_audio directory exists with correct permissions
RUN mkdir -p temp_audio && chmod 755 temp_audio

# Expose port (change if your app uses a different port)
EXPOSE 7250

# Start with nodemon for hot-reload
CMD ["nodemon", "index.js"]
