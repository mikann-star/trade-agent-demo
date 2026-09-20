"use client";

import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { AcquisitionGuide } from "@/components/acquisition-guide";
import { MarketingGuide } from "@/components/marketing-guide";
import { acquisitionGuide } from "@/lib/acquisition-guide";
import { marketingGuide } from "@/lib/marketing-guide";
import {
  getSceneStats,
  sceneCatalog,
  type AgentSkillDefinition,
  type SceneDefinition,
  type SubAgentDefinition,
} from "@/lib/agent-skill-catalog";

type AgentSelection = "all" | string;
type SkillSort = "hot" | "latest";

export function ExpertSkillWorkspace({
  initialSceneId = sceneCatalog[0].id,
  onUseSkill,
}: {
  initialSceneId?: SceneDefinition["id"];
  onUseSkill: (
    agent: SubAgentDefinition,
    skill: AgentSkillDefinition,
  ) => void;
}) {
  const [selectedSceneId, setSelectedSceneId] = useState(initialSceneId);
  const [selectedAgentId, setSelectedAgentId] =
    useState<AgentSelection>("all");
  const [skillSort, setSkillSort] = useState<SkillSort>("hot");

  const selectedScene = useMemo(
    () =>
      sceneCatalog.find((scene) => scene.id === selectedSceneId) ??
      sceneCatalog[0],
    [selectedSceneId],
  );
  const selectedAgent = useMemo(
    () =>
      selectedAgentId === "all"
        ? null
        : (selectedScene.agents.find(
            (agent) => agent.id === selectedAgentId,
          ) ?? null),
    [selectedAgentId, selectedScene],
  );
  const visibleSkills = selectedAgent
    ? selectedAgent.skills.map((skill) => ({ agent: selectedAgent, skill }))
    : selectedScene.agents.flatMap((agent) =>
        agent.skills.map((skill) => ({ agent, skill })),
      );
  const selectedSceneStats = getSceneStats(selectedScene);
  const selectedSceneComingSoon = selectedScene.status === "coming-soon";
  const selectedSkillCount = selectedAgent
    ? selectedAgent.skills.length
    : selectedSceneStats.skillCount;
  const orderedSkills = visibleSkills;

  const selectScene = (sceneId: (typeof sceneCatalog)[number]["id"]) => {
    setSelectedSceneId(sceneId);
    setSelectedAgentId("all");
    setSkillSort("hot");
  };

  return (
    <div className="expert-workspace">
      <h1>场景</h1>

      <ul
        aria-label="业务场景"
        className="scene-grid"
      >
        {sceneCatalog.map((scene) => {
          const selected = scene.id === selectedScene.id;
          const isAcquisition = scene.id === acquisitionGuide.sceneId;
          const isMarketing = scene.id === marketingGuide.sceneId;
          const stats = getSceneStats(scene);
          return (
            <li key={scene.id}>
              <button
                aria-pressed={selected}
                className={`scene-card ${selected ? "selected" : ""} ${isAcquisition ? "scene-card-acquisition" : isMarketing ? "scene-card-marketing" : ""}`}
                data-testid={`scene-card-${scene.id}`}
                onClick={() => selectScene(scene.id)}
                type="button"
              >
                <span className="scene-card-heading">
                  <strong>{scene.name}</strong>
                  {isAcquisition ? (
                    <span className="scene-external-label">需配合 DewuClaw 使用</span>
                  ) : isMarketing ? (
                    <span className="scene-external-label">{marketingGuide.sceneLabel}</span>
                  ) : scene.status === "coming-soon" ? (
                    <span className="scene-coming-soon-label">即将接入</span>
                  ) : null}
                </span>
                <span className="scene-stat-line">
                  {isAcquisition
                    ? `${acquisitionGuide.capabilities.length} 类能力`
                    : isMarketing
                    ? `${marketingGuide.capabilities.length} 类能力`
                    : `${stats.expertCount} 个专家 · ${stats.skillCount} 项技能`}
                </span>
                {selected ? (
                  <span className="selection-check" aria-hidden="true">
                    <Check size={12} strokeWidth={2.4} />
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {selectedScene.id === acquisitionGuide.sceneId ? (
        <AcquisitionGuide />
      ) : selectedScene.id === marketingGuide.sceneId ? (
        <MarketingGuide />
      ) : (
        <>
          <div className="expert-directory-heading">
            <h2>专家</h2>
            <span>{selectedSceneStats.expertCount} 个</span>
          </div>
          <section className="agent-skill-directory" aria-live="polite">
            <div
              aria-label={`${selectedScene.name}专家筛选`}
              className="agent-filter-tabs"
              role="tablist"
            >
                <button
                  aria-selected={selectedAgentId === "all"}
                  className={selectedAgentId === "all" ? "selected" : ""}
                  onClick={() => setSelectedAgentId("all")}
                  role="tab"
                  type="button"
                >
                  全部
                </button>
                {selectedScene.agents.map((agent) => (
                  <button
                    aria-selected={selectedAgentId === agent.id}
                    className={selectedAgentId === agent.id ? "selected" : ""}
                    key={agent.id}
                    onClick={() => setSelectedAgentId(agent.id)}
                    role="tab"
                    type="button"
                  >
                    {agent.name}
                  </button>
                ))}
            </div>

            <div className="agent-introduction">
                <div className="agent-introduction-copy">
                  <strong>{selectedAgent?.name ?? `${selectedScene.name}场景`}</strong>
                  <p>
                    {selectedAgent?.description ??
                      `汇总 ${selectedSceneStats.expertCount} 个专家与 ${selectedSceneStats.skillCount} 项技能，可按专家进一步筛选。`}
                  </p>
                </div>
            </div>

            <div className="skill-directory-heading">
                <h3>技能</h3>
                <span>{selectedSkillCount} 项</span>
                <div
                  aria-label="技能排序"
                  className="skill-sort-tabs"
                  role="tablist"
                >
                  <button
                    aria-selected={skillSort === "hot"}
                    className={skillSort === "hot" ? "selected" : ""}
                    onClick={() => setSkillSort("hot")}
                    role="tab"
                    type="button"
                  >
                    最热
                  </button>
                  <button
                    aria-selected={skillSort === "latest"}
                    className={skillSort === "latest" ? "selected" : ""}
                    onClick={() => setSkillSort("latest")}
                    role="tab"
                    type="button"
                  >
                    最新
                  </button>
                </div>
              </div>

            {orderedSkills.length === 0 ? (
                <div className="agent-empty-state">
                  <strong>技能建设中，敬请期待</strong>
                </div>
              ) : (
                <ul
                  aria-label={
                    selectedAgent
                      ? `${selectedAgent.name}技能`
                      : `${selectedScene.name}全部技能`
                  }
                  className={`skill-grid ${selectedAgent ? "" : "all-skills-grid"}`}
                >
                  {orderedSkills.map(({ agent, skill }) => {
                    const comingSoon =
                      selectedSceneComingSoon ||
                      skill.availability === "coming-soon";
                    return (
                      <li key={skill.mountKey}>
                        <article
                          aria-label={
                            comingSoon
                              ? `${skill.name}，即将接入，敬请期待`
                              : undefined
                          }
                          aria-disabled={comingSoon || undefined}
                          className={`skill-card ${comingSoon ? "coming-soon" : ""}`}
                          role={comingSoon ? "group" : undefined}
                        >
                          <div className="skill-card-title-row">
                            <strong>{skill.name}</strong>
                            <span
                              aria-label={`所属专家：${agent.name}`}
                              className="skill-agent-tag"
                              title={agent.name}
                            >
                              {agent.name}
                            </span>
                          </div>
                          <span className="skill-description">
                            {skill.description}
                          </span>
                          {comingSoon ? (
                            <div className="skill-coming-soon-overlay">
                              <span>即将接入，敬请期待</span>
                            </div>
                          ) : (
                            <div className="skill-use-overlay">
                              <p>{skill.standardQuestion}</p>
                              <button
                                aria-label={`使用技能：${skill.name}`}
                                onClick={() => onUseSkill(agent, skill)}
                                type="button"
                              >
                                使用该技能
                              </button>
                            </div>
                          )}
                        </article>
                      </li>
                    );
                  })}
                </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
