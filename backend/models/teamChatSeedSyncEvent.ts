import { z } from "zod";

/* The CloudFormation custom resource event the Team Chat seed sync receives, through the CDK provider framework. Lenient beyond these fields. */
export const TeamChatSeedSyncEventSchema = z.object({
  RequestType: z.enum(["Create", "Update", "Delete"]),
});
export type TeamChatSeedSyncEvent = z.infer<typeof TeamChatSeedSyncEventSchema>;
