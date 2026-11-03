// The privacy notice: one text for the in-game Privacy popup and the built privacy.html page.

/** Bump when the text changes in substance: players who accepted an older version are asked again. */
export const PRIVACY_VERSION = 1;

export const PRIVACY_CONTACT = 'https://github.com/Seif-Sallam/Wobbly-Mart/issues';

export interface PrivacySection {
  heading: string;
  lines: string[];
}

export const PRIVACY: PrivacySection[] = [
  {
    heading: 'The short version',
    lines: [
      'Wobbly Mart plays fully offline. Nothing leaves your browser until you choose to get on the Wall of Fame or turn on cloud save.',
      'No ads, no analytics, no tracking, no third-party scripts.',
    ],
  },
  {
    heading: 'What is stored online, and why',
    lines: [
      'Your Device: a random Cloud Code that this browser keeps. Our server stores only a scrambled (hashed) copy, so it can recognise the code but never read it back.',
      'Your Nickname, which shows next to your results. Please don’t use your real name.',
      'Your Wall of Fame rows: times, Scores and Money for the Maps and Daily Shifts you finish, and your Daily Shift Streak.',
      'Replays of your Daily Shifts (the buttons you pressed), so a time can be checked.',
      'Your cloud save, if you turn it on, so you can carry on in another browser.',
      'Cloudflare, which runs our server, sees your IP address with each request to stop abuse. We don’t store it.',
    ],
  },
  {
    heading: 'How long',
    lines: [
      'Wall rows, Streak and cloud save: while your Device exists.',
      'Replays: the top 100 of each day for 30 days, then the top 10.',
      'A Device nobody has used for 24 months is deleted with everything it owns.',
      'Delete my Device (in Settings) removes all of it at once, for good.',
    ],
  },
  {
    heading: 'Your rights',
    lines: [
      'You can see your Nickname and Cloud Code in Settings, change your Nickname, get a new Cloud Code, or delete your Device and everything in it.',
      'We keep this data because running a fair Wall of Fame is a legitimate interest of the game; it is never sold or shared.',
      'Cloudflare, Inc. processes it for us as our hosting provider.',
      `Questions or requests: ${PRIVACY_CONTACT}`,
    ],
  },
];

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

/** The notice as static HTML, for privacy.html at build time. */
export const privacyHtml = (): string =>
  PRIVACY.map(
    (s) => `<h2>${escapeHtml(s.heading)}</h2>\n${s.lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('\n')}`,
  ).join('\n');
