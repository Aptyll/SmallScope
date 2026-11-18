# PARKED, not a step of the art skill (Noah 2026-11-18: a note, not a rule). An idea for a judge:
# new art among what Noah kept and what he rejected, for one fresh reader.
# No ruler tells good art from bad here (docs/dev/art.md), the author cannot judge their own
# work, and a fresh reader's own taste is not Noah's (docs/dev/art-bar.md, What was measured). So
# the reader is shown his verdicts and asked what he would say, without knowing which tile is new.
# The library is docs/media/bar/ (verdicts.json and the pictures); the bar is docs/dev/art-bar.md.
#
#   python3 app/art/review.py sprite OUT new.png [more.png] --is "wild boar" [--kind beast|hero|machine|prop|icon]
#                                    [--beside pine.png,pump.png] [--frame game.png --new 5,6] [--seed 1]
#   python3 app/art/review.py frame  OUT new-frame.png --is "the orca" [--kind place|layout|hud|effect]
#   python3 app/art/review.py verdict OUT answers.json     PASS or FAIL from the reader's JSON
#   python3 app/art/review.py add ID file.png --kind K --verdict kept|rejected --words "his words" [--why ".."] [--date D]
#   python3 app/art/review.py wall out.png                 the whole library on one sheet
#
# sprite / frame write OUT/ and, beside it, OUT.key.json. The sheet has three bands: pieces of the
# same kind Noah KEPT (K1..), pieces he REJECTED (R1..) with his words in owner.md, and the numbered
# pieces to judge: the new art shuffled with one or two he has already judged, so the reader cannot
# tell which is new and every review tests its own reader. Hand the reader ONLY the OUT/ folder and
# app/art/reviewer.md; the key stays with the author. The reader answers in JSON; save it and run
# `verdict`. A kind the library has nothing of yet gets a plain blind read (the numbered band alone).
# --beside names today's sprites it will stand next to (app/art/cut.js saves them): they join the
# numbered band, and art the reader ranks under all of them is not ready, whatever it reads as.
# --is is what the author means the art to be (never shown to the reader). --frame is a real game
# frame from app/art/stage.js with the new bodies at the places --new counts from the left.
import sys, os, json, random, shutil, datetime
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'media'))
from look import glyphs

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BAR = os.path.join(ROOT, 'docs', 'media', 'bar')
INDEX = os.path.join(BAR, 'verdicts.json')
SNOW, DIRT, BG, INK, PLATE = (208, 221, 244), (150, 134, 110), (18, 22, 34), (26, 20, 32), (30, 36, 54)
PLACES = ('place', 'layout', 'hud', 'effect')   # kinds judged as a whole frame, never trimmed


def library():
    return json.load(open(INDEX, encoding='utf8'))['items']


def trim(im):
    a = np.asarray(im.convert('RGBA')).copy(); a[a[..., 3] < 128] = 0; a[a[..., 3] >= 128, 3] = 255
    im = Image.fromarray(a); return im.crop(im.getbbox())


def opts(a, flags):
    # the words after the command: bare ones are files, --name value pairs are options
    o, files, i = {}, [], 0
    while i < len(a):
        if a[i].startswith('--') and a[i][2:] in flags: o[a[i][2:]] = a[i + 1]; i += 2
        else: files.append(a[i]); i += 1
    return o, files


def label(B, txt, x, y, col='gold', s=2):
    t = glyphs([[(txt, col)]], s); B.paste(t, (x, y), t)


def on(im, ground, s):
    b = Image.new('RGBA', im.size, ground + (255,)); b.alpha_composite(im)
    return b.convert('RGB').resize((im.width * s, im.height * s), Image.NEAREST)


def flat(im, s):
    m = np.asarray(im)[..., 3] > 127; out = np.zeros(m.shape + (3,), np.uint8); out[:] = SNOW; out[m] = INK
    return Image.fromarray(out).resize((im.width * s, im.height * s), Image.NEAREST)


def grey(im):
    a = np.asarray(im.convert('RGB')).astype(float); l = (0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]).astype(np.uint8)
    return Image.fromarray(np.stack([l, l, l], -1))


def squint(im, k=8):
    # what is left when the detail goes: the big shapes and what out-shouts what
    small = im.convert('RGB').resize((max(1, im.width // k), max(1, im.height // k)), Image.BOX)
    return small.resize(im.size, Image.BILINEAR)


def pick(kind, like, seed, skip=()):
    # Anchors of the candidate's kind first, then whatever is nearest in size. Most are shown with
    # Noah's verdict on them; one or two of each verdict are hidden among the numbered tiles, so
    # every review also tests its reader.
    lib = [dict(it, im=Image.open(os.path.join(BAR, it['file'])).convert('RGBA')) for it in library()
           if it.get('anchor', True) and it['id'] not in skip and (it['kind'] in PLACES) == (kind in PLACES)]
    area = like.width * like.height
    def near(it): return (it['kind'] != kind, abs(np.log(it['im'].width * it['im'].height / area)))
    shown, hidden = [], []
    for v in ('kept', 'rejected'):
        its = sorted([it for it in lib if it['verdict'] == v and (kind not in PLACES or it['kind'] == kind)], key=near)[:5]
        random.Random(seed).shuffle(its)
        h = 0 if len(its) < 3 else 1 if len(its) < 5 else 2
        hidden += its[:h]; shown += its[h:]
    if not any(it['kind'] == kind for it in shown + hidden):
        print('the library has no %s yet: %s' % (kind, 'this is a plain blind read' if not shown else 'the anchors are other kinds, so the call is weak') + '. File Noah\'s verdict with `add` afterwards.')
    return shown, hidden


def tagged(cands, shown, hidden, seed, beside=()):
    # K1.. and R1.. wear their verdict; the numbered tiles are the new art, today's neighbours and
    # the hidden known pieces
    tiles = []
    for v, tag in (('kept', 'K'), ('rejected', 'R')):
        for i, a in enumerate(sorted([x for x in shown if x['verdict'] == v], key=lambda x: x['id'])):
            tiles.append(dict(role='shown-' + v, id=a['id'], im=a['im'], tag='%s%d' % (tag, i + 1), words=a['words']))
    num = [dict(role='new', file=f, im=im) for f, im in cands] + [dict(role='beside', file=f, im=im) for f, im in beside]
    num += [dict(role=a['verdict'], id=a['id'], im=a['im']) for a in hidden]
    random.Random(seed).shuffle(num)
    for n, t in enumerate(num): t['tag'] = str(n + 1)
    return tiles + num


def owner_md(out, tiles):
    rows = ['# What the owner said', '', 'K pieces he kept, R pieces he rejected. The words are his.', '']
    rows += ['- %s: "%s"' % (t['tag'], t['words']) for t in tiles if 'words' in t]
    open(os.path.join(out, 'owner.md'), 'w', encoding='utf8').write('\n'.join(rows) + '\n')


def write_key(out, tiles, o, mode, extra=None):
    key = dict(mode=mode, means=o.get('is', ''), made=datetime.date.today().isoformat(),
               tiles={t['tag']: {k: t[k] for k in ('role', 'file', 'id') if k in t} for t in tiles})
    key.update(extra or {})
    json.dump(key, open(out.rstrip('/') + '.key.json', 'w'), indent=1)


BANDS = (('K', 'THE OWNER KEPT', 'gold'), ('R', 'THE OWNER REJECTED', 'red'), ('', 'JUDGE THESE', 'white'))


def band(t):
    return t['tag'][0] if t['tag'][0] in 'KR' else ''


def lay_sprites(tiles):
    # every tile: the art big on snow, its flat shape, then the sizes a player sees
    mw, mh = max(t['im'].width for t in tiles), max(t['im'].height for t in tiles)
    S = max(3, min(8, 200 // max(mw, mh)))
    cw, ch = mw * S + 12, mh * S + 12                 # one view; a tile is two views wide
    strip = mh * 2 + 10                               # the row of real sizes under them
    tw, th = cw * 2 + 14, 22 + ch + strip + 14
    cols = 3 if tw * 3 <= 1500 else 2
    groups = [(title, col, [t for t in tiles if band(t) == b]) for b, title, col in BANDS]
    groups = [g for g in groups if g[2]]
    H = 14 + sum(30 + -(-len(g[2]) // cols) * th for g in groups)
    B = Image.new('RGB', (cols * tw + 14, H), BG); y0 = 14
    for title, col, ts in groups:
        label(B, title, 14, y0, col, 3); y0 += 30
        for i, t in enumerate(ts):
            x, y, im = 14 + (i % cols) * tw, y0 + (i // cols) * th, t['im']
            label(B, t['tag'], x, y, col, 3)
            for v, g in enumerate((on(im, SNOW, S), flat(im, S))):
                tile = Image.new('RGB', (cw, ch), SNOW); tile.paste(g, ((cw - g.width) // 2, ch - g.height - 6)); B.paste(tile, (x + v * cw, y + 22))
            # the size a player sees: 1x on snow and on the road, 2x on snow, 2x in greys
            sx, sy = x, y + 22 + ch + 2
            for ground, k in ((SNOW, 1), (DIRT, 1), (SNOW, 2)):
                g = on(im, ground, k); tile = Image.new('RGB', (g.width + 8, strip), ground); tile.paste(g, (4, strip - g.height - 4)); B.paste(tile, (sx, sy)); sx += tile.width + 2
            g = grey(on(im, SNOW, 2)); tile = Image.new('RGB', (g.width + 8, strip), grey(Image.new('RGB', (1, 1), SNOW)).getpixel((0, 0))); tile.paste(g, (4, strip - g.height - 4)); B.paste(tile, (sx, sy))
        y0 += -(-len(ts) // cols) * th
    return B, S


def sprite(a):
    o, files = opts(a, ('is', 'kind', 'beside', 'frame', 'new', 'seed'))
    out, files = files[0], files[1:]
    if not files or 'is' not in o: print('usage: review.py sprite OUT new.png [more.png] --is "what it is meant to be" [--kind beast|hero|machine] [--beside pine.png,pump.png]'); return 1
    cands = [(f, trim(Image.open(f))) for f in files]
    beside = [(f, trim(Image.open(f))) for f in o.get('beside', '').split(',') if f]
    big = max(cands, key=lambda c: c[1].width * c[1].height)[1]
    seed = int(o.get('seed', 1))
    tiles = tagged(cands, *pick(o.get('kind', 'beast'), big, seed), seed, beside)
    B, S = lay_sprites(tiles)
    os.makedirs(out, exist_ok=True); B.save(os.path.join(out, 'sheet.png')); owner_md(out, tiles)
    extra = {}
    if o.get('frame'):
        shutil.copyfile(o['frame'], os.path.join(out, 'frame.png')); extra['frame_new'] = [int(v) for v in str(o.get('new', '')).split(',') if v]
    write_key(out, tiles, o, 'sprite', extra)
    print(out + '/sheet.png', '%d tiles at %dx' % (len(tiles), S), '(key: %s.key.json)' % out.rstrip('/'))
    return 0


def lay_frames(tiles, out):
    # every frame at full size as <tag>.png, and one sheet: colour, greys, squint
    os.makedirs(out, exist_ok=True)
    W = 440; rowh = max(int(t['im'].height * W / t['im'].width) for t in tiles) + 30
    B = Image.new('RGB', (W * 3 + 14 * 4, len(tiles) * rowh + 14), BG)
    for i, t in enumerate(tiles):
        im = t['im'].convert('RGB'); im.save(os.path.join(out, t['tag'] + '.png'))
        col = dict(K='gold', R='red').get(band(t), 'white')
        y = 14 + i * rowh; label(B, '%s   COLOUR   GREYS   SQUINT' % t['tag'], 14, y, col, 2)
        h = int(im.height * W / im.width)
        for v, g in enumerate((im, grey(im), squint(im))):
            B.paste(g.resize((W, h), Image.NEAREST if v == 0 and im.width <= W else Image.LANCZOS), (14 + v * (W + 14), y + 16))
    return B


def frame(a):
    o, files = opts(a, ('is', 'kind', 'seed'))
    out, files = files[0], files[1:]
    if not files or 'is' not in o: print('usage: review.py frame OUT new-frame.png --is "what the eye should land on" [--kind place|layout]'); return 1
    cands = [(f, Image.open(f).convert('RGBA')) for f in files]
    seed = int(o.get('seed', 1))
    tiles = tagged(cands, *pick(o.get('kind', 'place'), cands[0][1], seed), seed)
    B = lay_frames(tiles, out)
    B.save(os.path.join(out, 'sheet.png')); owner_md(out, tiles)
    write_key(out, tiles, o, 'frame')
    print(out + '/sheet.png', '%d frames' % len(tiles), '(key: %s.key.json)' % out.rstrip('/'))
    return 0


def verdict(a):
    out, ans = a[0].rstrip('/'), json.load(open(a[1], encoding='utf8'))
    key = json.load(open(out + '.key.json')); T = key['tiles']
    by = {str(t['n']): t for t in ans.get('tiles', [])}
    rank = [str(n) for n in ans.get('rank', [])]; at = {n: i for i, n in enumerate(rank)}
    call = lambda n: str(by.get(n, {}).get('call', '')).lower()
    # is this reader worth listening to? it met pieces Noah has judged without being told
    known = [n for n, t in T.items() if t['role'] in ('kept', 'rejected')]
    right = [n for n in known if call(n) == T[n]['role']]
    trusted = not known or len(right) / len(known) >= 0.75
    if known: print('the reader called %d of %d hidden pieces as Noah did%s' % (len(right), len(known), '' if trusted else ': not a judge of his taste, get another reader'))
    else: print('no hidden pieces on this sheet: the reader is untested')
    ok_all = trusted
    words = [w for w in key.get('means', '').lower().replace(',', ' ').split() if len(w) > 2 and w not in ('the', 'and', 'with')]
    rej = [n for n in known if T[n]['role'] == 'rejected']
    near = [n for n, t in T.items() if t['role'] == 'beside' and n in at]
    for n, t in sorted(T.items()):
        if t['role'] != 'new': continue
        r = by.get(n, {}); said = str(r.get('what', r.get('first', ''))).lower()
        checks = [('READ  says "%s" (meant: %s)' % (said, key.get('means', '')), any(w in said for w in words))]
        if any(t['role'].startswith('shown') for t in T.values()):   # with nothing of Noah's shown there is no call to make
            checks += [
                ('CALL  the reader says Noah would keep it (like %s)' % (r.get('like') or '?'), call(n) == 'kept'),
                ('RANK  above every hidden rejected piece (place %s of %d)' % (at.get(n, -1) + 1, len(rank)), n in at and all(at[n] < at[x] for x in rej if x in at)),
            ]
        if key['mode'] == 'sprite':
            checks.append(('CRAFT the reader calls it %s' % (r.get('finish') or '?'), str(r.get('finish', '')).lower() == 'finished'))
        if near:
            checks.append(('CRAFT not ranked under every neighbour it will stand beside (%d of them)' % len(near), n in at and any(at[n] < at[x] for x in near)))
        if key.get('frame_new'):
            odd = {int(v) for v in ans.get('odd', [])}
            checks.append(('FIT   not the odd one out in the game frame (reader picked %s)' % (sorted(odd) or 'nobody'), not (odd & set(key['frame_new']))))
        good = all(c[1] for c in checks); ok_all = ok_all and good
        print('\n%s  tile %s  %s' % ('PASS' if good else 'FAIL', n, t.get('file', '')))
        for txt, c in checks: print('  %s %s' % ('ok  ' if c else 'FAIL', txt))
        for k in ('why', 'worst'):
            if r.get(k): print('  %s: %s' % (k, r[k]))
    return 0 if ok_all else 1


def add(a):
    o, files = opts(a, ('kind', 'verdict', 'words', 'why', 'date'))
    if len(files) < 2 or o.get('verdict') not in ('kept', 'rejected') or not o.get('kind') or not o.get('words'):
        print('usage: review.py add ID file.png --kind beast|hero|machine|prop|icon|place|layout|hud|effect --verdict kept|rejected --words "what Noah said" [--why "your reading"] [--date YYYY-MM-DD]'); return 1
    ident, src = files[0], files[1]
    d = json.load(open(INDEX, encoding='utf8'))
    if any(it['id'] == ident for it in d['items']): print('the library already has ' + ident); return 1
    im = Image.open(src); im = im.convert('RGB') if o['kind'] in PLACES else trim(im)
    im.save(os.path.join(BAR, ident + '.png'))
    d['items'].append(dict(id=ident, file=ident + '.png', kind=o['kind'], verdict=o['verdict'], date=o.get('date', datetime.date.today().isoformat()), words=o['words'], why=o.get('why', '')))
    json.dump(d, open(INDEX, 'w', encoding='utf8'), indent=1, ensure_ascii=False)
    print('added', ident, im.size); return 0


def wall(a):
    lib = [dict(it, im=Image.open(os.path.join(BAR, it['file'])).convert('RGBA')) for it in library() if it['kind'] not in PLACES]
    S, rows = 4, []
    for v, col in (('kept', 'gold'), ('rejected', 'red')):
        its = sorted([it for it in lib if it['verdict'] == v], key=lambda it: (it['kind'], it['im'].height))
        h = max(it['im'].height for it in its) * S + 16; w = sum(it['im'].width * S + 18 for it in its) + 18
        R = Image.new('RGB', (w, h + 26), BG); label(R, 'NOAH ' + v.upper(), 8, 6, col, 3); x = 18
        strip = Image.new('RGB', (w, h), SNOW)
        for it in its:
            g = on(it['im'], SNOW, S); strip.paste(g, (x, h - g.height - 8)); x += g.width + 18
        R.paste(strip, (0, 26)); rows.append(R)
    B = Image.new('RGB', (max(r.width for r in rows), sum(r.height for r in rows) + 8), BG); y = 0
    for r in rows: B.paste(r, (0, y)); y += r.height + 8
    B.save(a[0]); print(a[0], B.size); return 0


if __name__ == '__main__':
    cmds = dict(sprite=sprite, frame=frame, verdict=verdict, add=add, wall=wall)
    if len(sys.argv) < 3 or sys.argv[1] not in cmds:
        print('usage: python3 app/art/review.py sprite|frame|verdict|add|wall ...  (see the header)'); sys.exit(1)
    sys.exit(cmds[sys.argv[1]](sys.argv[2:]))
