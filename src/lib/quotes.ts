// 30 Motivational Quotes provided by user
export const MOTIVATIONAL_QUOTES = [
  "Your laziness is stealing the future you deserve.",
  "The life you dream about is hidden behind the work you avoid.",
  "Comfort today can become regret tomorrow.",
  "Every excuse delays the life you dream about.",
  "You don't lose your future in one day. You lose it one lazy day at a time.",
  "Your future self is watching the choices you make today.",
  "One hour wasted today is one less hour for your dreams.",
  "Every \"I'll do it later\" becomes an \"I wish I had started sooner.\"",
  "Your dreams are expensive. Laziness is charging interest.",
  "The future rewards those who respect today.",
  "Discipline hurts for a moment. Regret hurts for years.",
  "Small steps every day build big success.",
  "Great things are built one ordinary day at a time.",
  "Success is built in the hours nobody sees.",
  "Your habits decide your future before your results do.",
  "Every small effort counts.",
  "Keep showing up. The results will follow.",
  "Consistency beats motivation.",
  "Finish what you started.",
  "The hardest part is starting. The next step is easier.",
  "Time never comes back. Spend it wisely.",
  "Every minute matters.",
  "The clock never waits for anyone.",
  "Respect your time, and others will respect it too.",
  "Someone is working for the life you are dreaming about.",
  "Every day is another chance to become the person you want to be.",
  "Dreams don't work unless you do.",
  "Don't count the days. Make the days count.",
  "Success begins with today's choices.",
  "Control your laziness to understand how much success you are avoiding by giving up."
];

/**
 * Returns a single quote deterministically based on today's date (yyyy-MM-dd).
 * Rotates each day across the 30 quotes.
 */
export function getDailyQuote(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  // Simple deterministic hash based on date integers
  const dateHash = (year * 365) + (month * 31) + day;
  const quoteIndex = dateHash % MOTIVATIONAL_QUOTES.length;

  return MOTIVATIONAL_QUOTES[quoteIndex];
}
