# The dawn shield

The [warrens](../world.md#camps) carry three **snowdrop** clumps each, at the back of the clearing
(`OBJECTS.snowdrop`, art from `app/bake-snowdrops`: a gold bell on one bold crook in a 24 px cell,
a bronze bud shut; an open one is lit above the night, in a pool of warm light with sparks,
twinkles and motes round it: `litSnowdrops`, js/draw/light.js). A clump is **open until
someone picks it**: an open clump is a work target and the hands take it on their own
(`auto`, `ready`), and a pick (`pickSnowdrop`, js/sim/actions.js) lays `DAWN_SHIELD` (10)
of shield on **every scout of the picker's side** who is up and on the ground, wherever they are,
stacking to `DAWN_SHIELD_MAX` (30): so the clumps are worth racing the other side to, one segment
each. Then that clump alone rests `SNOWDROP_CD` (90 s; `o.readyAt`, the match second it opens,
read by `snowdropLeft`): a snapped stem, a shut bud for its last `SNOWDROP_BUD_T` (25 s), open
again at zero, and the neutral bar a bush wears under the pointer while it rests.

The shield (`p.dawnShield`) holds until hits break it or its scout goes down — it never wears off.
`damagePlayer` spends it **after** the damage reduction and **before** health, with a gold burst,
and a shatter (`shieldBreak`) the hit that empties it. It is drawn as its own gold bar over the
health bar ([rendering.md](../rendering/overhead-health-bars.md)), and nowhere else.
