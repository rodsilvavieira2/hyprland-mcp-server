/**
 * hyprland_double_click_at / hyprland_double_click_window — simulate double mouse clicks.
 * Requires ydotool + ydotoold daemon.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { doubleClickAt, doubleClickWindow } from "../services/hyprland.js";
import { WindowSelectorSchema } from "../schemas/index.js";

const ButtonSchema = z
  .enum(["left", "right", "middle"])
  .default("left")
  .describe("Mouse button to double-click: 'left' (default), 'right', or 'middle'");

const DoubleClickAtInputSchema = z
  .object({
    x: z.number().int().min(0).describe("Target X coordinate in global layout pixels"),
    y: z.number().int().min(0).describe("Target Y coordinate in global layout pixels"),
    button: ButtonSchema,
  })
  .strict();

const DoubleClickWindowInputSchema = WindowSelectorSchema.extend({
  button: ButtonSchema,
  offset_x: z
    .number()
    .int()
    .default(0)
    .describe("Horizontal offset from window center in pixels (positive = right, negative = left)"),
  offset_y: z
    .number()
    .int()
    .default(0)
    .describe("Vertical offset from window center in pixels (positive = down, negative = up)"),
  focus_first: z
    .boolean()
    .default(true)
    .describe("Focus the window before clicking (default: true)."),
})
  .strict()
  .refine(
    (data) => data.address || data.class || data.title || data.pid,
    {
      message:
        "At least one window selector is required: address, class, title, or pid. " +
        "Use hyprland_list_windows to discover available windows.",
    }
  );

type DoubleClickAtInput = z.infer<typeof DoubleClickAtInputSchema>;
type DoubleClickWindowInput = z.infer<typeof DoubleClickWindowInputSchema>;

export function registerDoubleClick(server: McpServer): void {
  // --- hyprland_double_click_at ---
  server.registerTool(
    "hyprland_double_click_at",
    {
      title: "Double-Click at Coordinates in Hyprland",
      description: `Move the cursor to absolute coordinates and perform a double mouse click.

Requires ydotool and the ydotoold daemon to be running.
The cursor is moved to the target position first, then two clicks are fired with a short pause.

Coordinates are in global layout pixels. Use hyprland_list_windows to get window geometry
(x, y, width, height) to compute target coordinates.

Args:
  - x (number): Target X coordinate in pixels (≥ 0)
  - y (number): Target Y coordinate in pixels (≥ 0)
  - button ('left' | 'right' | 'middle'): Mouse button to use (default: 'left')

Returns:
  {
    "x": number,       // X coordinate clicked
    "y": number,       // Y coordinate clicked
    "button": string   // Button that was double-clicked
  }

Examples:
  - "Double-click at center of screen" → x=960, y=540
  - "Double-click a specific pixel" → x=450, y=320

Error cases:
  - "ydotool failed" → ydotoold daemon not running. Start with: systemctl --user start ydotoold`,
      inputSchema: DoubleClickAtInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: DoubleClickAtInput) => {
      try {
        const result = doubleClickAt(params.x, params.y, params.button);

        return {
          content: [
            {
              type: "text",
              text: `double ${result.button} click at x=${result.x}, y=${result.y}`,
            },
          ],
          structuredContent: { x: result.x, y: result.y, button: result.button },
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

  // --- hyprland_double_click_window ---
  server.registerTool(
    "hyprland_double_click_window",
    {
      title: "Double-Click Hyprland Window",
      description: `Double-click on a window by targeting its center (with optional offset).

Automatically computes the window center from its geometry and performs a double click there.
Requires ydotool and the ydotoold daemon to be running.

Identify the target window with ONE of: address, class (substring), title (substring), or pid.
Use hyprland_list_windows to discover available windows.

Args:
  - address (string): Exact window address — most reliable
  - class (string): Window class substring (e.g. 'firefox', 'Alacritty')
  - title (string): Window title substring
  - pid (number): Process ID
  - button ('left' | 'right' | 'middle'): Mouse button (default: 'left')
  - offset_x (number): Pixels from center horizontally (default: 0)
  - offset_y (number): Pixels from center vertically (default: 0)
  - focus_first (boolean): Focus window before clicking (default: true)

Returns:
  {
    "x": number,       // Actual X coordinate double-clicked
    "y": number,       // Actual Y coordinate double-clicked
    "button": string   // Button that was double-clicked
  }

Examples:
  - "Double-click the file manager window" → class="nautilus"
  - "Double-click a file in the terminal" → class="Alacritty", offset_y=-50

Error cases:
  - "No window found matching" → check hyprland_list_windows
  - "invalid size" → window is hidden or minimized
  - "ydotool failed" → ydotoold daemon not running. Start with: systemctl --user start ydotoold`,
      inputSchema: DoubleClickWindowInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: DoubleClickWindowInput) => {
      try {
        const result = doubleClickWindow(
          {
            address: params.address,
            class: params.class,
            title: params.title,
            pid: params.pid,
          },
          {
            offset_x: params.offset_x,
            offset_y: params.offset_y,
            button: params.button,
            focus_first: params.focus_first,
          }
        );

        return {
          content: [
            {
              type: "text",
              text: `double ${result.button} click on window center at x=${result.x}, y=${result.y}`,
            },
          ],
          structuredContent: { x: result.x, y: result.y, button: result.button },
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
