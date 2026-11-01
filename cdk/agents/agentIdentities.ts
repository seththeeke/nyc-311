/*
 * The agents that get their own AWS role (docs/agent-automation-setup.md),
 * by the name each one stamps on its sessions as the source identity, so
 * CloudTrail records which agent acted. One entry per role in this folder.
 */
export const AGENT_HOST_USER_NAME = "nyc311-agent-host";

export const DEVX_AGENT = { name: "devx-agent", roleName: "Nyc311DevxAgentRole" } as const;
