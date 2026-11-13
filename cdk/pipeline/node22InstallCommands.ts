/*
 * Every step that builds, tests or diffs repo code runs Node 22, matching the
 * Lambdas' NODEJS_22_X and Vitest 5's engine (#167). Not `runtime-versions`:
 * it copies standard:7.0's cached 22, 51s on a cold host (#179). An empty
 * N_CACHE_PREFIX makes `n` download it fresh (~21s). The grep fails the step
 * if node is not 22. SelfMutate and FileAssets (#209), BrowserSmokeTests
 * (#215) and PublishCoverage (#222) skip it: they run only aws-cdk,
 * cdk-assets, Playwright or istanbul, on the image's Node 24.
 */
export const NODE_22_INSTALL_COMMANDS = [
  'N_CACHE_PREFIX="$(mktemp -d)" n "$NODE_22_VERSION"',
  "node --version | grep -E '^v22[.]'",
];

/*
 * For steps on the image's default Node: logs the version and fails the
 * step if a future image default drops below 20.
 */
export const IMAGE_NODE_FLOOR_CHECK = "node --version | grep -E '^v(2[0-9]|[3-9][0-9])[.]'";
