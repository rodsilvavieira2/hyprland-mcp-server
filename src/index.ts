#!/usr/bin/env node
/**
 * hyprland-mcp-server
 *
 * MCP server (stdio transport) for capturing screenshots and querying
 * window/monitor/workspace state in the Hyprland Wayland compositor.
 *
 * Requirements (must be on PATH):
 *   - hyprctl  (bundled with Hyprland)
 *   - grim     (Wayland screenshot tool)
 *
 * Usage:
 *   node dist/index.js
 *
 * MCP client config (e.g. Claude Desktop):
 *   {
 *     "mcpServers": {
 *       "hyprland": {
 *         "command": "node",
 *         "args": ["/path/to/hyprland-mcp-server/dist/index.js"]
 *       }
 *     }
 *   }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { checkDependencies } from "./services/hyprland.js";
import { registerListWindows } from "./tools/list-windows.js";
import { registerGetActiveWindow } from "./tools/get-active-window.js";
import { registerScreenshotWindow } from "./tools/screenshot-window.js";
import { registerScreenshotActiveWindow } from "./tools/screenshot-active-window.js";
import { registerScreenshotMonitor } from "./tools/screenshot-monitor.js";
import { registerListMonitors } from "./tools/list-monitors.js";
import { registerListWorkspaces } from "./tools/list-workspaces.js";

// ---------------------------------------------------------------------------
// Dependency check
// ---------------------------------------------------------------------------

const { ok, missing } = checkDependencies();
if (!ok) {
  process.stderr.write(
    `[hyprland-mcp-server] ERROR: Missing required binaries: ${missing.join(", ")}\n` +
      `Install them and ensure they are on PATH before starting the server.\n` +
      `  hyprctl — bundled with Hyprland\n` +
      `  grim    — https://sr.ht/~emersion/grim/\n`
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "hyprland-mcp-server",
  version: "1.0.0",
});

// Register all tools
registerListWindows(server);
registerGetActiveWindow(server);
registerScreenshotWindow(server);
registerScreenshotActiveWindow(server);
registerScreenshotMonitor(server);
registerListMonitors(server);
registerListWorkspaces(server);

// ---------------------------------------------------------------------------
// Start stdio transport
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[hyprland-mcp-server] Running via stdio. Ready.\n");
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[hyprland-mcp-server] Fatal error: ${msg}\n`);
  process.exit(1);
});
