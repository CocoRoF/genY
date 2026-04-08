export const GREETINGS = [
  'Hey!', 'Morning!', 'Hi there!', "What's up?",
  "How's it going?", 'Good to see you.', 'Oh, hi!'
];

export const GREETING_REPLIES = [
  'Hey! Good to see you.', 'Morning!', 'Hi!',
  'Going alright — you?', 'All good here.',
  'Not bad, thanks.', "Hey, how've you been?"
];

export const WORK_OPENERS = [
  "How's the deploy?", 'Pipeline green?', 'Did you see the PR?',
  'Need any help?', 'Got a sec for a review?',
  "How's the task going?", 'Any blockers?', "What's on your plate?"
];

export const WORK_REPLIES = [
  'Shipping it shortly.', 'Tests are green.', 'Stuck on one edge case.',
  'Yeah, merging soon.', 'Almost there.',
  "I'll take a look after this.", 'Nothing urgent — thanks!',
  'Will ping you later.'
];

export const CASUAL_OPENERS = [
  'Coffee?', 'Lunch?', 'Break time?', "Walkin' to the lounge.",
  'Need fresh air.', 'Thinking of taking five.', 'Heading to the plaza.'
];

export const CASUAL_REPLIES = [
  'Sure, I could use one.', 'Give me five minutes.',
  "Go ahead, I'll catch up.", 'Same, need a reset.',
  "In a bit — finishing this.", "I'll join you."
];

function hashToInt(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(pool: T[], rng: () => number): T {
  return pool[Math.floor(rng() * pool.length)];
}

export function buildConversation(rng: () => number = Math.random): string[] {
  const isLong = rng() < 0.4;
  const lines = [pick(GREETINGS, rng), pick(GREETING_REPLIES, rng)];
  if (isLong) {
    if (rng() < 0.55) {
      lines.push(pick(WORK_OPENERS, rng), pick(WORK_REPLIES, rng));
    } else {
      lines.push(pick(CASUAL_OPENERS, rng), pick(CASUAL_REPLIES, rng));
    }
  }
  return lines;
}

export const DIALOGUE_LINES = [
  ...GREETINGS, ...GREETING_REPLIES,
  ...WORK_OPENERS, ...WORK_REPLIES,
  ...CASUAL_OPENERS, ...CASUAL_REPLIES
];

export function pickDialogue(seed = '', timeBucket = 0): string {
  const h = hashToInt(`${seed}:${timeBucket}`);
  return DIALOGUE_LINES[h % DIALOGUE_LINES.length];
}
