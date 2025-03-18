FROM node:16-alpine

# Diretório de trabalho dentro do container
WORKDIR /app

# Copiar arquivos de dependências primeiro para aproveitar o cache de camadas do Docker
COPY package*.json ./
RUN npm install

# Copiar o restante do código-fonte
COPY . .

# Criar diretório para uploads
RUN mkdir -p uploads && chmod 755 uploads

# Compilar o TypeScript
RUN npm run build

# Expor a porta da aplicação
EXPOSE 3000

# Comando para iniciar a aplicação
CMD ["npm", "start"]
