# Adds PowerPoint slide transitions: a "push" for section dividers, a fade for content slides.
import sys, zipfile, re, shutil
src = sys.argv[1]; tmp = src + ".tmp"
zin = zipfile.ZipFile(src); zout = zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED)
for item in zin.infolist():
    data = zin.read(item.filename)
    if re.match(r"ppt/slides/slide\d+\.xml$", item.filename):
        x = data.decode("utf8")
        if "<p:transition" not in x:
            divider = 'r:id' in x and 'slideLayout' in x  # placeholder, refined below
            rels = zin.read(item.filename.replace("slides/", "slides/_rels/") + ".rels").decode("utf8")
            m = re.search(r'slideLayout(\d+)\.xml', rels)
            layout = zin.read("ppt/slideLayouts/slideLayout%s.xml" % m.group(1)).decode("utf8") if m else ""
            is_div = 'name="Section"' in layout
            tr = '<p:transition spd="slow"><p:push dir="u"/></p:transition>' if is_div else '<p:transition spd="med"><p:fade/></p:transition>'
            x = x.replace("</p:clrMapOvr>", "</p:clrMapOvr>" + tr, 1)
        data = x.encode("utf8")
    zout.writestr(item, data)
zout.close(); shutil.move(tmp, src); print("transitions added")
