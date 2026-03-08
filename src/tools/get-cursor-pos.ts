/**
 * hyprland_get_cursor_pos — get the current cursor position in global layout coordinates.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getCursorPos } from "../services/hyprland.js";

const InputSchema = z.object({}).strict();

type Input = z.infer<typeof InputSchema>;

export function registerGetCursorPos(server: McpServer): void {
  server.registerTool(
    "hyprland_get_cursor_pos",
    {
      title: "Get Hyprland Cursor Position",
      description: `Get the current cursor (mouse pointer) position in global layout coordinates.

Returns the absolute X/Y position of the mouse cursor on the Wayland compositor canvas.
Coordinates are in pixels relative to the top-left corner of the global layout (across all monitors).

Returns:
  {
    "x": number,   // Horizontal position in pixels
    "y": number    // Vertical position in pixels
  }

Examples:
  - Use when: "Where is the cursor right now?"
  - Use when: Verifying cursor position after hyprland_move_cursor
  - Use when: Computing relative coordinates for a click`,
      inputSchema: InputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (_params: Input) => {
      try {
        const pos = getCursorPos();

        return {
          content: [
            {
              type: "text",
              text: `Cursor position: x=${pos.x}, y=${pos.y}`,
            },
          ],
          structuredContent: { x: pos.x, y: pos.y },
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
