import crypto from 'crypto';

const ADJECTIVES = [
  'brave', 'bright', 'calm', 'clever', 'cool',
  'crisp', 'daring', 'eager', 'fair', 'fast',
  'fierce', 'gentle', 'glad', 'golden', 'happy',
  'keen', 'kind', 'lively', 'lucky', 'merry',
  'mighty', 'noble', 'proud', 'quick', 'quiet',
  'rapid', 'sharp', 'smooth', 'steady', 'strong',
  'sunny', 'swift', 'tall', 'tender', 'vivid',
  'warm', 'wild', 'wise', 'witty', 'zesty',
];

const NOUNS = [
  'badger', 'bear', 'bison', 'bunny', 'coral',
  'crane', 'deer', 'dolphin', 'dove', 'eagle',
  'falcon', 'finch', 'fox', 'hawk', 'heron',
  'horse', 'kite', 'lark', 'lemur', 'lion',
  'maple', 'otter', 'owl', 'panda', 'parrot',
  'pearl', 'puma', 'quail', 'raven', 'robin',
  'sage', 'seal', 'spark', 'swan', 'tiger',
  'trout', 'whale', 'wolf', 'wren', 'yak',
];

export function generateReadableSuffix(): string {
  const adjective = ADJECTIVES[crypto.randomInt(ADJECTIVES.length)];
  const noun = NOUNS[crypto.randomInt(NOUNS.length)];
  return `${adjective}-${noun}`;
}
