// «نقطة الغيمة»: ثلاث دوائر متداخلة بقاعدة مستوية — العنصر المميز للهوية
// cx,base: مركز القاعدة؛ s: المقياس (عرض تقريبي = 3.1s)
export function cloudPath(cx, base, s, { r1 = 0.62, r2 = 0.86, r3 = 0.7, gap1 = 0.78, gap3 = 0.82 } = {}) {
  const R1 = r1 * s, R2 = r2 * s, R3 = r3 * s
  const c1 = [cx - gap1 * s, base - R1], c2 = [cx, base - R2 - 0.18 * s], c3 = [cx + gap3 * s, base - R3]
  const inter = (a, ra, b, rb, upper = true) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy)
    const l = (ra * ra - rb * rb + d * d) / (2 * d), h = Math.sqrt(Math.max(0, ra * ra - l * l))
    const mx = a[0] + (l * dx) / d, my = a[1] + (l * dy) / d
    const p1 = [mx + (h * dy) / d, my - (h * dx) / d], p2 = [mx - (h * dy) / d, my + (h * dx) / d]
    return (upper ? (p1[1] < p2[1] ? p1 : p2) : (p1[1] < p2[1] ? p2 : p1))
  }
  const i12 = inter(c1, R1, c2, R2), i23 = inter(c2, R2, c3, R3)
  const f = (n) => +n.toFixed(2)
  const b1 = [c1[0], base], b3 = [c3[0], base]
  // يبدأ من أسفل الدائرة اليسرى، يدور مع عقارب الساعة على الحافة العليا
  return `M${f(b1[0])} ${f(b1[1])} A${f(R1)} ${f(R1)} 0 0 1 ${f(i12[0])} ${f(i12[1])} A${f(R2)} ${f(R2)} 0 0 1 ${f(i23[0])} ${f(i23[1])} A${f(R3)} ${f(R3)} 0 0 1 ${f(b3[0])} ${f(b3[1])} Z`
}
