# Bots and Steam: how the bot system helps Softfall sell

Thinking note, 2026-10-01. No code. Angle: Steam fit. Summary image: [steam-hooks.png](steam-hooks.png). Sister notes cover
player appeal and long-term system design.

## The one-line answer

The bots' job on Steam is not "cool AI". It is **the match is always full.** A ten-player indie
team game with a small playerbase dies on day one from "nobody online" reviews. Softfall never has
that problem: every empty seat is a bot with a mood, a role and a voice. That is the hook. The bot
API and ladder are the long tail that keeps a small community busy, not the pitch.

## Three hooks, ranked

### 1. "Ten seats, always full" (store page, launch)

- A solo player gets a real 5v5 with teammates that call out, regroup and go bear hunting.
- Two friends get a full match on a Tuesday at 3am. No lobby wait, no dead server.
- The store page should say this plainly and early. Most 5v5 indies hide the bot story; Softfall
  should make it the promise. Line to test: "Full matches from day one. Every empty seat is a
  teammate with a mind of its own."
- Evidence this matters: the games people recommend "to play with bots" (Unreal Tournament 2004,
  Left 4 Dead 2, Worms W.M.D.) are praised for bots that act like players, make mistakes, and
  show teamwork. Worms bots are liked because they miss shots sometimes. That matches Noah's
  "not aimbot" call exactly.

### 2. "Watch them think" (YouTube, wishlists)

- The F4 overlay and callouts are content machines. A Short where a bot says "HELP, 2 ON ME" and
  two allies turn around is a story in five seconds. Bot thoughts are the narration for free.
- Short angles that funnel to wishlists:
  - "My bots formed a bear hunting party without me" (emergent teamwork).
  - "I let my bots talk" (callouts).
  - "EASY vs HARD, same seed, side by side" (difficulty as a visual).
  - "I made 20 bots fight for a week" (ladder standings time-lapse, winner crowned).
  - "The bots found a strat I never thought of" (anything emergent that surprises Noah).
- Rule: the Short shows the game, the overlay and the chat line. The word "AI" is not the hook;
  the behaviour is.

### 3. "Write a bot, climb the ladder" (community, post-launch)

- One JavaScript file per bot is the ideal Steam Workshop item. Subscribe to a bot and it fills a
  seat in your match. The Workshop page becomes a bot zoo with ratings and screenshots.
- The online ladder plus a Steam leaderboard gives bot authors a reason to stay for months.
- This audience is real but small. GLADIABOTS (program your robots, $14.99) has about 850
  reviews after years; Screeps World and Screeps Arena are smaller. Dota 2's Workshop has a
  "Bot Script" category with popular packs, which shows people do write and share bots when
  the game is good first.
- So: build it, document it, mention it as one line on the page, but do not lead with it. It is
  a reason a programming YouTuber covers the game, not a reason the average player buys it.

## Store page

- **Tags that fit:** Team-Based, PvP, PvE, Multiplayer, Online Co-Op, Singleplayer, Pixel
  Graphics, Top-Down, Survival, Winter, Cozy, Tactical. Add "Artificial Intelligence" and
  "Programming" only once Workshop bots exist (Gladiabots uses both; they attract the ladder
  crowd and nobody else).
- **Say:** bots, teammates, opponents, "a mind of its own", difficulty names. Show the bot
  callouts and the F4 overlay in a GIF.
- **Do not say:** "AI" as a selling word. In 2026 "AI" on a Steam page reads as generative AI
  and draws hostile comments, even when it means game bots. "Bots" is the honest, friendlier
  word, and it is what players search for ("play with bots").
- **Honesty rule:** bots are always visibly bots (names, a mark on the roster). Players forgive
  bots they can see; they hate bots passed off as people. Reviews punish the second one hard.

## Steam features, ranked by fit

| Feature | Fit | Why |
| --- | --- | --- |
| Achievements | High, cheap | Tie them to bot moments: survive a bear party, win a HARD match, get rescued after a HELP call. Achievements are free marketing in the Steam feed. |
| Demo and Next Fest | High | Softfall's demo is a complete game because of the bots: no empty-server demo problem. A Next Fest slot with a bots-fill-seats demo is the single best wishlist event. |
| Workshop (bot files) | High later | Perfect item shape, but needs Steamworks in the Electron shell, a sandbox for untrusted code, and a moderation story. Post-launch. |
| Leaderboards | Medium | One board for the bot ladder (per author), one for solo ranked vs HARD. Only once the ladder is online. |
| Steam Deck | Medium | Gamepad already supported. A Deck-verified badge sells well and has nothing to do with bots, but bots make solo Deck play viable. |
| Remote Play Together | Low | One canvas, keyboard and mouse. Skip. |
| Trading cards, cloud | Low | Cloud saves for solo profiles maybe. Not a selling point. |

## Who this pulls in

- **Solo players** who like team games but hate queues and toxicity. Biggest group. Bots are the
  whole product for them.
- **Friend pairs and trios.** Two or three people, rest bots. The most common real-world group.
- **Streamers and Shorts makers.** Bot banter and visible thoughts are clip bait.
- **Programming hobbyists and students.** The ladder crowd. Small, loyal, writes guides.
- **Online 5v5 players.** Only once the playerbase exists. Bots make the bridge to that day.

## What Steam's AI rules mean here

- Steam's rewritten rule (January 2026) asks for disclosure of generative AI content in the game
  or its marketing, and of content generated live during play. Tooling used while developing,
  such as code assistants, is exempt. (Sources below. Check the current text before the page is
  updated; Valve keeps adjusting it.)
- Softfall's bots are scripted game AI, not generative, so they are not what the checkbox is
  about. The disclosure question is about art, audio and text, not bots. Noah should answer it
  honestly for the pixel art and sound pipeline; being open costs little, being caught costs a
  lot.
- Keep bot callouts as fixed lines, not generated text, and the live-generation box stays
  unchecked.

## Risks

1. **The "AI" word.** Leading with it invites the wrong fight. Use "bots".
2. **Bots too good or too chatty.** A bot that aims perfectly or shouts every second feels fake.
   The difficulty work and callout cooldowns are launch-critical, not polish.
3. **"Only bots online" reviews.** Even with great bots, someone will write it. Counter by
   framing bots as the design, showing the player count honestly, and never faking humans.
4. **Workshop code safety.** A bot file is code. Running strangers' code in a desktop app needs
   a real sandbox. Ship Workshop only when that exists.
5. **Ladder server cost and upkeep.** An online ladder is a service. Launch with the offline
   ladder; go online when authors ask for it, not before.
6. **Effort split before launch.** The ladder and dashboard are fun to build. The store sells
   on the match. Bots in matches first, bot tools second.
7. **Disclosure drift.** If any marketing art or store text is generated, say so. A takedown
   after launch is worse than a checkbox.

## Order of work, as it looks from the store

1. Bots as teammates: moods, roles, callouts, four difficulties, visible as bots. This is the
   launch.
2. Achievements wired to bot moments. Store GIF of a callout.
3. Demo for Next Fest. The demo is a full match vs bots.
4. Workshop bots and a Steam leaderboard for the ladder, after launch.
5. Online ladder when the bot community is real.

## Sources

- Valve rewrites the AI disclosure rule: https://www.gamedeveloper.com/business/valve-tweaks-and-clarifies-ai-disclosure-rules-for-steam
- GLADIABOTS store page (programmable bots, review count and tags): https://store.steampowered.com/app/871930/Gladiabots/
- Screeps: Arena and Screeps: World (programming games on Steam): https://store.steampowered.com/app/1137320/Screeps_Arena/ , https://store.steampowered.com/app/464350/Screeps_World/
- Dota 2 Workshop "Bot Script" category: https://steamcommunity.com/workshop/browse/?appid=570&browsesort=toprated&section=readytouseitems&requiredtags%5B%5D=Bot+Script
- PC Gamer, best multiplayer games to play with bots: https://www.pcgamer.com/best-multiplayer-bots-pc/
