#!/usr/bin/env node
/**
 * hyprland-mcp-server
 *
 * MCP server (stdio transport) for capturing screenshots, querying
 * window/monitor/workspace state, and sending mouse/keyboard input
 * in the Hyprland Wayland compositor.
 *
 * Required (must be on PATH):
 *   - hyprctl  (bundled with Hyprland)
 *   - grim     (Wayland screenshot tool)
 *
 * Optional — needed for mouse click / keyboard input tools:
 *   - wtype    (Wayland keyboard input, for hyprland_type_text / hyprland_press_key)
 *   - ydotool  (Wayland mouse input, for hyprland_click_at / hyprland_click_window)
 *              Also requires the ydotoold daemon: systemctl --user start ydotoold
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
import { checkDependencies, checkInputDependencies } from "./services/hyprland.js";
import { registerListWindows } from "./tools/list-windows.js";
import { registerGetActiveWindow } from "./tools/get-active-window.js";
import { registerScreenshotWindow } from "./tools/screenshot-window.js";
import { registerScreenshotActiveWindow } from "./tools/screenshot-active-window.js";
import { registerScreenshotMonitor } from "./tools/screenshot-monitor.js";
import { registerListMonitors } from "./tools/list-monitors.js";
import { registerListWorkspaces } from "./tools/list-workspaces.js";
import { registerFocusWindow } from "./tools/focus-window.js";
import { registerGetCursorPos } from "./tools/get-cursor-pos.js";
import { registerMoveCursor } from "./tools/move-cursor.js";
import { registerSendKey } from "./tools/send-key.js";
import { registerClick } from "./tools/click.js";
import { registerTypeText } from "./tools/type-text.js";

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

const { wtype, ydotool } = checkInputDependencies();
if (!wtype) {
  process.stderr.write(
    `[hyprland-mcp-server] WARN: 'wtype' not found — hyprland_type_text and hyprland_press_key will fail at runtime.\n` +
      `  Install: pacman -S wtype\n`
  );
}
if (!ydotool) {
  process.stderr.write(
    `[hyprland-mcp-server] WARN: 'ydotool' not found — hyprland_click_at and hyprland_click_window will fail at runtime.\n` +
      `  Install: pacman -S ydotool  (and run: systemctl --user enable --now ydotoold)\n`
  );
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
registerFocusWindow(server);
registerGetCursorPos(server);
registerMoveCursor(server);
registerSendKey(server);
registerClick(server);
registerTypeText(server);

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
