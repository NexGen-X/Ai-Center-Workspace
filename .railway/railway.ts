import { defineRailway, github, project, service } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "ai-agent-command-center";
export default defineRailway(() => {
  const aiAgentCommandCenter = service("ai-agent-command-center", {
    source: github("NexGen-X/Ai-Center-Workspace", { branch: "main" }),
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    healthcheck: "/healthz",
    healthcheckTimeout: 100,
    replicas: { "asia-southeast1-eqsg3a": 1 },
    domains: ["app.id-tech.cloud"],
    cdn: { enabled: true },
  });

  return project("ai-agent-command-center", {
    variables: { managed: false },
    resources: [aiAgentCommandCenter],
  });
});
