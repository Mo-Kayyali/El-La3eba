export const FOOTBALL_QUESTIONS = [
  'Name a football player who played in 2026',
  'Name a player who has won the Champions League',
  'Name a player who has played in the Premier League',
  'Name a player who has won the World Cup',
  'Name a player who has won the Ballon d’Or',
  'Name a player who has played for Barcelona',
  'Name a player who has played for Real Madrid',
] as const;

export function pickRandomFootballQuestion() {
  return FOOTBALL_QUESTIONS[
    Math.floor(Math.random() * FOOTBALL_QUESTIONS.length)
  ];
}
