# Use the official Node.js 22 image as the base
FROM node:22-slim

# Puppeteer and Playwright dependencies
RUN apt-get update && \
    apt-get install -y wget ca-certificates fonts-liberation libappindicator3-1 libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 libgdk-pixbuf2.0-0 libnspr4 libnss3 libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 xdg-utils \
    # Additional dependencies for Playwright
    libxss1 libgconf-2-4 libxtst6 libgtk-3-0 libdrm2 libxss1 libgbm1 \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies (including puppeteer)
RUN npm install

# Install nodemon globally
RUN npm install -g nodemon

# Install Playwright Chromium browser
RUN npx playwright install chromium

# Copy the rest of the application
COPY . .

# Expose port (change if your app uses a different port)
EXPOSE 7250

# Start with nodemon for hot-reload
CMD ["nodemon", "index.js"]
