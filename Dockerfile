# Base image olarak resmi Node image + Chromium yüklü image kullanıyoruz
FROM node:20-slim

# Gerekli paketleri yükle (özellikle Chromium için)
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Çalışma dizini
WORKDIR /app

# Package.json dosyalarını kopyala ve install yap
COPY package*.json ./
RUN npm install

# Projeyi kopyala
COPY . .

# Uygulamayı çalıştır
CMD ["npm", "start"]
