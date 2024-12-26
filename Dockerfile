FROM node:21.2.0

# 安裝系統依賴
RUN dpkg --add-architecture i386 && \
    apt-get update && apt-get install -y \
    libgconf-2-4 \
    libxss1 \
    libxtst6 \
    xvfb \
    libgtk-3-0 \
    libnss3 \
    libasound2 \
    # 安裝 Wine 相關套件
    wine64 \
    wine32 \
    # 安裝 NSIS
    nsis \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 首先只複製 package 檔案以利用快取
COPY package*.json ./

# 使用 ci 而不是 install 以確保依賴版本一致性
RUN npm ci

# 複製其餘檔案
COPY . .

ENV NODE_ENV=production

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]