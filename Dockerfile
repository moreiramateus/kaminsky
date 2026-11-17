FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY src ./src
COPY docs ./docs
RUN mkdir -p data && chown node:node data
USER node
ENV HOST=0.0.0.0 PORT=3000 DATA_FILE=/app/data/estacoes.json
EXPOSE 3000
CMD ["node", "src/server.cjs"]
