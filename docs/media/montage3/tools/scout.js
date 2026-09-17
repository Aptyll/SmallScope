// Print the scouted locations (window.__W) for seed SEED without filming.
const { run } = require('./probe');
const { PROLOGUE } = require('./scenes');
run([{ name: 'scout', stage: PROLOGUE, wait: 10, full: true }]);
