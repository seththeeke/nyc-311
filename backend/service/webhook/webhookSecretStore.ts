import { GetParameterCommand, PutParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { logInfo } from "../../logger";
import { TerminalError } from "../../models/errors";

/**
 * SSM Parameter Store access for webhook secrets
 * (`13-customer-simulation.md` §2/§5) — every value is a SecureString.
 * Logs parameter names only, never a value.
 */
export class WebhookSecretStore {
  constructor(private readonly client: SSMClient = new SSMClient({})) {}

  /** @throws {@link TerminalError} if the parameter is missing or empty. */
  async getSecret(parameterName: string): Promise<string> {
    logInfo("WebhookSecretStore.getSecret", { parameterName });
    const result = await this.client.send(new GetParameterCommand({ Name: parameterName, WithDecryption: true }));
    const value = result.Parameter?.Value;
    if (!value) {
      throw new TerminalError(`SSM parameter ${parameterName} has no value`);
    }
    return value;
  }

  /** Creates or overwrites — re-registration replaces a subscription's secret in place. */
  async putSecret(parameterName: string, value: string): Promise<void> {
    logInfo("WebhookSecretStore.putSecret", { parameterName });
    await this.client.send(new PutParameterCommand({ Name: parameterName, Value: value, Type: "SecureString", Overwrite: true }));
  }
}
