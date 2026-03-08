/**
 * hyprland_screenshot_monitor — capture a full monitor screenshot.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listRawMonitors, screenshotMonitor } from "../services/hyprland.js";

const InputSchema = z
  .object({
    monitor: z
      .string()
      .optional()
      .describe(
        "Monitor name (e.g. 'DP-1', 'HDMI-A-1'). Use hyprland_list_monitors to list names. " +
          "Omit to capture the focused monitor."
      ),
    include_image: z
      .boolean()
      .default(true)
      .describe("Include the screenshot as a base64 image in the response (default: true)"),
  })
  .strict();

type Input = z.infer<typeof InputSchema>;

export function registerScreenshotMonitor(server: McpServer): void {
  server.registerTool(
    "hyprland_screenshot_monitor",
    {
      title: "Screenshot Hyprland Monitor",
      description: `Capture a full-monitor screenshot in Hyprland using grim.

Captures the entire display output of a single monitor. Useful for capturing the full
desktop or when you need to see the complete layout across all windows on that output.

Args:
  - monitor (string): Monitor name like 'DP-1' or 'HDMI-A-1'. Omit for the focused monitor.
    Use hyprland_list_monitors to discover available monitor names.
  - include_image (boolean): Embed base64 PNG in response (default: true)

Returns:
  {
    "monitor_name": string,
    "geometry": string,   // e.g. "0,0 1920x1080"
    "file_path": string,
    "width": number,
    "height": number
  }
  Plus an embedded PNG image when include_image is true.

Examples:
  - Use when: "Screenshot the whole screen"
  - Use when: "Capture monitor DP-1" → monitor="DP-1"
  - Use when: "Take a screenshot of my display"

Error cases:
  - "Monitor not found" → check hyprland_list_monitors for valid names`,
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
        const monitors = listRawMonitors();
        if (monitors.length === 0) {
          return {
            isError: true,
            content: [{ type: "text", text: "No monitors found. Is Hyprland running?" }],
          };
        }

        let target = monitors.find((m) => m.focused);

        if (params.monitor) {
          const name = params.monitor.toLowerCase();
          target = monitors.find((m) => m.name.toLowerCase() === name);
          if (!target) {
            const names = monitors.map((m) => m.name).join(", ");
            return {
              isError: true,
              content: [
                {
                  type: "text",
                  text: `Monitor "${params.monitor}" not found. Available monitors: ${names}`,
                },
              ],
            };
          }
        }

        if (!target) {
          target = monitors[0];
        }

        const result = screenshotMonitor(target);

        const structured = {
          monitor_name: target.name,
          monitor_id: target.id,
          geometry: result.geometry,
          file_path: result.file_path,
          width: result.width,
          height: result.height,
        };

        const content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> = [
          {
            type: "text",
            text: [
              `# Monitor Screenshot: ${target.name}`,
              `**Model**: ${target.make} ${target.model}`,
              `**Resolution**: ${target.width}×${target.height} @ ${target.refreshRate.toFixed(2)}Hz`,
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
