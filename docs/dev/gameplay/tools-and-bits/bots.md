# Bots

A bot has no shelf and no pointer, so `botFitLoadout(p)` (called from step 8 of the ladder,
`aiThink` — `updateAI` is only its wrapper — on
a 2.5 s timer) does by hand what a person does with a drag: push loose bits into the tool it is
firing **while the load stays inside its tensile** (so its draw keeps its speed), `sortBits` the
row as a person's is sorted, and put a spare tool into an
empty weapon slot — or over a strictly worse body, which then takes the bag cell the new one came out of. It
only takes bits that fly *toward* what they were aimed at; a bot cannot read a boomerang or an
orbit and leaves those for someone who can.
