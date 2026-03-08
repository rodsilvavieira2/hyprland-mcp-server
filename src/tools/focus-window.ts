/**
 * hyprland_focus_window — bring keyboard/compositor focus to a specific window.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { focusWindow } from "../services/hyprland.js";
import { WindowSelectorSchema } from "../schemas/index.js";

const InputSchema = WindowSelectorSchema.strict().refine(
  (data) => data.address || data.class || data.title || data.pid,
  {
    message:
      "At least one selector is required: address, class, title, or pid. " +
      "Use hyprland_list_windows to discover available windows.",
  }
);

type Input = z.infer<typeof InputSchema>;

export function registerFocusWindow(server: McpServer): void {
  server.registerTool(
    "hyprland_focus_window",
    {
      title: "Focus Hyprland Window",
      description: `Bring keyboard and compositor focus to a specific window in Hyprland.

Uses hyprctl dispatch focuswindow to focus the target window. After focusing,
keyboard input (type_text, send_key) will be directed to that window.

Identify the target window with ONE of: address, class (substring), title (substring), or pid.
Prefer \`address\` for precision; class/title for convenience.
Use hyprland_list_windows to discover available windows and their addresses.

Args:
  - address (string): Exact window address (e.g. '0x55e21b244e60') — most reliable
  - class (string): Window class substring (e.g. 'firefox', 'Alacritty')
  - title (string): Window title substring (e.g. 'vim', 'Settings')
  - pid (number): Process ID of the window

Returns:
  {
    "success": boolean,
    "action": "focus_window",
    "detail": string   // Human-readable confirmation with window info
  }

Examples:
  - Use when: "Focus the terminal" → class="Alacritty"
  - Use when: "Switch to the browser" → class="firefox"
  - Use when: "Focus this specific window" → address="0x..."
  - Use before: typing text or sending keys to a specific window

Error cases:
  - "No window found matching" → window not open, check hyprland_list_windows`,
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
        const result = focusWindow({
          address: params.address,
          class: params.class,
          title: params.title,
          pid: params.pid,
        });

        const structured = {
          success: result.success,
          action: result.action,
          detail: result.detail,
        };

        return {
          content: [{ type: "text", text: result.detail ?? "Window focused." }],
          structuredContent: structured,
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
