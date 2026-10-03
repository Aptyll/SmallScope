# Any camera off a recorded frame, pixel-sharp. A take is recorded with the game camera
# held still at S canvas px per world px; a shot is an output scale k (output px per
# world px) and a world centre that may move sub-pixel. The frame is first blown up
# whole-pixel (nearest) until it is at least as big as the output wants, then
# area-averaged down to the exact size: edges stay hard, a slow pan never shimmers.
import math
from PIL import Image

def view(img, cam, S, cx, cy, k, size=(1080, 1920)):
    W, H = size
    w, h = W / k, H / k
    CW, CH = img.size[0] / S, img.size[1] / S              # the frame in world px
    x0 = min(max(cx - w / 2 - cam[0], 0), max(0, CW - w)); y0 = min(max(cy - h / 2 - cam[1], 0), max(0, CH - h))
    bx0, by0, bx1, by1 = x0 * S, y0 * S, (x0 + w) * S, (y0 + h) * S
    if k <= S:
        return img.resize((W, H), Image.BOX, box=(bx0, by0, bx1, by1))
    m = math.ceil(k / S)
    ix0, iy0 = max(0, math.floor(bx0) - 1), max(0, math.floor(by0) - 1)
    ix1, iy1 = min(img.size[0], math.ceil(bx1) + 1), min(img.size[1], math.ceil(by1) + 1)
    big = img.crop((ix0, iy0, ix1, iy1)).resize(((ix1 - ix0) * m, (iy1 - iy0) * m), Image.NEAREST)
    return big.resize((W, H), Image.BOX, box=((bx0 - ix0) * m, (by0 - iy0) * m, (bx1 - ix0) * m, (by1 - iy0) * m))

def k_min(img, S, size=(1080, 1920)):
    # the widest k a frame can fill without showing past its edge
    return max(size[0] / (img.size[0] / S), size[1] / (img.size[1] / S))
