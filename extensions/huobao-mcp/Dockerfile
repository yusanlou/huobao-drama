FROM node:22-alpine AS build
WORKDIR /app/extensions/huobao-mcp
COPY extensions/huobao-mcp/package.json extensions/huobao-mcp/package-lock.json ./
RUN npm ci
COPY extensions/huobao-mcp/tsconfig.json ./
COPY extensions/huobao-mcp/src ./src
COPY shared /app/shared
RUN npm run build && npm prune --omit=dev
FROM node:22-alpine
WORKDIR /app/extensions/huobao-mcp
COPY --from=build /app/extensions/huobao-mcp/package.json ./
COPY --from=build /app/extensions/huobao-mcp/node_modules ./node_modules
COPY --from=build /app/extensions/huobao-mcp/dist ./dist
COPY --from=build /app/shared /app/shared
RUN mkdir /data && chown node:node /data
USER node
ENV HUOBAO_MCP_HOST=0.0.0.0 HUOBAO_MCP_DATA_DIR=/data
EXPOSE 5680
CMD ["node", "dist/index.js"]
