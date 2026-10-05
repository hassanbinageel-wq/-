# يوحّد المسارات المتداخلة (حروف الخط + الغيمة) إلى مسار نظيف واحد بدون تداخل
import json, sys
import pathops
from fontTools.svgLib.path import parse_path
from fontTools.pens.svgPathPen import SVGPathPen

def union(d):
    p = pathops.Path()
    pen = p.getPen()
    parse_path(d, pen)
    out = pathops.op(p, pathops.Path(), pathops.PathOp.UNION, fix_winding=True)
    sp = SVGPathPen(None, ntos=lambda v: ('%.2f' % v).rstrip('0').rstrip('.'))
    out.draw(sp)
    b = out.bounds
    return sp.getCommands(), list(b)

data = json.load(sys.stdin)
res = {}
for k, d in data.items():
    cmds, b = union(d)
    res[k] = {'d': cmds, 'bounds': b}
json.dump(res, sys.stdout)
