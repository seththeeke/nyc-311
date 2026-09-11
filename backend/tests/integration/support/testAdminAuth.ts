import { execFileSync } from "node:child_process";
import { lookupStackOutput } from "./cfnOutputs";

/**
 * Signs in as the dedicated test-admin Cognito user
 * (`test-scripts/6-setup-test-admin.py`, `9-admin-auth-integration.md`
 * §8) and returns an ID token for `GET /admin/whoami`. `test`/`prod`
 * targets only — `sam local start-api` doesn't enforce the JWT
 * authorizer at all, so there's no meaningful token to fetch for `local`
 * (the calling test file skips itself for that target instead).
 */

const AWS_PROFILE = "nyc311";

const STACK_NAME_BY_TARGET = { test: "Nyc311-Test", prod: "Nyc311-Prod" } as const;
const SECRET_NAME_BY_TARGET = {
  test: "Nyc311AdminTestCredential-Test",
  prod: "Nyc311AdminTestCredential-Prod",
} as const;

type RealTarget = keyof typeof STACK_NAME_BY_TARGET;

interface TestAdminCredential {
  email: string;
  password: string;
}

function currentRealTarget(): RealTarget {
  const target = process.env.INTEGRATION_TARGET;
  if (target !== "test" && target !== "prod") {
    throw new Error(
      `getTestAdminIdToken() requires INTEGRATION_TARGET=test|prod (real Cognito pools only) — got ${JSON.stringify(target)}`
    );
  }
  return target;
}

/*
 * The pipeline's CodeBuild role has ambient credentials via its own IAM
 * grant (Nyc311IntegrationTestStep) and no "nyc311" profile configured; a
 * local/manual run needs the explicit profile instead — same distinction
 * every other AWS CLI call this suite/its scripts make has to draw.
 */
function awsArgs(args: string[]): string[] {
  return process.env.CODEBUILD_BUILD_ID ? args : [...args, "--profile", AWS_PROFILE];
}

function resolveUserPoolClientId(target: RealTarget): string {
  if (process.env.USER_POOL_CLIENT_ID) return process.env.USER_POOL_CLIENT_ID;
  return lookupStackOutput(STACK_NAME_BY_TARGET[target], "Nyc311AdminUserPoolClientId");
}

function fetchTestAdminCredential(target: RealTarget): TestAdminCredential {
  const output = execFileSync(
    "aws",
    awsArgs(["secretsmanager", "get-secret-value", "--secret-id", SECRET_NAME_BY_TARGET[target], "--output", "json"]),
    { encoding: "utf8" }
  );
  const secretString = JSON.parse(output).SecretString as string;
  return JSON.parse(secretString) as TestAdminCredential;
}

let cachedIdToken: string | undefined;

/** Lazily resolved and memoized — importing this module never itself triggers a network/CLI call. */
export async function getTestAdminIdToken(): Promise<string> {
  if (cachedIdToken) return cachedIdToken;

  const target = currentRealTarget();
  const clientId = resolveUserPoolClientId(target);
  const { email, password } = fetchTestAdminCredential(target);

  /*
   * Shorthand `--auth-parameters` syntax (comma-separated key=value) is
   * safe here specifically because test-scripts/6-setup-test-admin.py's
   * generated password never contains "," or "=" — a real arbitrary
   * password would need --cli-input-json instead.
   */
  const output = execFileSync(
    "aws",
    awsArgs([
      "cognito-idp",
      "initiate-auth",
      "--client-id",
      clientId,
      "--auth-flow",
      "USER_PASSWORD_AUTH",
      "--auth-parameters",
      `USERNAME=${email},PASSWORD=${password}`,
      "--output",
      "json",
    ]),
    { encoding: "utf8" }
  );
  const idToken = JSON.parse(output).AuthenticationResult?.IdToken as string | undefined;
  if (!idToken) {
    throw new Error("cognito-idp initiate-auth did not return an IdToken");
  }
  cachedIdToken = idToken;
  return cachedIdToken;
}
