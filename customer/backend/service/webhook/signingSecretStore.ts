import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { logInfo } from "../../logger";
import { TerminalError } from "../../models/errors";

/**
 * Reads the customer's webhook signing secret from SSM Parameter Store —
 * a SecureString created by hand at launch
 * (docs/13-customer-simulation.md Appendix I). Read-only, and logs the
 * parameter name only, never the value.
 */
export class SigningSecretStore {
  constructor(private readonly client: SSMClient = new SSMClient({})) {}

  /** @throws {@link TerminalError} if the parameter has no value. */
  async getSecret(parameterName: string): Promise<string> {
    logInfo("SigningSecretStore.getSecret", { parameterName });
    const result = await this.client.send(new GetParameterCommand({ Name: parameterName, WithDecryption: true }));
    const value = result.Parameter?.Value;
    if (!value) {
      throw new TerminalError(`SSM parameter ${parameterName} has no value`);
    }
    return value;
  }
}
