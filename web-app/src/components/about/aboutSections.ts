export type AboutSectionStatus = "BUILT" | "IN_PROGRESS";

export interface AboutSection {
  id: string;
  title: string;
  /** One-liner shown under the collapsed header — where this piece is used. */
  summary: string;
  /** `IN_PROGRESS` sections show a "Work In Progress" badge and construction icon. */
  status: AboutSectionStatus;
  /** Paragraphs in order; `null` for a section with nothing to say yet. */
  body: string[] | null;
  /** Concepts and technologies, shown as a row of tags under the body. */
  tags: string[];
}

/* Always shown, un-collapsed, directly under the title. */
export const ABOUT_OVERVIEW: string[] = [
  "BoroughSim ingests real NYC 311 street-condition requests and simulates the business of resolving them: planning, scheduling, dispatching crews, handling failures, and tracking cost. It is a portfolio project that builds the software a real field-service company would run.",
];

/*
 * Proof-of-concept copy — edit here, the overlay renders whatever is in this
 * list of expandable sections, in this order (roughly the path of a request
 * through the system, then the practices around it).
 */
export const ABOUT_SECTIONS: AboutSection[] = [
  {
    id: "data-ingestion",
    title: "Data Ingestion",
    summary: "Feeds real NYC 311 requests into the system.",
    status: "BUILT",
    body: [
      "EventBridge Scheduler triggers a poller Lambda that pulls new records from the NYC Open Data (SODA) API, tracking its place with a cursor in DynamoDB. Requests are deduplicated and stored, then fanned out through DynamoDB Streams and SQS into order creation. Only Street Condition requests go on to become orders.",
    ],
    tags: ["EventBridge Scheduler", "Lambda", "SODA API", "DynamoDB Streams", "SQS", "Idempotent ingestion"],
  },
  {
    id: "simulation",
    title: "Simulation & Domain Modeling",
    summary: "Turns each request into an order that is evaluated, scheduled, and worked.",
    status: "BUILT",
    body: [
      "Each accepted request becomes an order that moves through evaluation, scheduling, and simulated execution. Evaluation reacts to events; scheduling is a periodic job that ranks the whole waiting queue by priority and SLA and assigns work to a fleet of operators with a cost model and estimated travel and processing times.",
    ],
    tags: ["Event sourcing", "Priority scheduling", "Capacity modeling", "Cost modeling", "Domain modeling"],
  },
  {
    id: "reliability",
    title: "Reliability & Failure Handling",
    summary: "Keeps the order pipeline running when individual steps fail.",
    status: "BUILT",
    body: [
      "Errors are typed as transient or terminal so retry and escalation decisions can follow the error type. The fan-out queues have dead-letter queues, and alarms watch the order pipeline.",
    ],
    tags: ["Typed errors", "SQS", "Dead-letter queues", "CloudWatch Alarms", "Retries"],
  },
  {
    id: "web-services",
    title: "Web Services",
    summary: "Powers the public API and the admin routes.",
    status: "BUILT",
    body: [
      "A public HTTP API on API Gateway fronts TypeScript Lambda functions, layered controller, service, and DAO. Every incoming payload is validated at the boundary, and state lives in DynamoDB, with orders, cases, and operators stored as event streams.",
    ],
    tags: ["API Gateway", "Lambda", "TypeScript", "DynamoDB", "zod", "Layered architecture"],
  },
  {
    id: "data-warehouse",
    title: "Data Warehouse",
    summary: "Backs the Data page and the admin SQL console.",
    status: "BUILT",
    body: [
      "Order and request events land in S3 through Kinesis Firehose and are cataloged in Glue. Athena runs scheduled and ad-hoc SQL against them, with each job's results stored in S3. The Data page exposes the live schema.",
    ],
    tags: ["S3", "Kinesis Firehose", "Glue", "Athena", "SQL"],
  },
  { id: "machine-learning", title: "Machine Learning", summary: "Not built yet.", status: "IN_PROGRESS", body: null, tags: [] },
  { id: "llms", title: "LLMs", summary: "Not built yet.", status: "IN_PROGRESS", body: null, tags: [] },
  {
    id: "testing",
    title: "Testing & Quality",
    summary: "Gates every change before it ships.",
    status: "BUILT",
    body: [
      "Every package enforces a 90% per-file coverage gate, and lint rules enforce conventions such as no `any` and a fixed comment format. CDK assertion tests check each construct, and integration tests against the live Test environment gate promotion to Prod.",
    ],
    tags: ["Vitest", "React Testing Library", "CDK assertions", "Integration tests", "ESLint"],
  },
  {
    id: "infrastructure",
    title: "Infrastructure & CI/CD",
    summary: "Builds, tests, and deploys every environment.",
    status: "BUILT",
    body: [
      "Everything is defined in AWS CDK (TypeScript) as one stack deployed per environment, Test and Prod. A self-mutating CodePipeline builds, tests, deploys to Test, runs integration tests against it, and only then promotes to Prod.",
    ],
    tags: ["AWS CDK", "CodePipeline", "CloudFormation", "Multi-environment", "Infrastructure as code"],
  },
  {
    id: "observability",
    title: "Observability",
    summary: "Shows what the system is doing, live and after the fact.",
    status: "BUILT",
    body: [
      "Every layer logs structured JSON, and CloudWatch metric filters turn those logs into metrics and alarms. Public monitoring pages show ingestion health, Lambda health, pipeline status, and integration test results.",
    ],
    tags: ["CloudWatch", "Structured logging", "Metric filters", "Alarms", "Dashboards"],
  },
  {
    id: "security",
    title: "Security & Auth",
    summary: "Separates the public site from the admin tier.",
    status: "BUILT",
    body: [
      "A single-admin Cognito user pool signs in the admin, and an HTTP API JWT authorizer protects the mutating routes. On the frontend, one route guard per visibility tier decides what is public and what needs a login.",
    ],
    tags: ["Cognito", "JWT", "API Gateway authorizer", "Route guards"],
  },
  {
    id: "ai-assisted-development",
    title: "AI-Assisted Development",
    summary: "How the project itself is built.",
    status: "BUILT",
    body: [
      "The project is built with Claude Code, using project instructions that lock down structure and conventions, custom agents for query drafting and developer-experience work, hooks, and skills that automate the ship loop. Agents run in isolated git worktrees so several can work in parallel.",
    ],
    tags: ["Claude Code", "Custom agents", "Hooks", "Skills", "Git worktrees"],
  },
  {
    id: "frontend",
    title: "Frontend",
    summary: "The site you're looking at.",
    status: "BUILT",
    body: [
      "A React and Vite single-page app in TypeScript, using TanStack Query for data fetching, Tailwind for styling, and zod to validate every API response. It can run entirely in memory against mock data, and is served from S3 and CloudFront.",
    ],
    tags: ["React", "Vite", "TypeScript", "TanStack Query", "Tailwind", "Leaflet"],
  },
];
