"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FOOTBALL_QUESTIONS = void 0;
exports.pickRandomFootballQuestion = pickRandomFootballQuestion;
exports.FOOTBALL_QUESTIONS = [
    'Name a football player who played in 2026',
    'Name a player who has won the Champions League',
    'Name a player who has played in the Premier League',
    'Name a player who has won the World Cup',
    'Name a player who has won the Ballon d’Or',
    'Name a player who has played for Barcelona',
    'Name a player who has played for Real Madrid',
];
function pickRandomFootballQuestion() {
    return exports.FOOTBALL_QUESTIONS[Math.floor(Math.random() * exports.FOOTBALL_QUESTIONS.length)];
}
//# sourceMappingURL=game.questions.js.map