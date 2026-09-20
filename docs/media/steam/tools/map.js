// An ASCII plan of the ground around a tile, so a cast can be placed on open
// snow rather than inside a pine.
//   . snow   , dirt/road   ~ ice   T tree   r rock   # wall/struct   b bot bay
//   E eagle  M merchant    o other object
var e = SA.mine();
var cx = Math.round(e.x / TILE), cy = Math.round(e.y / TILE);
var R0 = 22, out = ['roost tile ' + cx + ',' + cy, ''];
var head = '     ';
for (var x = cx - R0; x <= cx + R0; x++) head += (x % 10 === 0 ? String(Math.floor(x / 10) % 10) : ' ');
out.push(head);
head = '     ';
for (var x = cx - R0; x <= cx + R0; x++) head += String(x % 10);
out.push(head);
for (var y = cy - R0; y <= cy + R0; y++) {
  var row = String(y).padStart(4, ' ') + ' ';
  for (var x = cx - R0; x <= cx + R0; x++) {
    var ch = '.';
    var g = ground[idx(x, y)];
    if (g === 1) ch = ',';
    else if (g === 2 || g === 3) ch = '~';
    var o = objAt(x, y);
    if (o) {
      if (o.type === 'tree') ch = 'T';
      else if (o.type === 'rock') ch = 'r';
      else if (o.type === 'stump') ch = 's';
      else if (structOf(o)) ch = structOf(o).type === 'spawner' ? 'b' : (structOf(o).type === 'turret' ? 't' : '#');
      else ch = 'o';
    }
    if (Math.abs(x - cx) <= 1 && Math.abs(y - cy) <= 1) ch = 'E';
    row += ch;
  }
  out.push(row);
}
var m = robots.filter(function(r){ return r.merchant; }).map(function(r){ return r.team + '@' + Math.round(r.x/TILE) + ',' + Math.round(r.y/TILE); });
out.push('merchants ' + m.join(' '));
out.push('structs ' + structures.map(function(s){ return s.type; }).filter(function(v,i,a){ return a.indexOf(v)===i; }).join(','));
return out.join('\n');
