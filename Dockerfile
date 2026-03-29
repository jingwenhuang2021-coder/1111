# 三语翻译官 - Docker 配置
FROM node:18-alpine

WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制代码
COPY scripts/ ./scripts/

# 创建临时目录
RUN mkdir -p .tmp

# 暴露端口（云平台会通过环境变量 PORT 设置）
EXPOSE 3000

# 启动命令
CMD ["npm", "start"]
