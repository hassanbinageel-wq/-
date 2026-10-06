"""نسخة Python من قواعد f_harmCheck (Gartley/Bat) — فحص النسب والسماح فقط."""
TOL, TOLP = 0.03, 0.05
def classify(x, a, b, c, d, atr=1.0, min_xa=3.0):
    bull = d < c
    xa, ab, bc, cd = abs(a-x), abs(a-b), abs(c-b), abs(c-d)
    shape = (a > x and b < a and b > x and c > b and c < a and d < c and d > x) if bull else \
            (a < x and b > a and b < x and c < b and c > a and d > c and d < x)
    if not (shape and xa >= min_xa*atr and ab > 0 and bc > 0): return None
    rB, rC, rD, rP = ab/xa, bc/ab, abs(a-d)/xa, cd/bc
    cOK = 0.382-TOL <= rC <= 0.886+TOL
    if abs(rB-0.618) <= TOL and cOK and abs(rD-0.786) <= TOL and 1.13-TOLP <= rP <= 1.618+TOLP: return 'Gartley'
    if 0.382-TOL <= rB <= 0.50+TOL and cOK and abs(rD-0.886) <= TOL and 1.618-TOLP <= rP <= 2.618+TOLP: return 'Bat'
    return None

def build(x, xa, rB, rC, rD, bull=True):
    s = 1 if bull else -1
    a = x + s*xa; b = a - s*rB*xa; c = b + s*rC*rB*xa; d = a - s*rD*xa
    return x, a, b, c, d

def test_gartley_bull():  assert classify(*build(100, 10, 0.618, 0.618, 0.786)) == 'Gartley'
def test_gartley_bear():  assert classify(*build(100, 10, 0.618, 0.618, 0.786, bull=False)) == 'Gartley'
def test_bat_bull():      assert classify(*build(100, 10, 0.45, 0.618, 0.886)) == 'Bat'
def test_bat_bear():      assert classify(*build(100, 10, 0.45, 0.618, 0.886, bull=False)) == 'Bat'
def test_reject_b_off():  assert classify(*build(100, 10, 0.70, 0.618, 0.786)) is None
def test_reject_d_off():  assert classify(*build(100, 10, 0.618, 0.618, 0.70)) is None
def test_reject_small():  assert classify(*build(100, 2, 0.618, 0.618, 0.786)) is None
def test_reject_beyond_x(): assert classify(*build(100, 10, 0.45, 0.5, 1.05)) is None
def test_reject_bc_projection(): assert classify(*build(100, 10, 0.45, 0.5, 0.886)) is None  # BC proj 2.94 > 2.668

if __name__ == '__main__':
    n = 0
    for k, f in list(globals().items()):
        if k.startswith('test_'): f(); n += 1; print('PASS', k)
    print(f'{n} tests passed')
