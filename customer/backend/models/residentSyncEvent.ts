import { z } from "zod";

/*
 * The CloudFormation custom-resource event the seed sync receives through
 * the CDK provider framework. `SeedHash` changes whenever a seed or the
 * prompt changes, which is what makes CloudFormation send an Update.
 */
export const ResidentSyncEventSchema = z
  .object({
    RequestType: z.enum(["Create", "Update", "Delete"]),
    ResourceProperties: z.object({ SeedHash: z.string().min(1) }).passthrough(),
  })
  .passthrough();
export type ResidentSyncEvent = z.infer<typeof ResidentSyncEventSchema>;
