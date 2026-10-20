# js/sim/surrender.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the surrender vote: when a side may vote, the seats and how bots side with the people, what passes, the clock, the cooldown, the orders read before any body runs, and the pass (the side out, its bird home) | `VOTE_OPEN`/`VOTE_T`/`VOTE_CD`/`VOTE_HOLD`, `votes`/`voteCd` (`state.votes`/`state.voteCd`), `voteSeats`, `voteNeed`, `voteTally`, `voteCanStart`, `voteOpenFor`, `voteCmd`, `updateVotes` (first thing in `updatePlay`), `surrenderSide` (`state.surrendered`; its loss straight onto the stats: `endMatch`, player.js) | `surrender vote` |
