/**
 * hyprland_click_at / hyprland_click_window — simulate mouse clicks.
 * Requires ydotool + ydotoold daemon.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { clickAt, clickWindow } from "../services/hyprland.js";
import { WindowSelectorSchema } from "../schemas/index.js";

const ButtonSchema = z
  .enum(["left", "right", "middle"])
  .default("left")
  .describe("Mouse button to click: 'left' (default), 'right', or 'middle'");

const ClickAtInputSchema = z
  .object({
    x: z.number().int().min(0).describe("Target X coordinate in global layout pixels"),
    y: z.number().int().min(0).describe("Target Y coordinate in global layout pixels"),
    button: ButtonSchema,
  })
  .strict();

const ClickWindowInputSchema = WindowSelectorSchema.extend({
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
    .describe("Focus the window before clicking (default: true). Set false to click without changing focus."),
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

type ClickAtInput = z.infer<typeof ClickAtInputSchema>;
type ClickWindowInput = z.infer<typeof ClickWindowInputSchema>;

export function registerClick(server: McpServer): void {
  // --- hyprland_click_at ---
  server.registerTool(
    "hyprland_click_at",
    {
      title: "Click at Coordinates in Hyprland",
      description: `Move the cursor to absolute coordinates and perform a mouse click.

Requires ydotool and the ydotoold daemon to be running.
The cursor is moved to the target position first, then the click is fired.

Coordinates are in global layout pixels. Use hyprland_list_windows to get window geometry
(x, y, width, height) to compute target coordinates. Use hyprland_get_cursor_pos to
verify position after clicking.

Args:
  - x (number): Target X coordinate in pixels (≥ 0)
  - y (number): Target Y coordinate in pixels (≥ 0)
  - button ('left' | 'right' | 'middle'): Mouse button to use (default: 'left')

Returns:
  {
    "x": number,       // X coordinate clicked
    "y": number,       // Y coordinate clicked
    "button": string   // Button that was clicked
  }

Examples:
  - "Click at top-left of screen" → x=10, y=10
  - "Right-click at center" → x=960, y=540, button="right"
  - "Click a specific pixel" → x=450, y=320

Error cases:
  - "ydotool failed" → ydotoold daemon not running. Start with: systemctl --user start ydotoold`,
      inputSchema: ClickAtInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: ClickAtInput) => {
      try {
        const result = clickAt(params.x, params.y, params.button);

        return {
          content: [
            {
              type: "text",
              text: `${result.button} click at x=${result.x}, y=${result.y}`,
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

  // --- hyprland_click_window ---
  server.registerTool(
    "hyprland_click_window",
    {
      title: "Click Hyprland Window",
      description: `Click on a window by targeting its center (with optional offset).

Automatically computes the window center from its geometry and performs a click there.
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
    "x": number,       // Actual X coordinate clicked
    "y": number,       // Actual Y coordinate clicked
    "button": string   // Button that was clicked
  }

Examples:
  - "Click the terminal window" → class="Alacritty"
  - "Right-click the browser" → class="firefox", button="right"
  - "Click a button slightly above center" → class="myapp", offset_y=-50

Error cases:
  - "No window found matching" → check hyprland_list_windows
  - "invalid size" → window is hidden or minimized
  - "ydotool failed" → ydotoold daemon not running. Start with: systemctl --user start ydotoold`,
      inputSchema: ClickWindowInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: ClickWindowInput) => {
      try {
        const result = clickWindow(
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
              text: `${result.button} click on window center at x=${result.x}, y=${result.y}`,
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
