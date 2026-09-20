import catalogSnapshot from "./agent-skill-catalog.snapshot.json";

export type AgentSkillDefinition = {
  id: string;
  mountKey: string;
  name: string;
  description: string;
  standardQuestion: string;
  availability?: "available" | "coming-soon";
};

export type SubAgentDefinition = {
  id: string;
  originalName: string;
  name: string;
  description: string;
  standardQuestion: string;
  skills: AgentSkillDefinition[];
};

export type SceneDefinition = {
  id: "merchant" | "campaign" | "project" | "product" | "acquisition";
  name: string;
  status: "available" | "coming-soon";
  agents: SubAgentDefinition[];
};

type CatalogSnapshot = {
  source: {
    sheet: string;
    range: string;
    revision: number;
    rawSkillMountCount: number;
    excludedMissingQuestionCount: number;
    visibleSkillMountCount: number;
  };
  scenes: SceneDefinition[];
};

const catalog = catalogSnapshot as CatalogSnapshot;

export const agentSkillCatalogSource = catalog.source;
export const sceneCatalog: SceneDefinition[] = catalog.scenes;

export const merchantOperationAgents: SubAgentDefinition[] =
  sceneCatalog.find((scene) => scene.id === "merchant")?.agents ?? [];

function findAgent(agentId: string): SubAgentDefinition | undefined {
  return sceneCatalog
    .flatMap((scene) => scene.agents)
    .find((agent) => agent.id === agentId);
}

export const quickComposerExperts: SubAgentDefinition[] = [
  findAgent("merchant-operation-agent"),
  findAgent("promo-activity-helper"),
  findAgent("refunds-mrd-create"),
  findAgent("commodity-operation-agent"),
].filter((agent): agent is SubAgentDefinition => Boolean(agent));

export function getSceneStats(scene: SceneDefinition) {
  return {
    expertCount: scene.agents.length,
    skillCount: scene.agents.reduce(
      (total, agent) => total + agent.skills.length,
      0,
    ),
  };
}
