/**
 * hyprland_screenshot_active_window — capture the currently focused window.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getRawActiveWindow, screenshotWindow } from "../services/hyprland.js";

const InputSchema = z
  .object({
    include_image: z
      .boolean()
      .default(true)
      .describe("Include the screenshot as a base64 image in the response (default: true)"),
  })
  .strict();

type Input = z.infer<typeof InputSchema>;

export function registerScreenshotActiveWindow(server: McpServer): void {
  server.registerTool(
    "hyprland_screenshot_active_window",
    {
      title: "Screenshot Active Hyprland Window",
      description: `Capture a screenshot of the currently focused (active) window in Hyprland.

No selector needed — automatically identifies the focused surface via hyprctl activewindow.
This is the most convenient way to screenshot "what the user is currently looking at".

Args:
  - include_image (boolean): Embed base64 PNG in response (default: true)

Returns:
  {
    "window_address": string,
    "window_class": string,
    "window_title": string,
    "geometry": string,
    "file_path": string,
    "width": number,
    "height": number
  }
  Plus an embedded PNG image when include_image is true.

Examples:
  - Use when: "Screenshot what I'm looking at"
  - Use when: "Take a screenshot of the current window"
  - Use when: "Capture my active app"

Error cases:
  - "No active window" → compositor has no focused surface (e.g. desktop focused)`,
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
        const raw = getRawActiveWindow();
        if (!raw) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "No active window found. The compositor may have no focused surface. Try clicking a window first.",
              },
            ],
          };
        }

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
              `# Active Window Screenshot: ${result.window_class}`,
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
