'use strict';
// What walks out of the perch, and fire: the wave's soldiers. The
// merchant's trading post, the gold pump and the road tower are each their
// own file, all baked after this one (js/baked/stall.js, pump.js, tower.js)
// into the teamBuild sets made here.
(() => {
  const { bake, TEAM_SKINS } = SPR;

  // ---------------------------------------------------------------- soldiers
  // Soldier: a boxy chassis sitting straight on one full-width tread, stub
  // arms at the sides, no face. One 12x10 grid, two frames (the tread notches
  // shift so it rolls); drawRobot() bobs the whole sprite so body and tread
  // never part. The body (L/T/t) is painted in the team colour.
  const BOTPAL = {
    '.': null,
    'o': '#1c2130', // outline
    'L': '#df7358', // top plate (team light)
    'T': '#c9524e', // body (team)
    't': '#96393f', // body shade (team dark)
    'a': '#b5bcc8', // arm
    'A': '#7d8595', // claw
    'k': '#3b4150', // tread
    'n': '#6c7486', // tread notch
  };
  const botA = [
    '..oooooooo..',
    '.oLLLLLLLLo.',
    'oaoTTTTTToao',
    'oaoTTTTTToao',
    'oAoTTTTTToAo',
    '.oottttttoo.',
    'oooooooooooo',
    'okkkkkkkkkko',
    'oknkknkknkko',
    'oooooooooooo',
  ];
  const botB = botA.slice(0, 8).concat([
    'okknkknkknko',
    'oooooooooooo',
  ]);

  // ---------------------------------------------------------------- fire
  const FPAL = {
    '.': null,
    'o': '#3c2a1e',
    'u': '#8a6142',
    'U': '#a3794f',
    'v': '#6b4a30',
    'f': '#f2a63c', // flame orange
    'F': '#f6d35c', // flame yellow
    'h': '#e2622e', // flame deep
    'W': '#fff7d9', // flame core
    'y': '#8b93a8', // stone ring
    'Y': '#a8b0c4',
    's': '#c9dcee',
  };

  const fire1 = [
    '................',
    '................',
    '.......f........',
    '......hf........',
    '......hff.......',
    '.....hfFf.......',
    '.....hfFFf......',
    '....hffFWFf.....',
    '....hfFWWFf.....',
    '....hfFWFFfh....',
    '.....ffFFfh.....',
    '..ovuuffuuvo....',
    '.ovuUuUuUuuvo...',
    '..oyossssoyo....',
    '...ssssssss.....',
    '................',
  ];
  const fire2 = [
    '................',
    '................',
    '........f.......',
    '........fh......',
    '.......ffh......',
    '.......fFfh.....',
    '......fFFfh.....',
    '.....ffWFffh....',
    '.....fFWWFfh....',
    '....hfFFWFf.....',
    '.....hfFFff.....',
    '..ovuuffuuvo....',
    '.ovuUuUuUuuvo...',
    '..oyossssoyo....',
    '...ssssssss.....',
    '................',
  ];
  const fire3 = [
    '................',
    '................',
    '................',
    '.......f........',
    '......fFh.......',
    '......fFfh......',
    '.....hfFFf......',
    '.....fFWFfh.....',
    '....hfFWWFf.....',
    '....hffFWFfh....',
    '.....hffFff.....',
    '..ovuuffuuvo....',
    '.ovuUuUuUuuvo...',
    '..oyossssoyo....',
    '...ssssssss.....',
    '................',
  ];

  const teamRobotPal = (t) => Object.assign({}, BOTPAL, { L: t.coatL, T: t.coat, t: t.coatD });
  const teamBuild = [], teamRobots = [];
  SPR.onTeams(() => TEAM_SKINS.forEach((t, i) => {
    teamBuild[i] = {}; // the built things a side paints: the baked files fill it (js/baked/stall.js, pump.js, tower.js)
    teamRobots[i] = [bake(botA, teamRobotPal(t)), bake(botB, teamRobotPal(t))];
  }));

  Object.assign(SPRITES, {
    teamBuild: teamBuild,
    robotTeam: teamRobots,
    robot: teamRobots[0],
    fire: [bake(fire1, FPAL), bake(fire2, FPAL), bake(fire3, FPAL)],
  });
})();
