/**
 * Maps common text shortcodes (e.g., :smile:) to native emoji characters.
 * Applied on send so the stored message contains actual unicode emoji.
 */
const SHORTCODES: Record<string, string> = {
  // Smileys
  ':)': '🙂',
  ':-)': '🙂',
  ':(': '🙁',
  ':-(': '🙁',
  ':D': '😀',
  ':-D': '😀',
  ':P': '😛',
  ':-P': '😛',
  ':p': '😛',
  ';)': '😉',
  ';-)': '😉',
  ':o': '😮',
  ':O': '😮',
  'B)': '😎',
  'B-)': '😎',
  ':/': '😕',
  ':-/': '😕',
  '<3': '❤️',
  '</3': '💔',
  ':*': '😘',
  ':-*': '😘',
  ":'(": '😢',
  ":'-(": '😢',
  XD: '😆',
  xD: '😆',
  ':fire:': '🔥',
  ':heart:': '❤️',
  ':thumbsup:': '👍',
  ':+1:': '👍',
  ':thumbsdown:': '👎',
  ':-1:': '👎',
  ':clap:': '👏',
  ':wave:': '👋',
  ':ok:': '👌',
  ':pray:': '🙏',
  ':muscle:': '💪',
  ':100:': '💯',
  ':check:': '✅',
  ':x:': '❌',
  ':warning:': '⚠️',
  ':star:': '⭐',
  ':sparkles:': '✨',
  ':party:': '🎉',
  ':tada:': '🎉',
  ':rocket:': '🚀',
  ':eyes:': '👀',
  ':think:': '🤔',
  ':thinking:': '🤔',
  ':laugh:': '😂',
  ':cry:': '😭',
  ':angry:': '😠',
  ':smile:': '😊',
  ':wink:': '😉',
  ':cool:': '😎',
  ':sad:': '😢',
  ':love:': '😍',
  ':kiss:': '😘',
  ':tongue:': '😛',
  ':surprised:': '😮',
  ':sweat:': '😅',
  ':grimace:': '😬',
  ':shrug:': '🤷',
  ':facepalm:': '🤦',
  ':skull:': '💀',
  ':ghost:': '👻',
  ':poop:': '💩',
  ':coffee:': '☕',
  ':beer:': '🍺',
  ':pizza:': '🍕',
  ':cake:': '🎂',
  ':sun:': '☀️',
  ':moon:': '🌙',
  ':rainbow:': '🌈',
  ':umbrella:': '☂️',
  ':dog:': '🐶',
  ':cat:': '🐱',
  ':bug:': '🐛',
  ':pill:': '💊',
  ':syringe:': '💉',
  ':hospital:': '🏥',
  ':stethoscope:': '🩺',
  ':bandage:': '🩹',
  ':dna:': '🧬',
  ':microbe:': '🦠',
  ':bone:': '🦴',
  ':tooth:': '🦷',
  ':brain:': '🧠',
  ':lung:': '🫁',
  ':heart_organ:': '🫀',
  ':drop:': '🩸',
  ':xray:': '🩻',
};

// Build a regex that matches any shortcode.
// Sort by length desc so longer matches take priority (e.g., ":-)" before ":)").
const escaped = Object.keys(SHORTCODES)
  .sort((a, b) => b.length - a.length)
  .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

// Match shortcodes that are either at a word boundary or surrounded by spaces/start/end.
const SHORTCODE_REGEX = new RegExp(`(?<=^|\\s)(${escaped.join('|')})(?=$|\\s)`, 'g');

/**
 * Replaces text emoji shortcodes with their native unicode emoji.
 * Only replaces shortcodes surrounded by whitespace or at start/end of string.
 */
export function replaceEmojiShortcodes(text: string): string {
  return text.replace(SHORTCODE_REGEX, match => SHORTCODES[match] ?? match);
}
