import {
  composerSkillOptions,
  type ComposerSkillOption,
} from "./composer-skills";

export type QuestionSuggestion = {
  id: string;
  question: string;
  skillName: string;
  expertLabel: string;
};

export type QuestionSuggestionSource = Pick<
  ComposerSkillOption,
  "key" | "name" | "description" | "standardQuestion" | "expertLabel"
>;

const normalize = (value: string) =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[\s，。？！、：；,.!?;:（）()【】[\]{}'"“”‘’\-_/]/gu, "");

const getBigrams = (value: string) => {
  const characters = Array.from(value);
  if (characters.length < 2) return [];
  return Array.from(
    new Set(characters.slice(0, -1).map((character, index) =>
      `${character}${characters[index + 1]}`,
    )),
  );
};

export function getQuestionSuggestions(
  rawQuery: string,
  sources: QuestionSuggestionSource[] = composerSkillOptions,
  limit = 5,
): QuestionSuggestion[] {
  const query = normalize(rawQuery);
  if (Array.from(query).length < 2 || limit <= 0) return [];

  const queryBigrams = getBigrams(query);
  const ranked = sources.flatMap((source, index) => {
    const name = normalize(source.name);
    const question = normalize(source.standardQuestion);
    const description = normalize(source.description);
    if (question === query) return [];

    const titleMatch = name.includes(query);
    const questionMatch = question.includes(query);
    const descriptionMatch = description.includes(query);
    const searchText = `${name}${question}${description}`;
    const matchingBigrams = queryBigrams.filter((bigram) =>
      searchText.includes(bigram),
    ).length;
    const keywordScore = queryBigrams.length
      ? matchingBigrams / queryBigrams.length
      : 0;

    const tier = titleMatch ? 3 : questionMatch ? 2 : descriptionMatch ? 1 : 0;
    if (!tier && keywordScore === 0) return [];

    const matchScore =
      (name.startsWith(query) ? 30 : 0) +
      (question.startsWith(query) ? 20 : 0) +
      keywordScore * 10;

    return [{ source, index, tier, matchScore }];
  });

  ranked.sort(
    (left, right) =>
      right.tier - left.tier ||
      right.matchScore - left.matchScore ||
      left.index - right.index,
  );

  const seenQuestions = new Set<string>();
  const suggestions: QuestionSuggestion[] = [];
  for (const { source } of ranked) {
    const normalizedQuestion = normalize(source.standardQuestion);
    if (seenQuestions.has(normalizedQuestion)) continue;
    seenQuestions.add(normalizedQuestion);
    suggestions.push({
      id: source.key,
      question: source.standardQuestion,
      skillName: source.name,
      expertLabel: source.expertLabel,
    });
    if (suggestions.length === limit) break;
  }

  return suggestions;
}
