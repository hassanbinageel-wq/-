# pptxgenjs writes an extra <a:pPr> before every run that carries paragraph options, so a bulleted
# paragraph made of several runs ends up with pPr elements in the middle of it (invalid, and
# PowerPoint/LibreOffice split or drop the bullet). Keep only the pPr that opens each paragraph.
import sys, zipfile, re, shutil
src = sys.argv[1]; tmp = src + ".tmp"
PPR = re.compile(r'<a:pPr\b[^>]*?(?:/>|>.*?</a:pPr>)', re.S)
def fix_par(m):
    p = m.group(0)
    head = re.match(r'<a:p>(<a:pPr\b[^>]*?(?:/>|>.*?</a:pPr>))?', p, re.S)
    keep = head.group(1) or ""
    rest = p[len("<a:p>") + len(keep):]
    return "<a:p>" + keep + PPR.sub("", rest)
zin = zipfile.ZipFile(src); zout = zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED); n = 0
for item in zin.infolist():
    data = zin.read(item.filename)
    if re.match(r"ppt/slides/slide\d+\.xml$", item.filename):
        x = data.decode("utf8")
        y = re.sub(r'<a:p>.*?</a:p>', fix_par, x, flags=re.S)
        n += x != y
        data = y.encode("utf8")
    zout.writestr(item, data)
zout.close(); shutil.move(tmp, src); print("paragraph properties fixed on", n, "slides")
