/**
 * hyprland_send_key — send a key or key combo to a window (or the active window).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sendKey } from "../services/hyprland.js";
import { WindowSelectorSchema } from "../schemas/index.js";

const InputSchema = z
  .object({
    key: z
      .string()
      .min(1)
      .describe(
        "XKB key name to send (e.g. 'Return', 'Tab', 'Escape', 'F5', 'a', 'space'). " +
        "See xkbcommon key names for the full list."
      ),
    mods: z
      .string()
      .default("")
      .describe(
        "Modifier keys as comma-separated list (e.g. 'ctrl', 'shift', 'ctrl,shift', 'alt', 'super'). " +
        "Leave empty string for no modifiers."
      ),
    window: WindowSelectorSchema.optional().describe(
      "Target window selector. If omitted, the key is sent to the currently active/focused window."
    ),
  })
  .strict();

type Input = z.infer<typeof InputSchema>;

export function registerSendKey(server: McpServer): void {
  server.registerTool(
    "hyprland_send_key",
    {
      title: "Send Key to Hyprland Window",
      description: `Send a key or key combination to a specific window or the active window.

Uses hyprctl dispatch sendshortcut to inject keyboard events without disturbing focus.
The window does not need to be focused — keys can be sent to background windows.

For typing plain text strings, use hyprland_type_text instead.
For special keys that don't need modifiers (Return, Tab, Escape), this tool works well.

Args:
  - key (string): XKB key name — e.g. 'Return', 'Tab', 'Escape', 'F5', 'c', 'space', 'BackSpace'
  - mods (string): Modifier keys, comma-separated — 'ctrl', 'shift', 'alt', 'super', 'ctrl,shift'
                   Use empty string "" for no modifiers (default)
  - window (object, optional): Target window selector:
      - address: Exact window address (most reliable)
      - class: Window class substring
      - title: Window title substring
      - pid: Process ID
    If omitted, targets the currently active window.

Returns:
  {
    "success": boolean,
    "action": "send_key",
    "detail": string   // Confirmation of what was sent and to which window
  }

Examples:
  - "Press Enter in the terminal" → key="Return", class="Alacritty"
  - "Copy selected text in browser" → key="c", mods="ctrl", class="firefox"
  - "Close current tab" → key="w", mods="ctrl", class="firefox"
  - "Press Escape in active window" → key="Escape" (no window selector)
  - "Reload page" → key="F5", class="firefox"
  - "Undo in editor" → key="z", mods="ctrl"

Error cases:
  - "No window found matching" → window not open, check hyprland_list_windows`,
      inputSchema: InputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: Input) => {
      try {
        const result = sendKey(params.mods, params.key, params.window);

        return {
          content: [{ type: "text", text: result.detail ?? "Key sent." }],
          structuredContent: {
            success: result.success,
            action: result.action,
            detail: result.detail,
          },
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
