"""把 PNG 打包成标准 Windows .ico（多尺寸，PNG 内嵌压缩格式）"""
import struct
import sys
import io

# 纯 Python PNG 解码（仅需支持本项目生成的真彩+Alpha 8bit）
import zlib


def png_decode(data):
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    pos = 8
    idat = b''
    w = h = 0
    bitdepth = colortype = 0
    while pos < len(data):
        (length,) = struct.unpack('>I', data[pos:pos + 4])
        ctype = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + length]
        pos += 12 + length
        if ctype == b'IHDR':
            w, h, bitdepth, colortype = struct.unpack('>IIBB', chunk[:10])
        elif ctype == b'IDAT':
            idat += chunk
        elif ctype == b'IEND':
            break
    raw = zlib.decompress(idat)
    channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[colortype]
    bpp = channels * bitdepth // 8
    stride = w * bpp
    out = bytearray(w * h * bpp)
    prev = bytearray(stride)
    p = 0
    for y in range(h):
        f = raw[p]
        p += 1
        line = bytearray(raw[p:p + stride])
        p += stride
        if f == 1:
            for i in range(bpp, stride):
                line[i] = (line[i] + line[i - bpp]) & 0xFF
        elif f == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 0xFF
        elif f == 3:
            for i in range(stride):
                a = line[i - bpp] if i >= bpp else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 0xFF
        elif f == 4:
            for i in range(stride):
                a = line[i - bpp] if i >= bpp else 0
                b = prev[i]
                c = prev[i - bpp] if i >= bpp else 0
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 0xFF
        out[y * stride:(y + 1) * stride] = line
        prev = line
    return w, h, bpp, bytes(out)


def png_encode(w, h, rgba):
    raw = bytearray()
    stride = w * 4
    for y in range(h):
        raw.append(0)
        raw += rgba[y * stride:(y + 1) * stride]
    comp = zlib.compress(bytes(raw), 9)

    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xFFFFFFFF)

    ihdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) +
            chunk(b'IDAT', comp) + chunk(b'IEND', b''))


def resize_box(w, h, bpp, src, nw, nh):
    """盒式重采样（面积平均），保证小尺寸下的边缘质量"""
    out = bytearray(nw * nh * 4)
    for y in range(nh):
        y0 = y * h // nh
        y1 = max(y0 + 1, (y + 1) * h // nh)
        for x in range(nw):
            x0 = x * w // nw
            x1 = max(x0 + 1, (x + 1) * w // nw)
            rs = gs = bs = as_ = cnt = 0
            for sy in range(y0, y1):
                for sx in range(x0, x1):
                    o = (sy * w + sx) * bpp
                    if bpp == 4:
                        r, g, b, a = src[o], src[o + 1], src[o + 2], src[o + 3]
                    elif bpp == 3:
                        r, g, b = src[o], src[o + 1], src[o + 2]
                        a = 255
                    else:
                        r = g = b = src[o]
                        a = 255
                    # 预乘 alpha 后再平均，避免边缘发黑
                    rs += r * a
                    gs += g * a
                    bs += b * a
                    as_ += a
                    cnt += 1
            o = (y * nw + x) * 4
            if as_ > 0:
                out[o] = min(255, rs // as_)
                out[o + 1] = min(255, gs // as_)
                out[o + 2] = min(255, bs // as_)
            out[o + 3] = as_ // cnt
    return bytes(out)


def build_ico(src_png, out_ico, sizes):
    data = open(src_png, 'rb').read()
    w, h, bpp, pixels = png_decode(data)
    entries = []
    for s in sizes:
        if s == w and s == h:
            img = data
        else:
            rgba = resize_box(w, h, bpp, pixels, s, s)
            img = png_encode(s, s, rgba)
        entries.append((s, img))

    n = len(entries)
    header = struct.pack('<HHH', 0, 1, n)
    offset = 6 + 16 * n
    dirs = b''
    blob = b''
    for s, img in entries:
        dim = 0 if s >= 256 else s
        dirs += struct.pack('<BBBBHHII', dim, dim, 0, 0, 1, 32, len(img), offset)
        offset += len(img)
        blob += img
    open(out_ico, 'wb').write(header + dirs + blob)
    print('wrote', out_ico, len(header + dirs + blob), 'bytes,', n, 'sizes:', sizes)


if __name__ == '__main__':
    src = sys.argv[1] if len(sys.argv) > 1 else 'build/icon-256.png'
    out = sys.argv[2] if len(sys.argv) > 2 else 'build/icon.ico'
    build_ico(src, out, [16, 20, 24, 32, 40, 48, 64, 128, 256])
