# Wobbly Mart: data protection impact assessment (online features)

One page, kept with the code. Not legal advice. Findings behind it: `.scratch/release-03-leaderboard/research/security-legal.md` on `research/online-security-legal`.

## What is processed

| Data                                | Why                                  | Where                                    | How long                                          |
| ----------------------------------- | ------------------------------------ | ---------------------------------------- | ------------------------------------------------- |
| Device: SHA-256 of the Cloud Code   | Recognise a browser without accounts | Board DB                                 | While the Device exists; idle 24 months ⇒ deleted |
| Nickname (free text, 3–16 chars)    | Show results on the Wall of Fame     | Board DB                                 | While the Device exists                           |
| Board rows, Streak                  | The Wall of Fame                     | Board DB                                 | While the Device exists                           |
| Replays (inputs of a Daily Shift)   | Check a Daily time                   | Replay DB                                | Top 100 per day for 30 days, then top 10          |
| Cloud save (the Save Code, gzipped) | Carry progress to another browser    | Save DB                                  | While the Device exists                           |
| IP address                          | Rate limits against abuse            | Cloudflare edge only, never stored by us | Cloudflare's own retention                        |

Lawful basis: legitimate interests (running a fair, abuse-resistant Wall of Fame). The Privacy popup's Accept is an acknowledgement before the first online write, not consent. Nothing is collected before it; offline play is never gated. No ads, analytics or third-party scripts, so no cookie banner. Processor: Cloudflare, Inc.

## Risks and decisions

1. **Shared origin.** The game is served from `seif-sallam.github.io`, an origin shared with the owner's other Pages sites. A script on any of them could read the Cloud Code from `localStorage`. _Mitigation:_ standing rule that no site on that origin loads third-party scripts; the game page has a CSP (`script-src 'self'`); the Cloud Code can be rotated (Settings → New Cloud Code). _Residual:_ low, accepted.
2. **The Streak.** A daily streak can pull players back compulsively, children especially. _Mitigation:_ kept, but no notifications, reminders or loss nags anywhere; a missed day just resets it quietly. _Residual:_ low, accepted.
3. **Free-text Nicknames.** Players may type a real name or something offensive. _Mitigation:_ hint "No real names", the character rule, the Worker blocklist, and a documented by-hand fix for names that slip through (`UPDATE device SET nickname = …`). _Residual:_ real names are still accepted — owner-accepted risk.
4. **Children.** No age gate; the data is minimal (no contact details, no free text beyond the Nickname, no profiling) and every Device can delete itself at once.

## Rights

Access: Settings shows the Nickname and Cloud Code. Rectification: Change Nickname. Erasure: Delete my Device removes the Device, its Board rows, Replays and cloud save immediately across all three databases. Questions: the contact in the Privacy notice (`src/privacy.ts`).
