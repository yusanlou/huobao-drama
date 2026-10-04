// A transport bridge only: all authorization, switch checks and state live in HTTP service.
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

const url = process.env.HUOBAO_MCP_URL || 'http://localhost:5680/mcp'
const token = process.env.HUOBAO_MCP_TOKEN
if (!token) throw new Error('HUOBAO_MCP_TOKEN is required. Copy credentials from Huobao settings.')
const client = new Client({ name: 'huobao-stdio-bridge', version: '0.2.0' })
await client.connect(new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }))
const server = new Server({ name: 'huobao-mcp', version: '0.2.0' }, { capabilities: { tools: {} } })
server.setRequestHandler(ListToolsRequestSchema, request => client.listTools(request.params))
server.setRequestHandler(CallToolRequestSchema, async request => {
  try { return await client.callTool(request.params) }
  catch { return { isError: true, content: [{ type: 'text', text: 'MCP extension is disabled or unreachable. Check Huobao settings; do not blindly retry a write.' }] } }
})
await server.connect(new StdioServerTransport())
let closing = false
async function close() { if (closing) return; closing = true; await server.close(); await client.close() }
process.stdin.on('end', () => { void close() })
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { void close().then(() => process.exit(0)) })
