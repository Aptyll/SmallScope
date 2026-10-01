# Writing a Softfall bot

A Softfall bot is one JavaScript file. It plays **one seat** of a ten-player match: ten times a
second the game tells it what that seat's player can see, and the bot answers with the keys it
is holding. It can never do more than a player with a keyboard could, and it never sees more than
that player's screen and maps show. Bots on one side can talk to each other, and every bot says
what it is thinking, so you can watch it reason in the game's bot view (F4) and the bot lab.

- **[API reference](api.md)**: every field a bot reads and writes, the timing, the team channel.
- **[The ladder](ladder.md)**: rated matches between bot files, and the road to an online ladder.
- **[Example bots](../../bots/)**: `starter.js` (the template), `pack.js` (teamwork over `say`),
  `keeper.js` (gathering, buying, defending), and four ladder styles: `raider.js` (rushes the
  rival bird), `bulwark.js` (holds its spur with turrets, sallies after a wipe), `prospector.js`
  (farms and gears up, then pushes together) and `shepherd.js` (walks behind its soldier waves).

## The smallest bot

```js
defineBot({
  name: 'HOMEBODY',
  author: 'you',
  version: '1.0',
  think(obs) {
    const own = obs.eagles.find((e) => e.team === obs.me.team && e.state === 'down');
    if (!own) return { think: { goal: 'IDLE', why: 'NO BIRD YET' } };
    return {
      goTo: { x: own.x, y: own.y, reach: 1 },          // walk there by the game's pathfinder
      think: { goal: 'GUARD', why: 'STAY HOME' },        // what the bot view shows
    };
  },
});
```

`think(obs)` returns an **act**: held keys (`move`, `goTo`, `aim`, `fire`, `work`, `slide`,
`grapple`) stay held until your next act; one-shot keys (`dodge`, `jump`, `ability`, `eatBerry`,
`eatFish`, `useCard`, `cmd`) fire once. Return `null` to keep holding what you held. Keep memory
on `this` (the object you passed to `defineBot`).

## Running your bot

Today bots run offline, on your own computer, two ways:

1. **In the browser game**, from the console (F12) of a page serving the game
   (`node app/server.js`, then `http://localhost:8471`, or `index.html` opened straight off the
   disk):

   ```js
   BOTS.add('mine', `defineBot({ ... })`, 'worker');   // your file's text, run in a Web Worker
   BOTS.assign(1, 'mine');                              // seat 1 (odd seats are team 1)
   ```

   Then press F4 to see every bot's goal and target on the map.

2. **Headless, bot against bot**, in Node (no browser), with the arena runner (`app/arena/`,
   [docs/dev/arena.md](../dev/arena.md)): `playMatch({ seed, bots: { mine: src }, seats: { 1: 'mine' } })`.

3. **On the ladder**, rated against every other bot file: `node app/ladder/ladder.js add mybot.js`,
   then `node app/ladder/ladder.js run`. See [ladder.md](ladder.md).


## Rules a bot lives by

- **One seat, one file.** Five copies of your file playing one team do not share memory; they
  share only what they `say` (see [the team channel](api.md#the-team-channel)).
- **What a player sees, nothing more.** Rivals show up near any of your side, the way the minimap
  shows them, and a rival buried in the snow drops off it. Both birds are always known.
- **The same hands for everyone.** On the ladder every seat's crosshair turns at the same speed
  and wobbles the same (the HARD bots' hands), so the ladder ranks decisions, not aim.
- **Ten thinks a second.** An answer that is late is not waited for in a live game; the seat
  keeps what it held.
- **A broken bot stands still.** A throw is caught and counted (`BOTS.rt` in the page's console);
  the seat keeps its last act.

## How it is built (and where it is going)

The game already drives every player through one **input struct**, the same one a keyboard fills
and an online client sends to its host. A bot file is one more controller of that struct, behind
a plain JSON message boundary: the bot never holds a reference into the game, so the same file
runs in a Web Worker in the game, sealed in a Node vm on the ladder, or, later, on a server across
a socket for an online ladder, with no change to the file. Nothing runs in the page itself, not
even the examples. The contract that pins this down is
[api.md](api.md); its `api` number goes up whenever a field is renamed.
