export type Pace = "slow" | "balanced" | "packed";
export type Spend = "budget" | "mid-range" | "luxury";
export type Crowds = "avoid" | "neutral" | "love";

export type QuizAnswers = {
  pace: Pace;
  spend: Spend;
  crowds: Crowds;
  interests: string[];
  food: "vegetarian" | "non-vegetarian" | "anything";
};

export type QuizResult = {
  typeName: string;
  travelStyle: string;
  interests: string[];
  foodPreference: string | null;
};

export const QUIZ_INTEREST_OPTIONS = [
  "beaches", "photography", "local food", "trekking", "history", "culture",
  "adventure", "wildlife", "nightlife", "relaxation", "shopping", "museums",
] as const;

export const MAX_QUIZ_INTERESTS = 3;

export const QUIZ_QUESTIONS = [
  {
    key: "pace",
    title: "How do you like your days?",
    options: [
      { value: "slow", label: "Slow and spontaneous — one or two things a day" },
      { value: "balanced", label: "A mix — a plan, with room to wander" },
      { value: "packed", label: "Packed — I want to see everything" },
    ],
  },
  {
    key: "spend",
    title: "What's your spending style?",
    options: [
      { value: "budget", label: "Budget — hostels, street food, local buses" },
      { value: "mid-range", label: "Mid-range — comfortable, good value" },
      { value: "luxury", label: "Luxury — treat myself" },
    ],
  },
  {
    key: "crowds",
    title: "How do you feel about crowds?",
    options: [
      { value: "avoid", label: "Avoid them — give me quiet places" },
      { value: "neutral", label: "Don't mind either way" },
      { value: "love", label: "Love the buzz and the energy" },
    ],
  },
  {
    key: "food",
    title: "What do you eat?",
    options: [
      { value: "vegetarian", label: "Vegetarian" },
      { value: "non-vegetarian", label: "Non-vegetarian" },
      { value: "anything", label: "Anything goes" },
    ],
  },
] as const;

const TYPE_NAMES: Record<Pace, Record<Crowds, string>> = {
  slow: { avoid: "Slow Wanderer", neutral: "Easygoing Drifter", love: "Lively Lounger" },
  balanced: { avoid: "Quiet Explorer", neutral: "Balanced Traveler", love: "Social Explorer" },
  packed: { avoid: "Trail Hunter", neutral: "Go-Getter", love: "City Sprinter" },
};

export function scoreQuiz(answers: QuizAnswers, existingInterests: string[] = []): QuizResult {
  const typeName = TYPE_NAMES[answers.pace][answers.crowds];
  const parts = [answers.spend, `${answers.pace} pace`];
  if (answers.crowds === "avoid") parts.push("avoids crowds");
  if (answers.crowds === "love") parts.push("enjoys lively places");

  const interests = Array.from(new Set([...answers.interests.slice(0, MAX_QUIZ_INTERESTS), ...existingInterests])).slice(0, 20);

  return {
    typeName,
    travelStyle: `${typeName} — ${parts.join(", ")}`,
    interests,
    foodPreference: answers.food === "anything" ? null : answers.food,
  };
}
