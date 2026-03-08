/**
 * hyprland_get_active_window — return metadata for the currently focused window.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getActiveWindow } from "../services/hyprland.js";
import { ResponseFormat, ResponseFormatSchema } from "../schemas/index.js";

const InputSchema = z
  .object({
    response_format: ResponseFormatSchema,
  })
  .strict();

type Input = z.infer<typeof InputSchema>;

export function registerGetActiveWindow(server: McpServer): void {
  server.registerTool(
    "hyprland_get_active_window",
    {
      title: "Get Active Hyprland Window",
      description: `Get metadata for the currently focused (active) window in Hyprland.

Returns the same fields as hyprland_list_windows for a single window: address, class,
title, PID, workspace, monitor, geometry, and flags.

Use this tool when you want to interact with or screenshot whatever the user is looking at.

Args:
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  The currently focused window object, or a message indicating no focused window.

Examples:
  - Use when: "What am I looking at right now?"
  - Use when: "Screenshot the current window" → get address first, then screenshot`,
      inputSchema: InputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: Input) => {
      try {
        const win = getActiveWindow();

        if (!win) {
          return {
            content: [{ type: "text", text: "No active window found (compositor may have no focused surface)." }],
          };
        }

        const text =
          params.response_format === ResponseFormat.JSON
            ? JSON.stringify(win, null, 2)
            : [
                `# Active Window`,
                "",
                `**Class**: ${win.class}`,
                `**Title**: ${win.title}`,
                `**Address**: \`${win.address}\``,
                `**PID**: ${win.pid}`,
                `**Workspace**: ${win.workspace_name} (id ${win.workspace_id})`,
                `**Monitor**: ${win.monitor_id}`,
                `**Geometry**: ${win.x},${win.y}  ${win.width}×${win.height}`,
                `**Floating**: ${win.floating}  **Fullscreen**: ${win.fullscreen}`,
              ].join("\n");

        return {
          content: [{ type: "text", text }],
          structuredContent: win as unknown as Record<string, unknown>,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${msg}` }],
        };
      }
    }
  );
}
