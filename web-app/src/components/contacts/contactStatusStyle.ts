import type { ContactStatus } from "../../models/contact";

/* The status pill's colours, shared by a list row and the detail panel. */
export const CONTACT_STATUS_CLASSES: Readonly<Record<ContactStatus, string>> = {
  RECEIVED: "bg-panel-strong text-fg-muted",
  IN_PROGRESS: "bg-panel-strong text-hue-indigo",
  CLOSED: "bg-panel-strong text-fg-subtle",
};
