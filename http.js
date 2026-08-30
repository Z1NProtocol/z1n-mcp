#!/usr/bin/env node
// Z1N MCP — Streamable HTTP transport, hosted.
//
// Read-only. The transaction builders live in the npm package and stay there:
// a hosted service that hands out calldata is a trust point a local encoder
// is not. This endpoint exists so an agent that found Z1N through its
// ERC-8004 registration can read the field without a shell or a Node runtime.
//
// Stateless: a fresh server and transport per request, no session storage.

import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerReadTools } from "./tools.js";

const PORT = process.env.PORT || 3002;
const app = express();

app.use(express.json({ limit: "1mb" }));

// Reads are public by design — same policy as the REST API.
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Mcp-Session-Id, Accept");
  res.header("Access-Control-Expose-Headers", "Mcp-Session-Id");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// Plain GET on /mcp: useful for a human or a crawler that lands here.
// The MCP protocol itself runs over POST.
app.get("/mcp", (req, res) => {
  res.json({
    name: "z1n",
    version: "0.2.0",
    transport: "streamable-http",
    mode: "read-only",
    protocol: "https://modelcontextprotocol.io",
    note: "POST JSON-RPC here. Transaction builders are not hosted — install the local package for those.",
    localPackage: "npx z1n-mcp",
    source: "https://github.com/Z1NProtocol/z1n-mcp",
    docs: "https://www.z1nprotocol.xyz/llms.txt"
  });
});

app.post("/mcp", async (req, res) => {
  try {
    const server = new McpServer({ name: "z1n", version: "0.2.0" });
    registerReadTools(server);

    // sessionIdGenerator: undefined => stateless mode
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP request failed:", err.message);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null
      });
    }
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", mode: "read-only", tools: "reads + action_state" });
});

app.listen(PORT, () => {
  console.log("Z1N MCP (read-only) listening on port " + PORT);
  console.log("  POST /mcp    — MCP over Streamable HTTP");
  console.log("  GET  /mcp    — service description");
  console.log("  GET  /health — health check");
});
