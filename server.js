#!/usr/bin/env node
// Z1N MCP — stdio transport, local.
// Reads plus transaction builders. Encoding happens on the machine that signs.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerReadTools, registerBuilderTools } from "./tools.js";

const server = new McpServer({ name: "z1n", version: "0.2.0" });

registerReadTools(server);
registerBuilderTools(server);

await server.connect(new StdioServerTransport());
