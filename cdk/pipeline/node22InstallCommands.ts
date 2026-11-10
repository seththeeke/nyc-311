/*
 * Every step that builds, tests or diffs repo code runs Node 22, matching the
 * Lambdas' NODEJS_22_X and Vitest 5's engine (#167). Not `runtime-versions`:
 * it copies standard:7.0's cached 22, 51s on a cold host (#179). An empty
 * N_CACHE_PREFIX makes `n` download it fresh (~21s). The grep fails the step
 * if node is not 22. SelfMutate and FileAssets skip it (#209): they run only
 * aws-cdk/cdk-assets, on the image's default Node 24.
 */
export const NODE_22_INSTALL_COMMANDS = [
  'N_CACHE_PREFIX="$(mktemp -d)" n "$NODE_22_VERSION"',
  "node --version | grep -E '^v22[.]'",
];
