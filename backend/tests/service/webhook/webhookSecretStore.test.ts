import { GetParameterCommand, PutParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalError } from "../../../models/errors";
import { WebhookSecretStore } from "../../../service/webhook/webhookSecretStore";

const ssmMock = mockClient(SSMClient);
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  ssmMock.reset();
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("WebhookSecretStore", () => {
  it("reads a decrypted SecureString", async () => {
    ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: "whsec_value" } });
    await expect(new WebhookSecretStore().getSecret("/nyc311/test/webhook/registration-key")).resolves.toBe("whsec_value");
    expect(ssmMock.commandCalls(GetParameterCommand)[0].args[0].input).toEqual({
      Name: "/nyc311/test/webhook/registration-key",
      WithDecryption: true,
    });
  });

  it("throws TerminalError for a parameter with no value", async () => {
    ssmMock.on(GetParameterCommand).resolves({});
    await expect(new WebhookSecretStore().getSecret("/missing")).rejects.toBeInstanceOf(TerminalError);
  });

  it("writes an overwriting SecureString and never logs the value", async () => {
    ssmMock.on(PutParameterCommand).resolves({});
    await new WebhookSecretStore(new SSMClient({})).putSecret("/nyc311/test/webhook/01SUB/secret", "whsec_topsecret");
    expect(ssmMock.commandCalls(PutParameterCommand)[0].args[0].input).toEqual({
      Name: "/nyc311/test/webhook/01SUB/secret",
      Value: "whsec_topsecret",
      Type: "SecureString",
      Overwrite: true,
    });
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain("whsec_topsecret");
  });
});
