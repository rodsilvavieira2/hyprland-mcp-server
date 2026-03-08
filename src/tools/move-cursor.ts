/**
 * hyprland_move_cursor — move the cursor to absolute global coordinates.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { moveCursor } from "../services/hyprland.js";

const InputSchema = z
  .object({
    x: z
      .number()
      .int()
      .min(0)
      .describe("Target X coordinate in global layout pixels (from left edge)"),
    y: z
      .number()
      .int()
      .min(0)
      .describe("Target Y coordinate in global layout pixels (from top edge)"),
  })
  .strict();

type Input = z.infer<typeof InputSchema>;

export function registerMoveCursor(server: McpServer): void {
  server.registerTool(
    "hyprland_move_cursor",
    {
      title: "Move Hyprland Cursor",
      description: `Move the mouse cursor to an absolute position in global layout coordinates.

Uses hyprctl dispatch movecursor to reposition the cursor without clicking.
Coordinates are in pixels relative to the top-left corner of the Wayland compositor canvas.

Use hyprland_list_windows to get window geometry (x, y, width, height) and compute
target coordinates. To click at the position, use hyprland_click_at afterwards.

Args:
  - x (number): Target X coordinate in pixels (≥ 0)
  - y (number): Target Y coordinate in pixels (≥ 0)

Returns:
  {
    "x": number,   // Final X position
    "y": number    // Final Y position
  }

Examples:
  - Use when: "Move cursor to center of screen" → x=960, y=540
  - Use when: Positioning cursor before a manual interaction
  - Use before: hyprland_click_at to pre-position

Error cases:
  - Coordinates outside monitor bounds are clamped by the compositor`,
      inputSchema: InputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: Input) => {
      try {
        const pos = moveCursor(params.x, params.y);

        return {
          content: [
            {
              type: "text",
              text: `Cursor moved to x=${pos.x}, y=${pos.y}`,
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
