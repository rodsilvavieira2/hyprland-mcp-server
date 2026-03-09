/**
 * hyprland_click_at / hyprland_click_window — simulate mouse clicks.
 * Requires ydotool + ydotoold daemon.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  clickAt,
  clickWindow,
  clickWindowRelative,
  findWindow,
  getRawActiveWindow,
  screenshotWindow,
} from "../services/hyprland.js";
import { WindowSelectorSchema, type WindowSelector } from "../schemas/index.js";
import type { HyprlandWindow } from "../types.js";

const ButtonSchema = z
  .enum(["left", "right", "middle"])
  .default("left")
  .describe("Mouse button to click: 'left' (default), 'right', or 'middle'");

const ClickAtInputBaseSchema = z
  .object({
    x: z.number().int().min(0).describe("Target X coordinate in global layout pixels"),
    y: z.number().int().min(0).describe("Target Y coordinate in global layout pixels"),
    button: ButtonSchema,
    window: WindowSelectorSchema.optional().describe(
      "Optional expected window selector for metadata and optional bounds validation."
    ),
    validate_bounds: z
      .boolean()
      .default(false)
      .describe(
        "If true and window selector is provided, fail when (x,y) is outside selected window bounds."
      ),
  })
  .strict();

const ClickAtInputSchema = ClickAtInputBaseSchema
  .refine((data) => !data.window || hasWindowSelector(data.window), {
    message:
      "When 'window' is provided, include at least one selector: address, class, title, or pid.",
  });

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

const ClickWindowRelativeInputSchema = WindowSelectorSchema.extend({
  local_x: z
    .number()
    .int()
    .describe("Target X coordinate relative to the window's top-left corner (local pixels)."),
  local_y: z
    .number()
    .int()
    .describe("Target Y coordinate relative to the window's top-left corner (local pixels)."),
  button: ButtonSchema,
  focus_first: z
    .boolean()
    .default(true)
    .describe("Focus the window before clicking (default: true)."),
  validate_bounds: z
    .boolean()
    .default(true)
    .describe("If true (default), fail when local coordinates are outside window bounds."),
})
  .strict()
  .refine((data) => data.address || data.class || data.title || data.pid, {
    message:
      "At least one window selector is required: address, class, title, or pid. " +
      "Use hyprland_list_windows to discover available windows.",
  });

type ClickWindowRelativeInput = z.infer<typeof ClickWindowRelativeInputSchema>;

const ClickAndScreenshotInputSchema = ClickAtInputBaseSchema.extend({
  include_image: z
    .boolean()
    .default(true)
    .describe("Include post-click screenshot image in the response (default: true)."),
  retries: z
    .number()
    .int()
    .min(0)
    .max(4)
    .default(0)
    .describe("Number of additional nudge attempts after the first click (0-4)."),
  nudge_px: z
    .number()
    .int()
    .min(1)
    .max(64)
    .default(8)
    .describe("Nudge distance in pixels for fallback attempts (default: 8)."),
  require_focus_match: z
    .boolean()
    .default(true)
    .describe(
      "If window selector is provided, require active window to match selector after click before returning success."
    ),
})
  .strict()
  .refine((data) => !data.window || hasWindowSelector(data.window), {
    message:
      "When 'window' is provided, include at least one selector: address, class, title, or pid.",
  });

type ClickAndScreenshotInput = z.infer<typeof ClickAndScreenshotInputSchema>;

function hasWindowSelector(selector?: WindowSelector): boolean {
  if (!selector) return false;
  return Boolean(selector.address || selector.class || selector.title || selector.pid);
}

function isInsideWindow(window: HyprlandWindow, x: number, y: number): boolean {
  return x >= window.at[0] && x < window.at[0] + window.size[0] && y >= window.at[1] && y < window.at[1] + window.size[1];
}

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
        const expectedWindow = hasWindowSelector(params.window)
          ? findWindow({
              address: params.window?.address,
              class: params.window?.class,
              title: params.window?.title,
              pid: params.window?.pid,
            })
          : undefined;

        if (params.validate_bounds && expectedWindow && !isInsideWindow(expectedWindow, params.x, params.y)) {
          throw new Error(
            `Global point (${params.x}, ${params.y}) is outside expected window bounds ` +
              `${expectedWindow.at[0]},${expectedWindow.at[1]} ${expectedWindow.size[0]}x${expectedWindow.size[1]} ` +
              `for "${expectedWindow.class}". Coordinates for hyprland_click_at are global.`
          );
        }

        const result = clickAt(params.x, params.y, params.button, false, expectedWindow);

        const targetWindowSuffix = result.target_window
          ? ` | target=${result.target_window.class} (${result.target_window.address}) local=(${result.target_window.relative_x},${result.target_window.relative_y})`
          : "";

        return {
          content: [
            {
              type: "text",
              text:
                `${result.button} click at global x=${result.x}, y=${result.y} ` +
                `(coordinate_space=${result.coordinate_space ?? "global"})${targetWindowSuffix}`,
            },
          ],
          structuredContent: {
            x: result.x,
            y: result.y,
            button: result.button,
            coordinate_space: result.coordinate_space ?? "global",
            target_window: result.target_window,
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

  // --- hyprland_click_window_relative ---
  server.registerTool(
    "hyprland_click_window_relative",
    {
      title: "Click Window Relative Coordinates",
      description: `Click inside a specific window using coordinates relative to that window.

This avoids global-coordinate mistakes when using hyprland_screenshot_window output.
Given a local point (local_x, local_y), this tool converts to global coordinates:
  global_x = window_x + local_x
  global_y = window_y + local_y

Args:
  - address|class|title|pid: Window selector (one required)
  - local_x (number): X in window-local pixels
  - local_y (number): Y in window-local pixels
  - button ('left' | 'right' | 'middle'): Mouse button (default: 'left')
  - focus_first (boolean): Focus window before click (default: true)
  - validate_bounds (boolean): Ensure local point is inside window bounds (default: true)

Returns click metadata including global coordinates and local coordinates.
`,
      inputSchema: ClickWindowRelativeInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: ClickWindowRelativeInput) => {
      try {
        const result = clickWindowRelative(
          {
            address: params.address,
            class: params.class,
            title: params.title,
            pid: params.pid,
          },
          params.local_x,
          params.local_y,
          {
            button: params.button,
            focus_first: params.focus_first,
            validate_bounds: params.validate_bounds,
          }
        );

        return {
          content: [
            {
              type: "text",
              text:
                `${result.button} click from local coordinates succeeded: ` +
                `global=(${result.x},${result.y}) ` +
                `local=(${result.target_window?.relative_x ?? "?"},${result.target_window?.relative_y ?? "?"}) ` +
                `(coordinate_space=${result.coordinate_space ?? "global"})`,
            },
          ],
          structuredContent: {
            x: result.x,
            y: result.y,
            button: result.button,
            coordinate_space: result.coordinate_space ?? "global",
            target_window: result.target_window,
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

  // --- hyprland_click_and_screenshot_active ---
  server.registerTool(
    "hyprland_click_and_screenshot_active",
    {
      title: "Click and Screenshot Active Window",
      description: `Execute click-at with optional bounded retries, then capture the active window screenshot.

This helper implements a practical click → verify loop:
1) click at global coordinates
2) optionally retry nearby nudged points if focus does not match expected window
3) capture and return active-window screenshot for visual verification

When 'window' selector is provided and 'require_focus_match=true', the tool only succeeds
when the active window matches the selected window.
`,
      inputSchema: ClickAndScreenshotInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: ClickAndScreenshotInput) => {
      const expectedWindow = hasWindowSelector(params.window)
        ? findWindow({
            address: params.window?.address,
            class: params.window?.class,
            title: params.window?.title,
            pid: params.window?.pid,
          })
        : undefined;

      const n = params.nudge_px;
      const offsets: Array<[number, number]> = [
        [0, 0],
        [-n, 0],
        [n, 0],
        [0, -n],
        [0, n],
      ];
      const maxAttempts = Math.min(params.retries + 1, offsets.length);

      let lastError: string | undefined;
      for (let i = 0; i < maxAttempts; i += 1) {
        const [dx, dy] = offsets[i];
        const clickX = params.x + dx;
        const clickY = params.y + dy;

        try {
          if (params.validate_bounds && expectedWindow && !isInsideWindow(expectedWindow, clickX, clickY)) {
            lastError =
              `Attempt ${i + 1}: point (${clickX}, ${clickY}) outside expected window bounds ` +
              `${expectedWindow.at[0]},${expectedWindow.at[1]} ${expectedWindow.size[0]}x${expectedWindow.size[1]}`;
            continue;
          }

          const clickResult = clickAt(clickX, clickY, params.button, false, expectedWindow);
          const active = getRawActiveWindow();

          if (expectedWindow && params.require_focus_match && active?.address !== expectedWindow.address) {
            lastError =
              `Attempt ${i + 1}: active window mismatch after click. ` +
              `Expected ${expectedWindow.address}, got ${active?.address ?? "none"}.`;
            continue;
          }

          if (!active) {
            lastError = `Attempt ${i + 1}: no active window after click.`;
            continue;
          }

          const shot = screenshotWindow(active);
          const content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> = [
            {
              type: "text",
              text: [
                `click+capture succeeded on attempt ${i + 1}/${maxAttempts}`,
                `click_global=(${clickResult.x},${clickResult.y})`,
                `coordinate_space=${clickResult.coordinate_space ?? "global"}`,
                `active_window=${active.class} (${active.address})`,
                `screenshot=${shot.file_path}`,
              ].join("\n"),
            },
          ];

          if (params.include_image) {
            content.push({
              type: "image",
              data: shot.base64_image,
              mimeType: "image/png",
            });
          }

          return {
            content,
            structuredContent: {
              attempt: i + 1,
              attempts_total: maxAttempts,
              click: {
                x: clickResult.x,
                y: clickResult.y,
                button: clickResult.button,
                coordinate_space: clickResult.coordinate_space ?? "global",
                target_window: clickResult.target_window,
              },
              active_window: {
                address: active.address,
                class: active.class,
                title: active.title,
              },
              screenshot: {
                window_address: shot.window_address,
                window_class: shot.window_class,
                window_title: shot.window_title,
                geometry: shot.geometry,
                file_path: shot.file_path,
                width: shot.width,
                height: shot.height,
              },
            },
          };
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
        }
      }

      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error: click+capture failed after ${maxAttempts} attempt(s). ${lastError ?? "Unknown error."}`,
          },
        ],
      };
    }
  );
}
