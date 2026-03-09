/**
 * hyprland_switch_workspace — switch to a workspace by ID or name.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { switchWorkspace } from "../services/hyprland.js";

const SwitchWorkspaceInputSchema = z
  .object({
    id: z.number().int().optional().describe("Workspace ID to switch to (e.g. 1, 2, 3)"),
    name: z.string().optional().describe("Workspace name to switch to (e.g. 'main', 'browser')"),
  })
  .strict()
  .refine((data) => data.id !== undefined || data.name !== undefined, {
    message: "Provide either 'id' (number) or 'name' (string) to identify the target workspace.",
  });

type SwitchWorkspaceInput = z.infer<typeof SwitchWorkspaceInputSchema>;

export function registerSwitchWorkspace(server: McpServer): void {
  server.registerTool(
    "hyprland_switch_workspace",
    {
      title: "Switch Hyprland Workspace",
      description: `Switch the active workspace on the focused monitor.

Accepts either a numeric workspace ID or a workspace name. Use hyprland_list_workspaces
to discover available workspaces and their IDs/names.

Hyprland also supports special values for 'name':
  - "previous"  → switch to the previously active workspace
  - "+1" / "-1" → switch to the next / previous workspace relative to current

Args:
  - id (number): Workspace ID to switch to (e.g. 1, 2, 3)
  - name (string): Workspace name to switch to (e.g. 'main', 'browser', 'previous', '+1', '-1')
  Provide exactly one of id or name.

Returns:
  {
    "success": boolean,
    "action": "switch_workspace",
    "detail": string   // Human-readable confirmation of which workspace is now active
  }

Examples:
  - "Switch to workspace 2" → id=2
  - "Go to workspace named browser" → name="browser"
  - "Switch to previous workspace" → name="previous"
  - "Switch to next workspace" → name="+1"
  - "Switch to previous workspace" → name="-1"

Error cases:
  - "hyprctl dispatch workspace failed" → hyprctl not available or invalid workspace`,
      inputSchema: SwitchWorkspaceInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: SwitchWorkspaceInput) => {
      try {
        const target = params.id !== undefined ? params.id : params.name!;
        const result = switchWorkspace(target);

        return {
          content: [{ type: "text", text: result.detail ?? `Switched to workspace ${target}` }],
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
