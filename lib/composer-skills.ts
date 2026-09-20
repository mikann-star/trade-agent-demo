import { expertCatalog, type ExpertSkill } from "./expert-catalog";

export type ComposerSkillOption = ExpertSkill & {
  key: string;
  expertId: string;
  expertName: string;
  expertLabel: string;
};

const expertLabels: Record<string, string> = {
  merchant: "商家专家",
  product: "商品专家",
  acquisition: "招商专家",
  campaign: "营销活动专家",
  project: "项目管理专家",
};

export const composerSkillOptions: ComposerSkillOption[] = expertCatalog.flatMap(
  (expert) =>
    expert.skills.map((skill) => ({
      ...skill,
      key: `${expert.id}:${skill.id}`,
      expertId: expert.id,
      expertName: expert.name,
      expertLabel: expertLabels[expert.id] ?? expert.name,
    })),
);

export type SkillTrigger = {
  start: number;
  end: number;
  query: string;
};

export function getSkillTrigger(
  input: string,
  caretPosition = input.length,
): SkillTrigger | null {
  const prefix = input.slice(0, caretPosition);
  const match = prefix.match(/(?:^|\s)\/([^\s/]*)$/u);
  if (!match) return null;

  const start = prefix.lastIndexOf("/");
  return {
    start,
    end: caretPosition,
    query: match[1].trim(),
  };
}

export function filterComposerSkills(
  query: string,
  options = composerSkillOptions,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return options;

  return options.filter((skill) =>
    [skill.name, skill.description].some((value) =>
      value.toLocaleLowerCase().includes(normalizedQuery),
    ),
  );
}

export function removeSkillTrigger(input: string, trigger: SkillTrigger) {
  const before = input.slice(0, trigger.start);
  const after = input.slice(trigger.end);
  return `${before}${after}`.replace(/\s{2,}/g, " ").trimStart();
}

export function buildPromptWithSkills(
  input: string,
  selectedSkills: ComposerSkillOption[],
) {
  const prompt = input.trim();
  if (!selectedSkills.length) return prompt;

  const skillNames = selectedSkills.map((skill) => `「${skill.name}」`).join("、");
  return `使用技能 ${skillNames}${prompt ? `：${prompt}` : ""}`;
}
