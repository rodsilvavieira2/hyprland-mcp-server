/**
 * hyprland_screenshot_window — capture a screenshot of a specific window.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { findWindow, screenshotWindow } from "../services/hyprland.js";
import { WindowSelectorSchema } from "../schemas/index.js";

const InputSchema = WindowSelectorSchema.extend({
  include_image: z
    .boolean()
    .default(true)
    .describe("Include the screenshot as a base64 image in the response (default: true)"),
}).strict().refine(
  (data) => data.address || data.class || data.title || data.pid,
  {
    message:
      "At least one selector is required: address, class, title, or pid. " +
      "Use hyprland_list_windows to discover available windows.",
  }
);

type Input = z.infer<typeof InputSchema>;

export function registerScreenshotWindow(server: McpServer): void {
  server.registerTool(
    "hyprland_screenshot_window",
    {
      title: "Screenshot Hyprland Window",
      description: `Capture a screenshot of a specific window in Hyprland using grim.

Identify the target window with ONE of: address, class (substring), title (substring), or pid.
Prefer \`address\` for precision; class/title for convenience. Use hyprland_list_windows
to discover addresses and classes.

The window must be mapped and visible (not minimized). Overlapping windows from other
workspaces may appear if they share screen coordinates.

Args:
  - address (string): Exact window address (e.g. '0x55e21b244e60') — most reliable
  - class (string): Window class substring (e.g. 'firefox', 'Alacritty')
  - title (string): Window title substring (e.g. 'vim', 'README')
  - pid (number): Process ID of the window
  - include_image (boolean): Embed base64 PNG in response (default: true)

Returns:
  {
    "window_address": string,
    "window_class": string,
    "window_title": string,
    "geometry": string,       // e.g. "14,62 1892x1004"
    "file_path": string,      // path to saved PNG
    "width": number,
    "height": number
  }
  Plus an embedded PNG image when include_image is true.

Examples:
  - Use when: "Screenshot the terminal" → class="Alacritty"
  - Use when: "Capture the browser" → class="firefox"
  - Use when: "Screenshot this specific window" → address="0x..."

Error cases:
  - "No window found matching" → window not open, check hyprland_list_windows
  - "invalid size" → window is hidden or on another workspace`,
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
        const raw = findWindow({
          address: params.address,
          class: params.class,
          title: params.title,
          pid: params.pid,
        });

        const result = screenshotWindow(raw);

        const structured = {
          window_address: result.window_address,
          window_class: result.window_class,
          window_title: result.window_title,
          geometry: result.geometry,
          file_path: result.file_path,
          width: result.width,
          height: result.height,
        };

        const content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> = [
          {
            type: "text",
            text: [
              `# Screenshot: ${result.window_class}`,
              `**Title**: ${result.window_title}`,
              `**Geometry**: ${result.geometry}`,
              `**Saved to**: ${result.file_path}`,
            ].join("\n"),
          },
        ];

        if (params.include_image) {
          content.push({
            type: "image",
            data: result.base64_image,
            mimeType: "image/png",
          });
        }

        return { content, structuredContent: structured };
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
