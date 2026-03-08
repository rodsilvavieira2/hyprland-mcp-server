/**
 * hyprland_type_text / hyprland_press_key — type text or press special keys.
 * Uses wtype for Wayland-native input injection.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { typeText, pressKey } from "../services/hyprland.js";

const TypeTextInputSchema = z
  .object({
    text: z
      .string()
      .min(1, "text must not be empty")
      .max(10000, "text must not exceed 10000 characters")
      .describe("Text string to type into the focused window. Unicode supported."),
    delay_ms: z
      .number()
      .int()
      .min(0)
      .max(5000)
      .optional()
      .describe(
        "Delay between keystrokes in milliseconds (optional). " +
        "Useful for applications that can't handle fast input. Typical value: 20-50."
      ),
  })
  .strict();

const PressKeyInputSchema = z
  .object({
    key: z
      .string()
      .min(1)
      .describe(
        "XKB key name to press (e.g. 'Return', 'Tab', 'Escape', 'BackSpace', 'Delete', " +
        "'Up', 'Down', 'Left', 'Right', 'F1'-'F12', 'Home', 'End', 'Page_Up', 'Page_Down'). " +
        "For key combos with modifiers use hyprland_send_key instead."
      ),
  })
  .strict();

type TypeTextInput = z.infer<typeof TypeTextInputSchema>;
type PressKeyInput = z.infer<typeof PressKeyInputSchema>;

export function registerTypeText(server: McpServer): void {
  // --- hyprland_type_text ---
  server.registerTool(
    "hyprland_type_text",
    {
      title: "Type Text in Hyprland",
      description: `Type a text string into the currently focused window using wtype.

The text is injected directly into the Wayland compositor as keyboard events.
The target window must be focused first — use hyprland_focus_window if needed.
Supports Unicode characters including emoji.

For special keys (Enter, Tab, Escape, arrow keys), use hyprland_press_key.
For key combinations with modifiers (Ctrl+C, Ctrl+V), use hyprland_send_key.

Args:
  - text (string): Text to type. Max 10000 characters. Unicode supported.
  - delay_ms (number, optional): Milliseconds between keystrokes (0-5000).
    Use 20-50ms for applications that drop keystrokes at full speed.

Returns:
  {
    "success": boolean,
    "action": "type_text",
    "detail": string   // e.g. "Typed 12 character(s)"
  }

Examples:
  - "Type hello world into the terminal" → text="hello world"
  - "Fill in a search box" → focus window first, then text="search query"
  - "Type slowly for a laggy app" → text="my input", delay_ms=30
  - "Type a newline" → use hyprland_press_key with key="Return" instead

Error cases:
  - "wtype failed" → WAYLAND_DISPLAY not set or wtype not installed (pacman -S wtype)`,
      inputSchema: TypeTextInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: TypeTextInput) => {
      try {
        const result = typeText(params.text, params.delay_ms);

        return {
          content: [{ type: "text", text: result.detail ?? "Text typed." }],
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

  // --- hyprland_press_key ---
  server.registerTool(
    "hyprland_press_key",
    {
      title: "Press Special Key in Hyprland",
      description: `Press a single special key by XKB name in the currently focused window.

Uses wtype -k to inject a key event. The window must be focused — use hyprland_focus_window first.
For typing text strings use hyprland_type_text.
For key combinations with modifiers (Ctrl+C) use hyprland_send_key.

Common XKB key names:
  Navigation : Return, Tab, Escape, BackSpace, Delete
  Arrows     : Up, Down, Left, Right
  Function   : F1, F2, ..., F12
  Editing    : Home, End, Page_Up, Page_Down, Insert
  Whitespace : space, Tab

Args:
  - key (string): XKB key name (case-sensitive, e.g. 'Return', 'Tab', 'BackSpace')

Returns:
  {
    "success": boolean,
    "action": "press_key",
    "detail": string   // e.g. "Pressed key 'Return'"
  }

Examples:
  - "Press Enter to submit" → key="Return"
  - "Press Tab to navigate" → key="Tab"
  - "Press Escape to cancel" → key="Escape"
  - "Press Delete to clear" → key="Delete"
  - "Press arrow down" → key="Down"

Error cases:
  - "wtype failed" → WAYLAND_DISPLAY not set or wtype not installed (pacman -S wtype)`,
      inputSchema: PressKeyInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: PressKeyInput) => {
      try {
        const result = pressKey(params.key);

        return {
          content: [{ type: "text", text: result.detail ?? "Key pressed." }],
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
