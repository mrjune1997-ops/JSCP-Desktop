// tests/core.test.mts
import assert from "node:assert/strict";

// node_modules/decimal.js/decimal.mjs
var EXP_LIMIT = 9e15;
var MAX_DIGITS = 1e9;
var NUMERALS = "0123456789abcdef";
var LN10 = "2.3025850929940456840179914546843642076011014886287729760333279009675726096773524802359972050895982983419677840422862486334095254650828067566662873690987816894829072083255546808437998948262331985283935053089653777326288461633662222876982198867465436674744042432743651550489343149393914796194044002221051017141748003688084012647080685567743216228355220114804663715659121373450747856947683463616792101806445070648000277502684916746550586856935673420670581136429224554405758925724208241314695689016758940256776311356919292033376587141660230105703089634572075440370847469940168269282808481184289314848524948644871927809676271275775397027668605952496716674183485704422507197965004714951050492214776567636938662976979522110718264549734772662425709429322582798502585509785265383207606726317164309505995087807523710333101197857547331541421808427543863591778117054309827482385045648019095610299291824318237525357709750539565187697510374970888692180205189339507238539205144634197265287286965110862571492198849978748873771345686209167058";
var PI = "3.1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679821480865132823066470938446095505822317253594081284811174502841027019385211055596446229489549303819644288109756659334461284756482337867831652712019091456485669234603486104543266482133936072602491412737245870066063155881748815209209628292540917153643678925903600113305305488204665213841469519415116094330572703657595919530921861173819326117931051185480744623799627495673518857527248912279381830119491298336733624406566430860213949463952247371907021798609437027705392171762931767523846748184676694051320005681271452635608277857713427577896091736371787214684409012249534301465495853710507922796892589235420199561121290219608640344181598136297747713099605187072113499999983729780499510597317328160963185950244594553469083026425223082533446850352619311881710100031378387528865875332083814206171776691473035982534904287554687311595628638823537875937519577818577805321712268066130019278766111959092164201989380952572010654858632789";
var DEFAULTS = {
  // These values must be integers within the stated ranges (inclusive).
  // Most of these values can be changed at run-time using the `Decimal.config` method.
  // The maximum number of significant digits of the result of a calculation or base conversion.
  // E.g. `Decimal.config({ precision: 20 });`
  precision: 20,
  // 1 to MAX_DIGITS
  // The rounding mode used when rounding to `precision`.
  //
  // ROUND_UP         0 Away from zero.
  // ROUND_DOWN       1 Towards zero.
  // ROUND_CEIL       2 Towards +Infinity.
  // ROUND_FLOOR      3 Towards -Infinity.
  // ROUND_HALF_UP    4 Towards nearest neighbour. If equidistant, up.
  // ROUND_HALF_DOWN  5 Towards nearest neighbour. If equidistant, down.
  // ROUND_HALF_EVEN  6 Towards nearest neighbour. If equidistant, towards even neighbour.
  // ROUND_HALF_CEIL  7 Towards nearest neighbour. If equidistant, towards +Infinity.
  // ROUND_HALF_FLOOR 8 Towards nearest neighbour. If equidistant, towards -Infinity.
  //
  // E.g.
  // `Decimal.rounding = 4;`
  // `Decimal.rounding = Decimal.ROUND_HALF_UP;`
  rounding: 4,
  // 0 to 8
  // The modulo mode used when calculating the modulus: a mod n.
  // The quotient (q = a / n) is calculated according to the corresponding rounding mode.
  // The remainder (r) is calculated as: r = a - n * q.
  //
  // UP         0 The remainder is positive if the dividend is negative, else is negative.
  // DOWN       1 The remainder has the same sign as the dividend (JavaScript %).
  // FLOOR      3 The remainder has the same sign as the divisor (Python %).
  // HALF_EVEN  6 The IEEE 754 remainder function.
  // EUCLID     9 Euclidian division. q = sign(n) * floor(a / abs(n)). Always positive.
  //
  // Truncated division (1), floored division (3), the IEEE 754 remainder (6), and Euclidian
  // division (9) are commonly used for the modulus operation. The other rounding modes can also
  // be used, but they may not give useful results.
  modulo: 1,
  // 0 to 9
  // The exponent value at and beneath which `toString` returns exponential notation.
  // JavaScript numbers: -7
  toExpNeg: -7,
  // 0 to -EXP_LIMIT
  // The exponent value at and above which `toString` returns exponential notation.
  // JavaScript numbers: 21
  toExpPos: 21,
  // 0 to EXP_LIMIT
  // The minimum exponent value, beneath which underflow to zero occurs.
  // JavaScript numbers: -324  (5e-324)
  minE: -EXP_LIMIT,
  // -1 to -EXP_LIMIT
  // The maximum exponent value, above which overflow to Infinity occurs.
  // JavaScript numbers: 308  (1.7976931348623157e+308)
  maxE: EXP_LIMIT,
  // 1 to EXP_LIMIT
  // Whether to use cryptographically-secure random number generation, if available.
  crypto: false
  // true/false
};
var inexact;
var quadrant;
var external = true;
var decimalError = "[DecimalError] ";
var invalidArgument = decimalError + "Invalid argument: ";
var precisionLimitExceeded = decimalError + "Precision limit exceeded";
var cryptoUnavailable = decimalError + "crypto unavailable";
var tag = "[object Decimal]";
var mathfloor = Math.floor;
var mathpow = Math.pow;
var isBinary = /^0b([01]+(\.[01]*)?|\.[01]+)(p[+-]?\d+)?$/i;
var isHex = /^0x([0-9a-f]+(\.[0-9a-f]*)?|\.[0-9a-f]+)(p[+-]?\d+)?$/i;
var isOctal = /^0o([0-7]+(\.[0-7]*)?|\.[0-7]+)(p[+-]?\d+)?$/i;
var isDecimal = /^(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i;
var BASE = 1e7;
var LOG_BASE = 7;
var MAX_SAFE_INTEGER = 9007199254740991;
var LN10_PRECISION = LN10.length - 1;
var PI_PRECISION = PI.length - 1;
var P = { toStringTag: tag };
P.absoluteValue = P.abs = function() {
  var x = new this.constructor(this);
  if (x.s < 0) x.s = 1;
  return finalise(x);
};
P.ceil = function() {
  return finalise(new this.constructor(this), this.e + 1, 2);
};
P.clampedTo = P.clamp = function(min2, max2) {
  var k, x = this, Ctor = x.constructor;
  min2 = new Ctor(min2);
  max2 = new Ctor(max2);
  if (!min2.s || !max2.s) return new Ctor(NaN);
  if (min2.gt(max2)) throw Error(invalidArgument + max2);
  k = x.cmp(min2);
  return k < 0 ? min2 : x.cmp(max2) > 0 ? max2 : new Ctor(x);
};
P.comparedTo = P.cmp = function(y) {
  var i, j, xdL, ydL, x = this, xd = x.d, yd = (y = new x.constructor(y)).d, xs = x.s, ys = y.s;
  if (!xd || !yd) {
    return !xs || !ys ? NaN : xs !== ys ? xs : xd === yd ? 0 : !xd ^ xs < 0 ? 1 : -1;
  }
  if (!xd[0] || !yd[0]) return xd[0] ? xs : yd[0] ? -ys : 0;
  if (xs !== ys) return xs;
  if (x.e !== y.e) return x.e > y.e ^ xs < 0 ? 1 : -1;
  xdL = xd.length;
  ydL = yd.length;
  for (i = 0, j = xdL < ydL ? xdL : ydL; i < j; ++i) {
    if (xd[i] !== yd[i]) return xd[i] > yd[i] ^ xs < 0 ? 1 : -1;
  }
  return xdL === ydL ? 0 : xdL > ydL ^ xs < 0 ? 1 : -1;
};
P.cosine = P.cos = function() {
  var pr, rm, x = this, Ctor = x.constructor;
  if (!x.d) return new Ctor(NaN);
  if (!x.d[0]) return new Ctor(1);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + Math.max(x.e, x.sd()) + LOG_BASE;
  Ctor.rounding = 1;
  x = cosine(Ctor, toLessThanHalfPi(Ctor, x));
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return finalise(quadrant == 2 || quadrant == 3 ? x.neg() : x, pr, rm, true);
};
P.cubeRoot = P.cbrt = function() {
  var e, m, n, r, rep, s, sd, t, t3, t3plusx, x = this, Ctor = x.constructor;
  if (!x.isFinite() || x.isZero()) return new Ctor(x);
  external = false;
  s = x.s * mathpow(x.s * x, 1 / 3);
  if (!s || Math.abs(s) == 1 / 0) {
    n = digitsToString(x.d);
    e = x.e;
    if (s = (e - n.length + 1) % 3) n += s == 1 || s == -2 ? "0" : "00";
    s = mathpow(n, 1 / 3);
    e = mathfloor((e + 1) / 3) - (e % 3 == (e < 0 ? -1 : 2));
    if (s == 1 / 0) {
      n = "5e" + e;
    } else {
      n = s.toExponential();
      n = n.slice(0, n.indexOf("e") + 1) + e;
    }
    r = new Ctor(n);
    r.s = x.s;
  } else {
    r = new Ctor(s.toString());
  }
  sd = (e = Ctor.precision) + 3;
  for (; ; ) {
    t = r;
    t3 = t.times(t).times(t);
    t3plusx = t3.plus(x);
    r = divide(t3plusx.plus(x).times(t), t3plusx.plus(t3), sd + 2, 1);
    if (digitsToString(t.d).slice(0, sd) === (n = digitsToString(r.d)).slice(0, sd)) {
      n = n.slice(sd - 3, sd + 1);
      if (n == "9999" || !rep && n == "4999") {
        if (!rep) {
          finalise(t, e + 1, 0);
          if (t.times(t).times(t).eq(x)) {
            r = t;
            break;
          }
        }
        sd += 4;
        rep = 1;
      } else {
        if (!+n || !+n.slice(1) && n.charAt(0) == "5") {
          finalise(r, e + 1, 1);
          m = !r.times(r).times(r).eq(x);
        }
        break;
      }
    }
  }
  external = true;
  return finalise(r, e, Ctor.rounding, m);
};
P.decimalPlaces = P.dp = function() {
  var w, d = this.d, n = NaN;
  if (d) {
    w = d.length - 1;
    n = (w - mathfloor(this.e / LOG_BASE)) * LOG_BASE;
    w = d[w];
    if (w) for (; w % 10 == 0; w /= 10) n--;
    if (n < 0) n = 0;
  }
  return n;
};
P.dividedBy = P.div = function(y) {
  return divide(this, new this.constructor(y));
};
P.dividedToIntegerBy = P.divToInt = function(y) {
  var x = this, Ctor = x.constructor;
  return finalise(divide(x, new Ctor(y), 0, 1, 1), Ctor.precision, Ctor.rounding);
};
P.equals = P.eq = function(y) {
  return this.cmp(y) === 0;
};
P.floor = function() {
  return finalise(new this.constructor(this), this.e + 1, 3);
};
P.greaterThan = P.gt = function(y) {
  return this.cmp(y) > 0;
};
P.greaterThanOrEqualTo = P.gte = function(y) {
  var k = this.cmp(y);
  return k == 1 || k === 0;
};
P.hyperbolicCosine = P.cosh = function() {
  var k, n, pr, rm, len, x = this, Ctor = x.constructor, one = new Ctor(1);
  if (!x.isFinite()) return new Ctor(x.s ? 1 / 0 : NaN);
  if (x.isZero()) return one;
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + Math.max(x.e, x.sd()) + 4;
  Ctor.rounding = 1;
  len = x.d.length;
  if (len < 32) {
    k = Math.ceil(len / 3);
    n = (1 / tinyPow(4, k)).toString();
  } else {
    k = 16;
    n = "2.3283064365386962890625e-10";
  }
  x = taylorSeries(Ctor, 1, x.times(n), new Ctor(1), true);
  var cosh2_x, i = k, d8 = new Ctor(8);
  for (; i--; ) {
    cosh2_x = x.times(x);
    x = one.minus(cosh2_x.times(d8.minus(cosh2_x.times(d8))));
  }
  return finalise(x, Ctor.precision = pr, Ctor.rounding = rm, true);
};
P.hyperbolicSine = P.sinh = function() {
  var k, pr, rm, len, x = this, Ctor = x.constructor;
  if (!x.isFinite() || x.isZero()) return new Ctor(x);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + Math.max(x.e, x.sd()) + 4;
  Ctor.rounding = 1;
  len = x.d.length;
  if (len < 3) {
    x = taylorSeries(Ctor, 2, x, x, true);
  } else {
    k = 1.4 * Math.sqrt(len);
    k = k > 16 ? 16 : k | 0;
    x = x.times(1 / tinyPow(5, k));
    x = taylorSeries(Ctor, 2, x, x, true);
    var sinh2_x, d5 = new Ctor(5), d16 = new Ctor(16), d20 = new Ctor(20);
    for (; k--; ) {
      sinh2_x = x.times(x);
      x = x.times(d5.plus(sinh2_x.times(d16.times(sinh2_x).plus(d20))));
    }
  }
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return finalise(x, pr, rm, true);
};
P.hyperbolicTangent = P.tanh = function() {
  var pr, rm, x = this, Ctor = x.constructor;
  if (!x.isFinite()) return new Ctor(x.s);
  if (x.isZero()) return new Ctor(x);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + 7;
  Ctor.rounding = 1;
  return divide(x.sinh(), x.cosh(), Ctor.precision = pr, Ctor.rounding = rm);
};
P.inverseCosine = P.acos = function() {
  var x = this, Ctor = x.constructor, k = x.abs().cmp(1), pr = Ctor.precision, rm = Ctor.rounding;
  if (k !== -1) {
    return k === 0 ? x.isNeg() ? getPi(Ctor, pr, rm) : new Ctor(0) : new Ctor(NaN);
  }
  if (x.isZero()) return getPi(Ctor, pr + 4, rm).times(0.5);
  Ctor.precision = pr + 6;
  Ctor.rounding = 1;
  x = new Ctor(1).minus(x).div(x.plus(1)).sqrt().atan();
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return x.times(2);
};
P.inverseHyperbolicCosine = P.acosh = function() {
  var pr, rm, x = this, Ctor = x.constructor;
  if (x.lte(1)) return new Ctor(x.eq(1) ? 0 : NaN);
  if (!x.isFinite()) return new Ctor(x);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + Math.max(Math.abs(x.e), x.sd()) + 4;
  Ctor.rounding = 1;
  external = false;
  x = x.times(x).minus(1).sqrt().plus(x);
  external = true;
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return x.ln();
};
P.inverseHyperbolicSine = P.asinh = function() {
  var pr, rm, x = this, Ctor = x.constructor;
  if (!x.isFinite() || x.isZero()) return new Ctor(x);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + 2 * Math.max(Math.abs(x.e), x.sd()) + 6;
  Ctor.rounding = 1;
  external = false;
  x = x.times(x).plus(1).sqrt().plus(x);
  external = true;
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return x.ln();
};
P.inverseHyperbolicTangent = P.atanh = function() {
  var pr, rm, wpr, xsd, x = this, Ctor = x.constructor;
  if (!x.isFinite()) return new Ctor(NaN);
  if (x.e >= 0) return new Ctor(x.abs().eq(1) ? x.s / 0 : x.isZero() ? x : NaN);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  xsd = x.sd();
  if (Math.max(xsd, pr) < 2 * -x.e - 1) return finalise(new Ctor(x), pr, rm, true);
  Ctor.precision = wpr = xsd - x.e;
  x = divide(x.plus(1), new Ctor(1).minus(x), wpr + pr, 1);
  Ctor.precision = pr + 4;
  Ctor.rounding = 1;
  x = x.ln();
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return x.times(0.5);
};
P.inverseSine = P.asin = function() {
  var halfPi, k, pr, rm, x = this, Ctor = x.constructor;
  if (x.isZero()) return new Ctor(x);
  k = x.abs().cmp(1);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  if (k !== -1) {
    if (k === 0) {
      halfPi = getPi(Ctor, pr + 4, rm).times(0.5);
      halfPi.s = x.s;
      return halfPi;
    }
    return new Ctor(NaN);
  }
  Ctor.precision = pr + 6;
  Ctor.rounding = 1;
  x = x.div(new Ctor(1).minus(x.times(x)).sqrt().plus(1)).atan();
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return x.times(2);
};
P.inverseTangent = P.atan = function() {
  var i, j, k, n, px, t, r, wpr, x2, x = this, Ctor = x.constructor, pr = Ctor.precision, rm = Ctor.rounding;
  if (!x.isFinite()) {
    if (!x.s) return new Ctor(NaN);
    if (pr + 4 <= PI_PRECISION) {
      r = getPi(Ctor, pr + 4, rm).times(0.5);
      r.s = x.s;
      return r;
    }
  } else if (x.isZero()) {
    return new Ctor(x);
  } else if (x.abs().eq(1) && pr + 4 <= PI_PRECISION) {
    r = getPi(Ctor, pr + 4, rm).times(0.25);
    r.s = x.s;
    return r;
  }
  Ctor.precision = wpr = pr + 10;
  Ctor.rounding = 1;
  k = Math.min(28, wpr / LOG_BASE + 2 | 0);
  for (i = k; i; --i) x = x.div(x.times(x).plus(1).sqrt().plus(1));
  external = false;
  j = Math.ceil(wpr / LOG_BASE);
  n = 1;
  x2 = x.times(x);
  r = new Ctor(x);
  px = x;
  for (; i !== -1; ) {
    px = px.times(x2);
    t = r.minus(px.div(n += 2));
    px = px.times(x2);
    r = t.plus(px.div(n += 2));
    if (r.d[j] !== void 0) for (i = j; r.d[i] === t.d[i] && i--; ) ;
  }
  if (k) r = r.times(2 << k - 1);
  external = true;
  return finalise(r, Ctor.precision = pr, Ctor.rounding = rm, true);
};
P.isFinite = function() {
  return !!this.d;
};
P.isInteger = P.isInt = function() {
  return !!this.d && mathfloor(this.e / LOG_BASE) > this.d.length - 2;
};
P.isNaN = function() {
  return !this.s;
};
P.isNegative = P.isNeg = function() {
  return this.s < 0;
};
P.isPositive = P.isPos = function() {
  return this.s > 0;
};
P.isZero = function() {
  return !!this.d && this.d[0] === 0;
};
P.lessThan = P.lt = function(y) {
  return this.cmp(y) < 0;
};
P.lessThanOrEqualTo = P.lte = function(y) {
  return this.cmp(y) < 1;
};
P.logarithm = P.log = function(base) {
  var isBase10, d, denominator, k, inf, num, sd, r, arg = this, Ctor = arg.constructor, pr = Ctor.precision, rm = Ctor.rounding, guard = 5;
  if (base == null) {
    base = new Ctor(10);
    isBase10 = true;
  } else {
    base = new Ctor(base);
    d = base.d;
    if (base.s < 0 || !d || !d[0] || base.eq(1)) return new Ctor(NaN);
    isBase10 = base.eq(10);
  }
  d = arg.d;
  if (arg.s < 0 || !d || !d[0] || arg.eq(1)) {
    return new Ctor(d && !d[0] ? -1 / 0 : arg.s != 1 ? NaN : d ? 0 : 1 / 0);
  }
  if (isBase10) {
    if (d.length > 1) {
      inf = true;
    } else {
      for (k = d[0]; k % 10 === 0; ) k /= 10;
      inf = k !== 1;
    }
  }
  external = false;
  sd = pr + guard;
  num = naturalLogarithm(arg, sd);
  denominator = isBase10 ? getLn10(Ctor, sd + 10) : naturalLogarithm(base, sd);
  r = divide(num, denominator, sd, 1);
  if (checkRoundingDigits(r.d, k = pr, rm)) {
    do {
      sd += 10;
      num = naturalLogarithm(arg, sd);
      denominator = isBase10 ? getLn10(Ctor, sd + 10) : naturalLogarithm(base, sd);
      r = divide(num, denominator, sd, 1);
      if (!inf) {
        if (+digitsToString(r.d).slice(k + 1, k + 15) + 1 == 1e14) {
          r = finalise(r, pr + 1, 0);
        }
        break;
      }
    } while (checkRoundingDigits(r.d, k += 10, rm));
  }
  external = true;
  return finalise(r, pr, rm);
};
P.minus = P.sub = function(y) {
  var d, e, i, j, k, len, pr, rm, xd, xe, xLTy, yd, x = this, Ctor = x.constructor;
  y = new Ctor(y);
  if (!x.d || !y.d) {
    if (!x.s || !y.s) y = new Ctor(NaN);
    else if (x.d) y.s = -y.s;
    else y = new Ctor(y.d || x.s !== y.s ? x : NaN);
    return y;
  }
  if (x.s != y.s) {
    y.s = -y.s;
    return x.plus(y);
  }
  xd = x.d;
  yd = y.d;
  pr = Ctor.precision;
  rm = Ctor.rounding;
  if (!xd[0] || !yd[0]) {
    if (yd[0]) y.s = -y.s;
    else if (xd[0]) y = new Ctor(x);
    else return new Ctor(rm === 3 ? -0 : 0);
    return external ? finalise(y, pr, rm) : y;
  }
  e = mathfloor(y.e / LOG_BASE);
  xe = mathfloor(x.e / LOG_BASE);
  xd = xd.slice();
  k = xe - e;
  if (k) {
    xLTy = k < 0;
    if (xLTy) {
      d = xd;
      k = -k;
      len = yd.length;
    } else {
      d = yd;
      e = xe;
      len = xd.length;
    }
    i = Math.max(Math.ceil(pr / LOG_BASE), len) + 2;
    if (k > i) {
      k = i;
      d.length = 1;
    }
    d.reverse();
    for (i = k; i--; ) d.push(0);
    d.reverse();
  } else {
    i = xd.length;
    len = yd.length;
    xLTy = i < len;
    if (xLTy) len = i;
    for (i = 0; i < len; i++) {
      if (xd[i] != yd[i]) {
        xLTy = xd[i] < yd[i];
        break;
      }
    }
    k = 0;
  }
  if (xLTy) {
    d = xd;
    xd = yd;
    yd = d;
    y.s = -y.s;
  }
  len = xd.length;
  for (i = yd.length - len; i > 0; --i) xd[len++] = 0;
  for (i = yd.length; i > k; ) {
    if (xd[--i] < yd[i]) {
      for (j = i; j && xd[--j] === 0; ) xd[j] = BASE - 1;
      --xd[j];
      xd[i] += BASE;
    }
    xd[i] -= yd[i];
  }
  for (; xd[--len] === 0; ) xd.pop();
  for (; xd[0] === 0; xd.shift()) --e;
  if (!xd[0]) return new Ctor(rm === 3 ? -0 : 0);
  y.d = xd;
  y.e = getBase10Exponent(xd, e);
  return external ? finalise(y, pr, rm) : y;
};
P.modulo = P.mod = function(y) {
  var q, x = this, Ctor = x.constructor;
  y = new Ctor(y);
  if (!x.d || !y.s || y.d && !y.d[0]) return new Ctor(NaN);
  if (!y.d || x.d && !x.d[0]) {
    return finalise(new Ctor(x), Ctor.precision, Ctor.rounding);
  }
  external = false;
  if (Ctor.modulo == 9) {
    q = divide(x, y.abs(), 0, 3, 1);
    q.s *= y.s;
  } else {
    q = divide(x, y, 0, Ctor.modulo, 1);
  }
  q = q.times(y);
  external = true;
  return x.minus(q);
};
P.naturalExponential = P.exp = function() {
  return naturalExponential(this);
};
P.naturalLogarithm = P.ln = function() {
  return naturalLogarithm(this);
};
P.negated = P.neg = function() {
  var x = new this.constructor(this);
  x.s = -x.s;
  return finalise(x);
};
P.plus = P.add = function(y) {
  var carry, d, e, i, k, len, pr, rm, xd, yd, x = this, Ctor = x.constructor;
  y = new Ctor(y);
  if (!x.d || !y.d) {
    if (!x.s || !y.s) y = new Ctor(NaN);
    else if (!x.d) y = new Ctor(y.d || x.s === y.s ? x : NaN);
    return y;
  }
  if (x.s != y.s) {
    y.s = -y.s;
    return x.minus(y);
  }
  xd = x.d;
  yd = y.d;
  pr = Ctor.precision;
  rm = Ctor.rounding;
  if (!xd[0] || !yd[0]) {
    if (!yd[0]) y = new Ctor(x);
    return external ? finalise(y, pr, rm) : y;
  }
  k = mathfloor(x.e / LOG_BASE);
  e = mathfloor(y.e / LOG_BASE);
  xd = xd.slice();
  i = k - e;
  if (i) {
    if (i < 0) {
      d = xd;
      i = -i;
      len = yd.length;
    } else {
      d = yd;
      e = k;
      len = xd.length;
    }
    k = Math.ceil(pr / LOG_BASE);
    len = k > len ? k + 1 : len + 1;
    if (i > len) {
      i = len;
      d.length = 1;
    }
    d.reverse();
    for (; i--; ) d.push(0);
    d.reverse();
  }
  len = xd.length;
  i = yd.length;
  if (len - i < 0) {
    i = len;
    d = yd;
    yd = xd;
    xd = d;
  }
  for (carry = 0; i; ) {
    carry = (xd[--i] = xd[i] + yd[i] + carry) / BASE | 0;
    xd[i] %= BASE;
  }
  if (carry) {
    xd.unshift(carry);
    ++e;
  }
  for (len = xd.length; xd[--len] == 0; ) xd.pop();
  y.d = xd;
  y.e = getBase10Exponent(xd, e);
  return external ? finalise(y, pr, rm) : y;
};
P.precision = P.sd = function(z) {
  var k, x = this;
  if (z !== void 0 && z !== !!z && z !== 1 && z !== 0) throw Error(invalidArgument + z);
  if (x.d) {
    k = getPrecision(x.d);
    if (z && x.e + 1 > k) k = x.e + 1;
  } else {
    k = NaN;
  }
  return k;
};
P.round = function() {
  var x = this, Ctor = x.constructor;
  return finalise(new Ctor(x), x.e + 1, Ctor.rounding);
};
P.sine = P.sin = function() {
  var pr, rm, x = this, Ctor = x.constructor;
  if (!x.isFinite()) return new Ctor(NaN);
  if (x.isZero()) return new Ctor(x);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + Math.max(x.e, x.sd()) + LOG_BASE;
  Ctor.rounding = 1;
  x = sine(Ctor, toLessThanHalfPi(Ctor, x));
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return finalise(quadrant > 2 ? x.neg() : x, pr, rm, true);
};
P.squareRoot = P.sqrt = function() {
  var m, n, sd, r, rep, t, x = this, d = x.d, e = x.e, s = x.s, Ctor = x.constructor;
  if (s !== 1 || !d || !d[0]) {
    return new Ctor(!s || s < 0 && (!d || d[0]) ? NaN : d ? x : 1 / 0);
  }
  external = false;
  s = Math.sqrt(+x);
  if (s == 0 || s == 1 / 0) {
    n = digitsToString(d);
    if ((n.length + e) % 2 == 0) n += "0";
    s = Math.sqrt(n);
    e = mathfloor((e + 1) / 2) - (e < 0 || e % 2);
    if (s == 1 / 0) {
      n = "5e" + e;
    } else {
      n = s.toExponential();
      n = n.slice(0, n.indexOf("e") + 1) + e;
    }
    r = new Ctor(n);
  } else {
    r = new Ctor(s.toString());
  }
  sd = (e = Ctor.precision) + 3;
  for (; ; ) {
    t = r;
    r = t.plus(divide(x, t, sd + 2, 1)).times(0.5);
    if (digitsToString(t.d).slice(0, sd) === (n = digitsToString(r.d)).slice(0, sd)) {
      n = n.slice(sd - 3, sd + 1);
      if (n == "9999" || !rep && n == "4999") {
        if (!rep) {
          finalise(t, e + 1, 0);
          if (t.times(t).eq(x)) {
            r = t;
            break;
          }
        }
        sd += 4;
        rep = 1;
      } else {
        if (!+n || !+n.slice(1) && n.charAt(0) == "5") {
          finalise(r, e + 1, 1);
          m = !r.times(r).eq(x);
        }
        break;
      }
    }
  }
  external = true;
  return finalise(r, e, Ctor.rounding, m);
};
P.tangent = P.tan = function() {
  var pr, rm, x = this, Ctor = x.constructor;
  if (!x.isFinite()) return new Ctor(NaN);
  if (x.isZero()) return new Ctor(x);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + 10;
  Ctor.rounding = 1;
  x = x.sin();
  x.s = 1;
  x = divide(x, new Ctor(1).minus(x.times(x)).sqrt(), pr + 10, 0);
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return finalise(quadrant == 2 || quadrant == 4 ? x.neg() : x, pr, rm, true);
};
P.times = P.mul = function(y) {
  var carry, e, i, k, r, rL, t, xdL, ydL, x = this, Ctor = x.constructor, xd = x.d, yd = (y = new Ctor(y)).d;
  y.s *= x.s;
  if (!xd || !xd[0] || !yd || !yd[0]) {
    return new Ctor(!y.s || xd && !xd[0] && !yd || yd && !yd[0] && !xd ? NaN : !xd || !yd ? y.s / 0 : y.s * 0);
  }
  e = mathfloor(x.e / LOG_BASE) + mathfloor(y.e / LOG_BASE);
  xdL = xd.length;
  ydL = yd.length;
  if (xdL < ydL) {
    r = xd;
    xd = yd;
    yd = r;
    rL = xdL;
    xdL = ydL;
    ydL = rL;
  }
  r = [];
  rL = xdL + ydL;
  for (i = rL; i--; ) r.push(0);
  for (i = ydL; --i >= 0; ) {
    carry = 0;
    for (k = xdL + i; k > i; ) {
      t = r[k] + yd[i] * xd[k - i - 1] + carry;
      r[k--] = t % BASE | 0;
      carry = t / BASE | 0;
    }
    r[k] = (r[k] + carry) % BASE | 0;
  }
  for (; !r[--rL]; ) r.pop();
  if (carry) ++e;
  else r.shift();
  y.d = r;
  y.e = getBase10Exponent(r, e);
  return external ? finalise(y, Ctor.precision, Ctor.rounding) : y;
};
P.toBinary = function(sd, rm) {
  return toStringBinary(this, 2, sd, rm);
};
P.toDecimalPlaces = P.toDP = function(dp, rm) {
  var x = this, Ctor = x.constructor;
  x = new Ctor(x);
  if (dp === void 0) return x;
  checkInt32(dp, 0, MAX_DIGITS);
  if (rm === void 0) rm = Ctor.rounding;
  else checkInt32(rm, 0, 8);
  return finalise(x, dp + x.e + 1, rm);
};
P.toExponential = function(dp, rm) {
  var str, x = this, Ctor = x.constructor;
  if (dp === void 0) {
    str = finiteToString(x, true);
  } else {
    checkInt32(dp, 0, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
    x = finalise(new Ctor(x), dp + 1, rm);
    str = finiteToString(x, true, dp + 1);
  }
  return x.isNeg() && !x.isZero() ? "-" + str : str;
};
P.toFixed = function(dp, rm) {
  var str, y, x = this, Ctor = x.constructor;
  if (dp === void 0) {
    str = finiteToString(x);
  } else {
    checkInt32(dp, 0, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
    y = finalise(new Ctor(x), dp + x.e + 1, rm);
    str = finiteToString(y, false, dp + y.e + 1);
  }
  return x.isNeg() && !x.isZero() ? "-" + str : str;
};
P.toFraction = function(maxD) {
  var d, d0, d1, d2, e, k, n, n0, n1, pr, q, r, x = this, xd = x.d, Ctor = x.constructor;
  if (!xd) return new Ctor(x);
  n1 = d0 = new Ctor(1);
  d1 = n0 = new Ctor(0);
  d = new Ctor(d1);
  e = d.e = getPrecision(xd) - x.e - 1;
  k = e % LOG_BASE;
  d.d[0] = mathpow(10, k < 0 ? LOG_BASE + k : k);
  if (maxD == null) {
    maxD = e > 0 ? d : n1;
  } else {
    n = new Ctor(maxD);
    if (!n.isInt() || n.lt(n1)) throw Error(invalidArgument + n);
    maxD = n.gt(d) ? e > 0 ? d : n1 : n;
  }
  external = false;
  n = new Ctor(digitsToString(xd));
  pr = Ctor.precision;
  Ctor.precision = e = xd.length * LOG_BASE * 2;
  for (; ; ) {
    q = divide(n, d, 0, 1, 1);
    d2 = d0.plus(q.times(d1));
    if (d2.cmp(maxD) == 1) break;
    d0 = d1;
    d1 = d2;
    d2 = n1;
    n1 = n0.plus(q.times(d2));
    n0 = d2;
    d2 = d;
    d = n.minus(q.times(d2));
    n = d2;
  }
  d2 = divide(maxD.minus(d0), d1, 0, 1, 1);
  n0 = n0.plus(d2.times(n1));
  d0 = d0.plus(d2.times(d1));
  n0.s = n1.s = x.s;
  r = divide(n1, d1, e, 1).minus(x).abs().cmp(divide(n0, d0, e, 1).minus(x).abs()) < 1 ? [n1, d1] : [n0, d0];
  Ctor.precision = pr;
  external = true;
  return r;
};
P.toHexadecimal = P.toHex = function(sd, rm) {
  return toStringBinary(this, 16, sd, rm);
};
P.toNearest = function(y, rm) {
  var x = this, Ctor = x.constructor;
  x = new Ctor(x);
  if (y == null) {
    if (!x.d) return x;
    y = new Ctor(1);
    rm = Ctor.rounding;
  } else {
    y = new Ctor(y);
    if (rm === void 0) {
      rm = Ctor.rounding;
    } else {
      checkInt32(rm, 0, 8);
    }
    if (!x.d) return y.s ? x : y;
    if (!y.d) {
      if (y.s) y.s = x.s;
      return y;
    }
  }
  if (y.d[0]) {
    external = false;
    x = divide(x, y, 0, rm, 1).times(y);
    external = true;
    finalise(x);
  } else {
    y.s = x.s;
    x = y;
  }
  return x;
};
P.toNumber = function() {
  return +this;
};
P.toOctal = function(sd, rm) {
  return toStringBinary(this, 8, sd, rm);
};
P.toPower = P.pow = function(y) {
  var e, k, pr, r, rm, s, x = this, Ctor = x.constructor, yn = +(y = new Ctor(y));
  if (!x.d || !y.d || !x.d[0] || !y.d[0]) return new Ctor(mathpow(+x, yn));
  x = new Ctor(x);
  if (x.eq(1)) return x;
  pr = Ctor.precision;
  rm = Ctor.rounding;
  if (y.eq(1)) return finalise(x, pr, rm);
  e = mathfloor(y.e / LOG_BASE);
  if (e >= y.d.length - 1 && (k = yn < 0 ? -yn : yn) <= MAX_SAFE_INTEGER) {
    r = intPow(Ctor, x, k, pr);
    return y.s < 0 ? new Ctor(1).div(r) : finalise(r, pr, rm);
  }
  s = x.s;
  if (s < 0) {
    if (e < y.d.length - 1) return new Ctor(NaN);
    if ((y.d[e] & 1) == 0) s = 1;
    if (x.e == 0 && x.d[0] == 1 && x.d.length == 1) {
      x.s = s;
      return x;
    }
  }
  k = mathpow(+x, yn);
  e = k == 0 || !isFinite(k) ? mathfloor(yn * (Math.log("0." + digitsToString(x.d)) / Math.LN10 + x.e + 1)) : new Ctor(k + "").e;
  if (e > Ctor.maxE + 1 || e < Ctor.minE - 1) return new Ctor(e > 0 ? s / 0 : 0);
  external = false;
  Ctor.rounding = x.s = 1;
  k = Math.min(12, (e + "").length);
  r = naturalExponential(y.times(naturalLogarithm(x, pr + k)), pr);
  if (r.d) {
    r = finalise(r, pr + 5, 1);
    if (checkRoundingDigits(r.d, pr, rm)) {
      e = pr + 10;
      r = finalise(naturalExponential(y.times(naturalLogarithm(x, e + k)), e), e + 5, 1);
      if (+digitsToString(r.d).slice(pr + 1, pr + 15) + 1 == 1e14) {
        r = finalise(r, pr + 1, 0);
      }
    }
  }
  r.s = s;
  external = true;
  Ctor.rounding = rm;
  return finalise(r, pr, rm);
};
P.toPrecision = function(sd, rm) {
  var str, x = this, Ctor = x.constructor;
  if (sd === void 0) {
    str = finiteToString(x, x.e <= Ctor.toExpNeg || x.e >= Ctor.toExpPos);
  } else {
    checkInt32(sd, 1, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
    x = finalise(new Ctor(x), sd, rm);
    str = finiteToString(x, sd <= x.e || x.e <= Ctor.toExpNeg, sd);
  }
  return x.isNeg() && !x.isZero() ? "-" + str : str;
};
P.toSignificantDigits = P.toSD = function(sd, rm) {
  var x = this, Ctor = x.constructor;
  if (sd === void 0) {
    sd = Ctor.precision;
    rm = Ctor.rounding;
  } else {
    checkInt32(sd, 1, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
  }
  return finalise(new Ctor(x), sd, rm);
};
P.toString = function() {
  var x = this, Ctor = x.constructor, str = finiteToString(x, x.e <= Ctor.toExpNeg || x.e >= Ctor.toExpPos);
  return x.isNeg() && !x.isZero() ? "-" + str : str;
};
P.truncated = P.trunc = function() {
  return finalise(new this.constructor(this), this.e + 1, 1);
};
P.valueOf = P.toJSON = function() {
  var x = this, Ctor = x.constructor, str = finiteToString(x, x.e <= Ctor.toExpNeg || x.e >= Ctor.toExpPos);
  return x.isNeg() ? "-" + str : str;
};
function digitsToString(d) {
  var i, k, ws, indexOfLastWord = d.length - 1, str = "", w = d[0];
  if (indexOfLastWord > 0) {
    str += w;
    for (i = 1; i < indexOfLastWord; i++) {
      ws = d[i] + "";
      k = LOG_BASE - ws.length;
      if (k) str += getZeroString(k);
      str += ws;
    }
    w = d[i];
    ws = w + "";
    k = LOG_BASE - ws.length;
    if (k) str += getZeroString(k);
  } else if (w === 0) {
    return "0";
  }
  for (; w % 10 === 0; ) w /= 10;
  return str + w;
}
function checkInt32(i, min2, max2) {
  if (i !== ~~i || i < min2 || i > max2) {
    throw Error(invalidArgument + i);
  }
}
function checkRoundingDigits(d, i, rm, repeating) {
  var di, k, r, rd;
  for (k = d[0]; k >= 10; k /= 10) --i;
  if (--i < 0) {
    i += LOG_BASE;
    di = 0;
  } else {
    di = Math.ceil((i + 1) / LOG_BASE);
    i %= LOG_BASE;
  }
  k = mathpow(10, LOG_BASE - i);
  rd = d[di] % k | 0;
  if (repeating == null) {
    if (i < 3) {
      if (i == 0) rd = rd / 100 | 0;
      else if (i == 1) rd = rd / 10 | 0;
      r = rm < 4 && rd == 99999 || rm > 3 && rd == 49999 || rd == 5e4 || rd == 0;
    } else {
      r = (rm < 4 && rd + 1 == k || rm > 3 && rd + 1 == k / 2) && (d[di + 1] / k / 100 | 0) == mathpow(10, i - 2) - 1 || (rd == k / 2 || rd == 0) && (d[di + 1] / k / 100 | 0) == 0;
    }
  } else {
    if (i < 4) {
      if (i == 0) rd = rd / 1e3 | 0;
      else if (i == 1) rd = rd / 100 | 0;
      else if (i == 2) rd = rd / 10 | 0;
      r = (repeating || rm < 4) && rd == 9999 || !repeating && rm > 3 && rd == 4999;
    } else {
      r = ((repeating || rm < 4) && rd + 1 == k || !repeating && rm > 3 && rd + 1 == k / 2) && (d[di + 1] / k / 1e3 | 0) == mathpow(10, i - 3) - 1;
    }
  }
  return r;
}
function convertBase(str, baseIn, baseOut) {
  var j, arr = [0], arrL, i = 0, strL = str.length;
  for (; i < strL; ) {
    for (arrL = arr.length; arrL--; ) arr[arrL] *= baseIn;
    arr[0] += NUMERALS.indexOf(str.charAt(i++));
    for (j = 0; j < arr.length; j++) {
      if (arr[j] > baseOut - 1) {
        if (arr[j + 1] === void 0) arr[j + 1] = 0;
        arr[j + 1] += arr[j] / baseOut | 0;
        arr[j] %= baseOut;
      }
    }
  }
  return arr.reverse();
}
function cosine(Ctor, x) {
  var k, len, y;
  if (x.isZero()) return x;
  len = x.d.length;
  if (len < 32) {
    k = Math.ceil(len / 3);
    y = (1 / tinyPow(4, k)).toString();
  } else {
    k = 16;
    y = "2.3283064365386962890625e-10";
  }
  Ctor.precision += k;
  x = taylorSeries(Ctor, 1, x.times(y), new Ctor(1));
  for (var i = k; i--; ) {
    var cos2x = x.times(x);
    x = cos2x.times(cos2x).minus(cos2x).times(8).plus(1);
  }
  Ctor.precision -= k;
  return x;
}
var divide = /* @__PURE__ */ function() {
  function multiplyInteger(x, k, base) {
    var temp, carry = 0, i = x.length;
    for (x = x.slice(); i--; ) {
      temp = x[i] * k + carry;
      x[i] = temp % base | 0;
      carry = temp / base | 0;
    }
    if (carry) x.unshift(carry);
    return x;
  }
  function compare(a, b, aL, bL) {
    var i, r;
    if (aL != bL) {
      r = aL > bL ? 1 : -1;
    } else {
      for (i = r = 0; i < aL; i++) {
        if (a[i] != b[i]) {
          r = a[i] > b[i] ? 1 : -1;
          break;
        }
      }
    }
    return r;
  }
  function subtract(a, b, aL, base) {
    var i = 0;
    for (; aL--; ) {
      a[aL] -= i;
      i = a[aL] < b[aL] ? 1 : 0;
      a[aL] = i * base + a[aL] - b[aL];
    }
    for (; !a[0] && a.length > 1; ) a.shift();
  }
  return function(x, y, pr, rm, dp, base) {
    var cmp, e, i, k, logBase, more, prod, prodL, q, qd, rem, remL, rem0, sd, t, xi, xL, yd0, yL, yz, Ctor = x.constructor, sign2 = x.s == y.s ? 1 : -1, xd = x.d, yd = y.d;
    if (!xd || !xd[0] || !yd || !yd[0]) {
      return new Ctor(
        // Return NaN if either NaN, or both Infinity or 0.
        !x.s || !y.s || (xd ? yd && xd[0] == yd[0] : !yd) ? NaN : (
          // Return ±0 if x is 0 or y is ±Infinity, or return ±Infinity as y is 0.
          xd && xd[0] == 0 || !yd ? sign2 * 0 : sign2 / 0
        )
      );
    }
    if (base) {
      logBase = 1;
      e = x.e - y.e;
    } else {
      base = BASE;
      logBase = LOG_BASE;
      e = mathfloor(x.e / logBase) - mathfloor(y.e / logBase);
    }
    yL = yd.length;
    xL = xd.length;
    q = new Ctor(sign2);
    qd = q.d = [];
    for (i = 0; yd[i] == (xd[i] || 0); i++) ;
    if (yd[i] > (xd[i] || 0)) e--;
    if (pr == null) {
      sd = pr = Ctor.precision;
      rm = Ctor.rounding;
    } else if (dp) {
      sd = pr + (x.e - y.e) + 1;
    } else {
      sd = pr;
    }
    if (sd < 0) {
      qd.push(1);
      more = true;
    } else {
      sd = sd / logBase + 2 | 0;
      i = 0;
      if (yL == 1) {
        k = 0;
        yd = yd[0];
        sd++;
        for (; (i < xL || k) && sd--; i++) {
          t = k * base + (xd[i] || 0);
          qd[i] = t / yd | 0;
          k = t % yd | 0;
        }
        more = k || i < xL;
      } else {
        k = base / (yd[0] + 1) | 0;
        if (k > 1) {
          yd = multiplyInteger(yd, k, base);
          xd = multiplyInteger(xd, k, base);
          yL = yd.length;
          xL = xd.length;
        }
        xi = yL;
        rem = xd.slice(0, yL);
        remL = rem.length;
        for (; remL < yL; ) rem[remL++] = 0;
        yz = yd.slice();
        yz.unshift(0);
        yd0 = yd[0];
        if (yd[1] >= base / 2) ++yd0;
        do {
          k = 0;
          cmp = compare(yd, rem, yL, remL);
          if (cmp < 0) {
            rem0 = rem[0];
            if (yL != remL) rem0 = rem0 * base + (rem[1] || 0);
            k = rem0 / yd0 | 0;
            if (k > 1) {
              if (k >= base) k = base - 1;
              prod = multiplyInteger(yd, k, base);
              prodL = prod.length;
              remL = rem.length;
              cmp = compare(prod, rem, prodL, remL);
              if (cmp == 1) {
                k--;
                subtract(prod, yL < prodL ? yz : yd, prodL, base);
              }
            } else {
              if (k == 0) cmp = k = 1;
              prod = yd.slice();
            }
            prodL = prod.length;
            if (prodL < remL) prod.unshift(0);
            subtract(rem, prod, remL, base);
            if (cmp == -1) {
              remL = rem.length;
              cmp = compare(yd, rem, yL, remL);
              if (cmp < 1) {
                k++;
                subtract(rem, yL < remL ? yz : yd, remL, base);
              }
            }
            remL = rem.length;
          } else if (cmp === 0) {
            k++;
            rem = [0];
          }
          qd[i++] = k;
          if (cmp && rem[0]) {
            rem[remL++] = xd[xi] || 0;
          } else {
            rem = [xd[xi]];
            remL = 1;
          }
        } while ((xi++ < xL || rem[0] !== void 0) && sd--);
        more = rem[0] !== void 0;
      }
      if (!qd[0]) qd.shift();
    }
    if (logBase == 1) {
      q.e = e;
      inexact = more;
    } else {
      for (i = 1, k = qd[0]; k >= 10; k /= 10) i++;
      q.e = i + e * logBase - 1;
      finalise(q, dp ? pr + q.e + 1 : pr, rm, more);
    }
    return q;
  };
}();
function finalise(x, sd, rm, isTruncated) {
  var digits, i, j, k, rd, roundUp, w, xd, xdi, Ctor = x.constructor;
  out: if (sd != null) {
    xd = x.d;
    if (!xd) return x;
    for (digits = 1, k = xd[0]; k >= 10; k /= 10) digits++;
    i = sd - digits;
    if (i < 0) {
      i += LOG_BASE;
      j = sd;
      w = xd[xdi = 0];
      rd = w / mathpow(10, digits - j - 1) % 10 | 0;
    } else {
      xdi = Math.ceil((i + 1) / LOG_BASE);
      k = xd.length;
      if (xdi >= k) {
        if (isTruncated) {
          for (; k++ <= xdi; ) xd.push(0);
          w = rd = 0;
          digits = 1;
          i %= LOG_BASE;
          j = i - LOG_BASE + 1;
        } else {
          break out;
        }
      } else {
        w = k = xd[xdi];
        for (digits = 1; k >= 10; k /= 10) digits++;
        i %= LOG_BASE;
        j = i - LOG_BASE + digits;
        rd = j < 0 ? 0 : w / mathpow(10, digits - j - 1) % 10 | 0;
      }
    }
    isTruncated = isTruncated || sd < 0 || xd[xdi + 1] !== void 0 || (j < 0 ? w : w % mathpow(10, digits - j - 1));
    roundUp = rm < 4 ? (rd || isTruncated) && (rm == 0 || rm == (x.s < 0 ? 3 : 2)) : rd > 5 || rd == 5 && (rm == 4 || isTruncated || rm == 6 && // Check whether the digit to the left of the rounding digit is odd.
    (i > 0 ? j > 0 ? w / mathpow(10, digits - j) : 0 : xd[xdi - 1]) % 10 & 1 || rm == (x.s < 0 ? 8 : 7));
    if (sd < 1 || !xd[0]) {
      xd.length = 0;
      if (roundUp) {
        sd -= x.e + 1;
        xd[0] = mathpow(10, (LOG_BASE - sd % LOG_BASE) % LOG_BASE);
        x.e = -sd || 0;
      } else {
        xd[0] = x.e = 0;
      }
      return x;
    }
    if (i == 0) {
      xd.length = xdi;
      k = 1;
      xdi--;
    } else {
      xd.length = xdi + 1;
      k = mathpow(10, LOG_BASE - i);
      xd[xdi] = j > 0 ? (w / mathpow(10, digits - j) % mathpow(10, j) | 0) * k : 0;
    }
    if (roundUp) {
      for (; ; ) {
        if (xdi == 0) {
          for (i = 1, j = xd[0]; j >= 10; j /= 10) i++;
          j = xd[0] += k;
          for (k = 1; j >= 10; j /= 10) k++;
          if (i != k) {
            x.e++;
            if (xd[0] == BASE) xd[0] = 1;
          }
          break;
        } else {
          xd[xdi] += k;
          if (xd[xdi] != BASE) break;
          xd[xdi--] = 0;
          k = 1;
        }
      }
    }
    for (i = xd.length; xd[--i] === 0; ) xd.pop();
  }
  if (external) {
    if (x.e > Ctor.maxE) {
      x.d = null;
      x.e = NaN;
    } else if (x.e < Ctor.minE) {
      x.e = 0;
      x.d = [0];
    }
  }
  return x;
}
function finiteToString(x, isExp, sd) {
  if (!x.isFinite()) return nonFiniteToString(x);
  var k, e = x.e, str = digitsToString(x.d), len = str.length;
  if (isExp) {
    if (sd && (k = sd - len) > 0) {
      str = str.charAt(0) + "." + str.slice(1) + getZeroString(k);
    } else if (len > 1) {
      str = str.charAt(0) + "." + str.slice(1);
    }
    str = str + (x.e < 0 ? "e" : "e+") + x.e;
  } else if (e < 0) {
    str = "0." + getZeroString(-e - 1) + str;
    if (sd && (k = sd - len) > 0) str += getZeroString(k);
  } else if (e >= len) {
    str += getZeroString(e + 1 - len);
    if (sd && (k = sd - e - 1) > 0) str = str + "." + getZeroString(k);
  } else {
    if ((k = e + 1) < len) str = str.slice(0, k) + "." + str.slice(k);
    if (sd && (k = sd - len) > 0) {
      if (e + 1 === len) str += ".";
      str += getZeroString(k);
    }
  }
  return str;
}
function getBase10Exponent(digits, e) {
  var w = digits[0];
  for (e *= LOG_BASE; w >= 10; w /= 10) e++;
  return e;
}
function getLn10(Ctor, sd, pr) {
  if (sd > LN10_PRECISION) {
    external = true;
    if (pr) Ctor.precision = pr;
    throw Error(precisionLimitExceeded);
  }
  return finalise(new Ctor(LN10), sd, 1, true);
}
function getPi(Ctor, sd, rm) {
  if (sd > PI_PRECISION) throw Error(precisionLimitExceeded);
  return finalise(new Ctor(PI), sd, rm, true);
}
function getPrecision(digits) {
  var w = digits.length - 1, len = w * LOG_BASE + 1;
  w = digits[w];
  if (w) {
    for (; w % 10 == 0; w /= 10) len--;
    for (w = digits[0]; w >= 10; w /= 10) len++;
  }
  return len;
}
function getZeroString(k) {
  var zs = "";
  for (; k--; ) zs += "0";
  return zs;
}
function intPow(Ctor, x, n, pr) {
  var isTruncated, r = new Ctor(1), k = Math.ceil(pr / LOG_BASE + 4);
  external = false;
  for (; ; ) {
    if (n % 2) {
      r = r.times(x);
      if (truncate(r.d, k)) isTruncated = true;
    }
    n = mathfloor(n / 2);
    if (n === 0) {
      n = r.d.length - 1;
      if (isTruncated && r.d[n] === 0) ++r.d[n];
      break;
    }
    x = x.times(x);
    truncate(x.d, k);
  }
  external = true;
  return r;
}
function isOdd(n) {
  return n.d[n.d.length - 1] & 1;
}
function maxOrMin(Ctor, args, n) {
  var k, y, x = new Ctor(args[0]), i = 0;
  for (; ++i < args.length; ) {
    y = new Ctor(args[i]);
    if (!y.s) {
      x = y;
      break;
    }
    k = x.cmp(y);
    if (k === n || k === 0 && x.s === n) {
      x = y;
    }
  }
  return x;
}
function naturalExponential(x, sd) {
  var denominator, guard, j, pow2, sum2, t, wpr, rep = 0, i = 0, k = 0, Ctor = x.constructor, rm = Ctor.rounding, pr = Ctor.precision;
  if (!x.d || !x.d[0] || x.e > 17) {
    return new Ctor(x.d ? !x.d[0] ? 1 : x.s < 0 ? 0 : 1 / 0 : x.s ? x.s < 0 ? 0 : x : 0 / 0);
  }
  if (sd == null) {
    external = false;
    wpr = pr;
  } else {
    wpr = sd;
  }
  t = new Ctor(0.03125);
  while (x.e > -2) {
    x = x.times(t);
    k += 5;
  }
  guard = Math.log(mathpow(2, k)) / Math.LN10 * 2 + 5 | 0;
  wpr += guard;
  denominator = pow2 = sum2 = new Ctor(1);
  Ctor.precision = wpr;
  for (; ; ) {
    pow2 = finalise(pow2.times(x), wpr, 1);
    denominator = denominator.times(++i);
    t = sum2.plus(divide(pow2, denominator, wpr, 1));
    if (digitsToString(t.d).slice(0, wpr) === digitsToString(sum2.d).slice(0, wpr)) {
      j = k;
      while (j--) sum2 = finalise(sum2.times(sum2), wpr, 1);
      if (sd == null) {
        if (rep < 3 && checkRoundingDigits(sum2.d, wpr - guard, rm, rep)) {
          Ctor.precision = wpr += 10;
          denominator = pow2 = t = new Ctor(1);
          i = 0;
          rep++;
        } else {
          return finalise(sum2, Ctor.precision = pr, rm, external = true);
        }
      } else {
        Ctor.precision = pr;
        return sum2;
      }
    }
    sum2 = t;
  }
}
function naturalLogarithm(y, sd) {
  var c, c0, denominator, e, numerator, rep, sum2, t, wpr, x1, x2, n = 1, guard = 10, x = y, xd = x.d, Ctor = x.constructor, rm = Ctor.rounding, pr = Ctor.precision;
  if (x.s < 0 || !xd || !xd[0] || !x.e && xd[0] == 1 && xd.length == 1) {
    return new Ctor(xd && !xd[0] ? -1 / 0 : x.s != 1 ? NaN : xd ? 0 : x);
  }
  if (sd == null) {
    external = false;
    wpr = pr;
  } else {
    wpr = sd;
  }
  Ctor.precision = wpr += guard;
  c = digitsToString(xd);
  c0 = c.charAt(0);
  if (Math.abs(e = x.e) < 15e14) {
    while (c0 < 7 && c0 != 1 || c0 == 1 && c.charAt(1) > 3) {
      x = x.times(y);
      c = digitsToString(x.d);
      c0 = c.charAt(0);
      n++;
    }
    e = x.e;
    if (c0 > 1) {
      x = new Ctor("0." + c);
      e++;
    } else {
      x = new Ctor(c0 + "." + c.slice(1));
    }
  } else {
    t = getLn10(Ctor, wpr + 2, pr).times(e + "");
    x = naturalLogarithm(new Ctor(c0 + "." + c.slice(1)), wpr - guard).plus(t);
    Ctor.precision = pr;
    return sd == null ? finalise(x, pr, rm, external = true) : x;
  }
  x1 = x;
  sum2 = numerator = x = divide(x.minus(1), x.plus(1), wpr, 1);
  x2 = finalise(x.times(x), wpr, 1);
  denominator = 3;
  for (; ; ) {
    numerator = finalise(numerator.times(x2), wpr, 1);
    t = sum2.plus(divide(numerator, new Ctor(denominator), wpr, 1));
    if (digitsToString(t.d).slice(0, wpr) === digitsToString(sum2.d).slice(0, wpr)) {
      sum2 = sum2.times(2);
      if (e !== 0) sum2 = sum2.plus(getLn10(Ctor, wpr + 2, pr).times(e + ""));
      sum2 = divide(sum2, new Ctor(n), wpr, 1);
      if (sd == null) {
        if (checkRoundingDigits(sum2.d, wpr - guard, rm, rep)) {
          Ctor.precision = wpr += guard;
          t = numerator = x = divide(x1.minus(1), x1.plus(1), wpr, 1);
          x2 = finalise(x.times(x), wpr, 1);
          denominator = rep = 1;
        } else {
          return finalise(sum2, Ctor.precision = pr, rm, external = true);
        }
      } else {
        Ctor.precision = pr;
        return sum2;
      }
    }
    sum2 = t;
    denominator += 2;
  }
}
function nonFiniteToString(x) {
  return String(x.s * x.s / 0);
}
function parseDecimal(x, str) {
  var e, i, len;
  if ((e = str.indexOf(".")) > -1) str = str.replace(".", "");
  if ((i = str.search(/e/i)) > 0) {
    if (e < 0) e = i;
    e += +str.slice(i + 1);
    str = str.substring(0, i);
  } else if (e < 0) {
    e = str.length;
  }
  for (i = 0; str.charCodeAt(i) === 48; i++) ;
  for (len = str.length; str.charCodeAt(len - 1) === 48; --len) ;
  str = str.slice(i, len);
  if (str) {
    len -= i;
    x.e = e = e - i - 1;
    x.d = [];
    i = (e + 1) % LOG_BASE;
    if (e < 0) i += LOG_BASE;
    if (i < len) {
      if (i) x.d.push(+str.slice(0, i));
      for (len -= LOG_BASE; i < len; ) x.d.push(+str.slice(i, i += LOG_BASE));
      str = str.slice(i);
      i = LOG_BASE - str.length;
    } else {
      i -= len;
    }
    for (; i--; ) str += "0";
    x.d.push(+str);
    if (external) {
      if (x.e > x.constructor.maxE) {
        x.d = null;
        x.e = NaN;
      } else if (x.e < x.constructor.minE) {
        x.e = 0;
        x.d = [0];
      }
    }
  } else {
    x.e = 0;
    x.d = [0];
  }
  return x;
}
function parseOther(x, str) {
  var base, Ctor, divisor, i, isFloat, len, p, xd, xe;
  if (str.indexOf("_") > -1) {
    str = str.replace(/(\d)_(?=\d)/g, "$1");
    if (isDecimal.test(str)) return parseDecimal(x, str);
  } else if (str === "Infinity" || str === "NaN") {
    if (!+str) x.s = NaN;
    x.e = NaN;
    x.d = null;
    return x;
  }
  if (isHex.test(str)) {
    base = 16;
    str = str.toLowerCase();
  } else if (isBinary.test(str)) {
    base = 2;
  } else if (isOctal.test(str)) {
    base = 8;
  } else {
    throw Error(invalidArgument + str);
  }
  i = str.search(/p/i);
  if (i > 0) {
    p = +str.slice(i + 1);
    str = str.substring(2, i);
  } else {
    str = str.slice(2);
  }
  i = str.indexOf(".");
  isFloat = i >= 0;
  Ctor = x.constructor;
  if (isFloat) {
    str = str.replace(".", "");
    len = str.length;
    i = len - i;
    divisor = intPow(Ctor, new Ctor(base), i, i * 2);
  }
  xd = convertBase(str, base, BASE);
  xe = xd.length - 1;
  for (i = xe; xd[i] === 0; --i) xd.pop();
  if (i < 0) return new Ctor(x.s * 0);
  x.e = getBase10Exponent(xd, xe);
  x.d = xd;
  external = false;
  if (isFloat) x = divide(x, divisor, len * 4);
  if (p) x = x.times(Math.abs(p) < 54 ? mathpow(2, p) : Decimal.pow(2, p));
  external = true;
  return x;
}
function sine(Ctor, x) {
  var k, len = x.d.length;
  if (len < 3) {
    return x.isZero() ? x : taylorSeries(Ctor, 2, x, x);
  }
  k = 1.4 * Math.sqrt(len);
  k = k > 16 ? 16 : k | 0;
  x = x.times(1 / tinyPow(5, k));
  x = taylorSeries(Ctor, 2, x, x);
  var sin2_x, d5 = new Ctor(5), d16 = new Ctor(16), d20 = new Ctor(20);
  for (; k--; ) {
    sin2_x = x.times(x);
    x = x.times(d5.plus(sin2_x.times(d16.times(sin2_x).minus(d20))));
  }
  return x;
}
function taylorSeries(Ctor, n, x, y, isHyperbolic) {
  var j, t, u, x2, i = 1, pr = Ctor.precision, k = Math.ceil(pr / LOG_BASE);
  external = false;
  x2 = x.times(x);
  u = new Ctor(y);
  for (; ; ) {
    t = divide(u.times(x2), new Ctor(n++ * n++), pr, 1);
    u = isHyperbolic ? y.plus(t) : y.minus(t);
    y = divide(t.times(x2), new Ctor(n++ * n++), pr, 1);
    t = u.plus(y);
    if (t.d[k] !== void 0) {
      for (j = k; t.d[j] === u.d[j] && j--; ) ;
      if (j == -1) break;
    }
    j = u;
    u = y;
    y = t;
    t = j;
    i++;
  }
  external = true;
  t.d.length = k + 1;
  return t;
}
function tinyPow(b, e) {
  var n = b;
  while (--e) n *= b;
  return n;
}
function toLessThanHalfPi(Ctor, x) {
  var t, isNeg = x.s < 0, pi = getPi(Ctor, Ctor.precision, 1), halfPi = pi.times(0.5);
  x = x.abs();
  if (x.lte(halfPi)) {
    quadrant = isNeg ? 4 : 1;
    return x;
  }
  t = x.divToInt(pi);
  if (t.isZero()) {
    quadrant = isNeg ? 3 : 2;
  } else {
    x = x.minus(t.times(pi));
    if (x.lte(halfPi)) {
      quadrant = isOdd(t) ? isNeg ? 2 : 3 : isNeg ? 4 : 1;
      return x;
    }
    quadrant = isOdd(t) ? isNeg ? 1 : 4 : isNeg ? 3 : 2;
  }
  return x.minus(pi).abs();
}
function toStringBinary(x, baseOut, sd, rm) {
  var base, e, i, k, len, roundUp, str, xd, y, Ctor = x.constructor, isExp = sd !== void 0;
  if (isExp) {
    checkInt32(sd, 1, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
  } else {
    sd = Ctor.precision;
    rm = Ctor.rounding;
  }
  if (!x.isFinite()) {
    str = nonFiniteToString(x);
  } else {
    str = finiteToString(x);
    i = str.indexOf(".");
    if (isExp) {
      base = 2;
      if (baseOut == 16) {
        sd = sd * 4 - 3;
      } else if (baseOut == 8) {
        sd = sd * 3 - 2;
      }
    } else {
      base = baseOut;
    }
    if (i >= 0) {
      str = str.replace(".", "");
      y = new Ctor(1);
      y.e = str.length - i;
      y.d = convertBase(finiteToString(y), 10, base);
      y.e = y.d.length;
    }
    xd = convertBase(str, 10, base);
    e = len = xd.length;
    for (; xd[--len] == 0; ) xd.pop();
    if (!xd[0]) {
      str = isExp ? "0p+0" : "0";
    } else {
      if (i < 0) {
        e--;
      } else {
        x = new Ctor(x);
        x.d = xd;
        x.e = e;
        x = divide(x, y, sd, rm, 0, base);
        xd = x.d;
        e = x.e;
        roundUp = inexact;
      }
      i = xd[sd];
      k = base / 2;
      roundUp = roundUp || xd[sd + 1] !== void 0;
      roundUp = rm < 4 ? (i !== void 0 || roundUp) && (rm === 0 || rm === (x.s < 0 ? 3 : 2)) : i > k || i === k && (rm === 4 || roundUp || rm === 6 && xd[sd - 1] & 1 || rm === (x.s < 0 ? 8 : 7));
      xd.length = sd;
      if (roundUp) {
        for (; ++xd[--sd] > base - 1; ) {
          xd[sd] = 0;
          if (!sd) {
            ++e;
            xd.unshift(1);
          }
        }
      }
      for (len = xd.length; !xd[len - 1]; --len) ;
      for (i = 0, str = ""; i < len; i++) str += NUMERALS.charAt(xd[i]);
      if (isExp) {
        if (len > 1) {
          if (baseOut == 16 || baseOut == 8) {
            i = baseOut == 16 ? 4 : 3;
            for (--len; len % i; len++) str += "0";
            xd = convertBase(str, base, baseOut);
            for (len = xd.length; !xd[len - 1]; --len) ;
            for (i = 1, str = "1."; i < len; i++) str += NUMERALS.charAt(xd[i]);
          } else {
            str = str.charAt(0) + "." + str.slice(1);
          }
        }
        str = str + (e < 0 ? "p" : "p+") + e;
      } else if (e < 0) {
        for (; ++e; ) str = "0" + str;
        str = "0." + str;
      } else {
        if (++e > len) for (e -= len; e--; ) str += "0";
        else if (e < len) str = str.slice(0, e) + "." + str.slice(e);
      }
    }
    str = (baseOut == 16 ? "0x" : baseOut == 2 ? "0b" : baseOut == 8 ? "0o" : "") + str;
  }
  return x.s < 0 ? "-" + str : str;
}
function truncate(arr, len) {
  if (arr.length > len) {
    arr.length = len;
    return true;
  }
}
function abs(x) {
  return new this(x).abs();
}
function acos(x) {
  return new this(x).acos();
}
function acosh(x) {
  return new this(x).acosh();
}
function add(x, y) {
  return new this(x).plus(y);
}
function asin(x) {
  return new this(x).asin();
}
function asinh(x) {
  return new this(x).asinh();
}
function atan(x) {
  return new this(x).atan();
}
function atanh(x) {
  return new this(x).atanh();
}
function atan2(y, x) {
  y = new this(y);
  x = new this(x);
  var r, pr = this.precision, rm = this.rounding, wpr = pr + 4;
  if (!y.s || !x.s) {
    r = new this(NaN);
  } else if (!y.d && !x.d) {
    r = getPi(this, wpr, 1).times(x.s > 0 ? 0.25 : 0.75);
    r.s = y.s;
  } else if (!x.d || y.isZero()) {
    r = x.s < 0 ? getPi(this, pr, rm) : new this(0);
    r.s = y.s;
  } else if (!y.d || x.isZero()) {
    r = getPi(this, wpr, 1).times(0.5);
    r.s = y.s;
  } else if (x.s < 0) {
    this.precision = wpr;
    this.rounding = 1;
    r = this.atan(divide(y, x, wpr, 1));
    x = getPi(this, wpr, 1);
    this.precision = pr;
    this.rounding = rm;
    r = y.s < 0 ? r.minus(x) : r.plus(x);
  } else {
    r = this.atan(divide(y, x, wpr, 1));
  }
  return r;
}
function cbrt(x) {
  return new this(x).cbrt();
}
function ceil(x) {
  return finalise(x = new this(x), x.e + 1, 2);
}
function clamp(x, min2, max2) {
  return new this(x).clamp(min2, max2);
}
function config(obj) {
  if (!obj || typeof obj !== "object") throw Error(decimalError + "Object expected");
  var i, p, v, useDefaults = obj.defaults === true, ps = [
    "precision",
    1,
    MAX_DIGITS,
    "rounding",
    0,
    8,
    "toExpNeg",
    -EXP_LIMIT,
    0,
    "toExpPos",
    0,
    EXP_LIMIT,
    "maxE",
    0,
    EXP_LIMIT,
    "minE",
    -EXP_LIMIT,
    0,
    "modulo",
    0,
    9
  ];
  for (i = 0; i < ps.length; i += 3) {
    if (p = ps[i], useDefaults) this[p] = DEFAULTS[p];
    if ((v = obj[p]) !== void 0) {
      if (mathfloor(v) === v && v >= ps[i + 1] && v <= ps[i + 2]) this[p] = v;
      else throw Error(invalidArgument + p + ": " + v);
    }
  }
  if (p = "crypto", useDefaults) this[p] = DEFAULTS[p];
  if ((v = obj[p]) !== void 0) {
    if (v === true || v === false || v === 0 || v === 1) {
      if (v) {
        if (typeof crypto != "undefined" && crypto && (crypto.getRandomValues || crypto.randomBytes)) {
          this[p] = true;
        } else {
          throw Error(cryptoUnavailable);
        }
      } else {
        this[p] = false;
      }
    } else {
      throw Error(invalidArgument + p + ": " + v);
    }
  }
  return this;
}
function cos(x) {
  return new this(x).cos();
}
function cosh(x) {
  return new this(x).cosh();
}
function clone(obj) {
  var i, p, ps;
  function Decimal2(v) {
    var e, i2, t, x = this;
    if (!(x instanceof Decimal2)) return new Decimal2(v);
    x.constructor = Decimal2;
    if (isDecimalInstance(v)) {
      x.s = v.s;
      if (external) {
        if (!v.d || v.e > Decimal2.maxE) {
          x.e = NaN;
          x.d = null;
        } else if (v.e < Decimal2.minE) {
          x.e = 0;
          x.d = [0];
        } else {
          x.e = v.e;
          x.d = v.d.slice();
        }
      } else {
        x.e = v.e;
        x.d = v.d ? v.d.slice() : v.d;
      }
      return;
    }
    t = typeof v;
    if (t === "number") {
      if (v === 0) {
        x.s = 1 / v < 0 ? -1 : 1;
        x.e = 0;
        x.d = [0];
        return;
      }
      if (v < 0) {
        v = -v;
        x.s = -1;
      } else {
        x.s = 1;
      }
      if (v === ~~v && v < 1e7) {
        for (e = 0, i2 = v; i2 >= 10; i2 /= 10) e++;
        if (external) {
          if (e > Decimal2.maxE) {
            x.e = NaN;
            x.d = null;
          } else if (e < Decimal2.minE) {
            x.e = 0;
            x.d = [0];
          } else {
            x.e = e;
            x.d = [v];
          }
        } else {
          x.e = e;
          x.d = [v];
        }
        return;
      }
      if (v * 0 !== 0) {
        if (!v) x.s = NaN;
        x.e = NaN;
        x.d = null;
        return;
      }
      return parseDecimal(x, v.toString());
    }
    if (t === "string") {
      if ((i2 = v.charCodeAt(0)) === 45) {
        v = v.slice(1);
        x.s = -1;
      } else {
        if (i2 === 43) v = v.slice(1);
        x.s = 1;
      }
      return isDecimal.test(v) ? parseDecimal(x, v) : parseOther(x, v);
    }
    if (t === "bigint") {
      if (v < 0) {
        v = -v;
        x.s = -1;
      } else {
        x.s = 1;
      }
      return parseDecimal(x, v.toString());
    }
    throw Error(invalidArgument + v);
  }
  Decimal2.prototype = P;
  Decimal2.ROUND_UP = 0;
  Decimal2.ROUND_DOWN = 1;
  Decimal2.ROUND_CEIL = 2;
  Decimal2.ROUND_FLOOR = 3;
  Decimal2.ROUND_HALF_UP = 4;
  Decimal2.ROUND_HALF_DOWN = 5;
  Decimal2.ROUND_HALF_EVEN = 6;
  Decimal2.ROUND_HALF_CEIL = 7;
  Decimal2.ROUND_HALF_FLOOR = 8;
  Decimal2.EUCLID = 9;
  Decimal2.config = Decimal2.set = config;
  Decimal2.clone = clone;
  Decimal2.isDecimal = isDecimalInstance;
  Decimal2.abs = abs;
  Decimal2.acos = acos;
  Decimal2.acosh = acosh;
  Decimal2.add = add;
  Decimal2.asin = asin;
  Decimal2.asinh = asinh;
  Decimal2.atan = atan;
  Decimal2.atanh = atanh;
  Decimal2.atan2 = atan2;
  Decimal2.cbrt = cbrt;
  Decimal2.ceil = ceil;
  Decimal2.clamp = clamp;
  Decimal2.cos = cos;
  Decimal2.cosh = cosh;
  Decimal2.div = div;
  Decimal2.exp = exp;
  Decimal2.floor = floor;
  Decimal2.hypot = hypot;
  Decimal2.ln = ln;
  Decimal2.log = log;
  Decimal2.log10 = log10;
  Decimal2.log2 = log2;
  Decimal2.max = max;
  Decimal2.min = min;
  Decimal2.mod = mod;
  Decimal2.mul = mul;
  Decimal2.pow = pow;
  Decimal2.random = random;
  Decimal2.round = round;
  Decimal2.sign = sign;
  Decimal2.sin = sin;
  Decimal2.sinh = sinh;
  Decimal2.sqrt = sqrt;
  Decimal2.sub = sub;
  Decimal2.sum = sum;
  Decimal2.tan = tan;
  Decimal2.tanh = tanh;
  Decimal2.trunc = trunc;
  if (obj === void 0) obj = {};
  if (obj) {
    if (obj.defaults !== true) {
      ps = ["precision", "rounding", "toExpNeg", "toExpPos", "maxE", "minE", "modulo", "crypto"];
      for (i = 0; i < ps.length; ) if (!obj.hasOwnProperty(p = ps[i++])) obj[p] = this[p];
    }
  }
  Decimal2.config(obj);
  return Decimal2;
}
function div(x, y) {
  return new this(x).div(y);
}
function exp(x) {
  return new this(x).exp();
}
function floor(x) {
  return finalise(x = new this(x), x.e + 1, 3);
}
function hypot() {
  var i, n, t = new this(0);
  external = false;
  for (i = 0; i < arguments.length; ) {
    n = new this(arguments[i++]);
    if (!n.d) {
      if (n.s) {
        external = true;
        return new this(1 / 0);
      }
      t = n;
    } else if (t.d) {
      t = t.plus(n.times(n));
    }
  }
  external = true;
  return t.sqrt();
}
function isDecimalInstance(obj) {
  return obj instanceof Decimal || obj && obj.toStringTag === tag || false;
}
function ln(x) {
  return new this(x).ln();
}
function log(x, y) {
  return new this(x).log(y);
}
function log2(x) {
  return new this(x).log(2);
}
function log10(x) {
  return new this(x).log(10);
}
function max() {
  return maxOrMin(this, arguments, -1);
}
function min() {
  return maxOrMin(this, arguments, 1);
}
function mod(x, y) {
  return new this(x).mod(y);
}
function mul(x, y) {
  return new this(x).mul(y);
}
function pow(x, y) {
  return new this(x).pow(y);
}
function random(sd) {
  var d, e, k, n, i = 0, r = new this(1), rd = [];
  if (sd === void 0) sd = this.precision;
  else checkInt32(sd, 1, MAX_DIGITS);
  k = Math.ceil(sd / LOG_BASE);
  if (!this.crypto) {
    for (; i < k; ) rd[i++] = Math.random() * 1e7 | 0;
  } else if (crypto.getRandomValues) {
    d = crypto.getRandomValues(new Uint32Array(k));
    for (; i < k; ) {
      n = d[i];
      if (n >= 429e7) {
        d[i] = crypto.getRandomValues(new Uint32Array(1))[0];
      } else {
        rd[i++] = n % 1e7;
      }
    }
  } else if (crypto.randomBytes) {
    d = crypto.randomBytes(k *= 4);
    for (; i < k; ) {
      n = d[i] + (d[i + 1] << 8) + (d[i + 2] << 16) + ((d[i + 3] & 127) << 24);
      if (n >= 214e7) {
        crypto.randomBytes(4).copy(d, i);
      } else {
        rd.push(n % 1e7);
        i += 4;
      }
    }
    i = k / 4;
  } else {
    throw Error(cryptoUnavailable);
  }
  k = rd[--i];
  sd %= LOG_BASE;
  if (k && sd) {
    n = mathpow(10, LOG_BASE - sd);
    rd[i] = (k / n | 0) * n;
  }
  for (; rd[i] === 0; i--) rd.pop();
  if (i < 0) {
    e = 0;
    rd = [0];
  } else {
    e = -1;
    for (; rd[0] === 0; e -= LOG_BASE) rd.shift();
    for (k = 1, n = rd[0]; n >= 10; n /= 10) k++;
    if (k < LOG_BASE) e -= LOG_BASE - k;
  }
  r.e = e;
  r.d = rd;
  return r;
}
function round(x) {
  return finalise(x = new this(x), x.e + 1, this.rounding);
}
function sign(x) {
  x = new this(x);
  return x.d ? x.d[0] ? x.s : 0 * x.s : x.s || NaN;
}
function sin(x) {
  return new this(x).sin();
}
function sinh(x) {
  return new this(x).sinh();
}
function sqrt(x) {
  return new this(x).sqrt();
}
function sub(x, y) {
  return new this(x).sub(y);
}
function sum() {
  var i = 0, args = arguments, x = new this(args[i]);
  external = false;
  for (; x.s && ++i < args.length; ) x = x.plus(args[i]);
  external = true;
  return finalise(x, this.precision, this.rounding);
}
function tan(x) {
  return new this(x).tan();
}
function tanh(x) {
  return new this(x).tanh();
}
function trunc(x) {
  return finalise(x = new this(x), x.e + 1, 1);
}
P[Symbol.for("nodejs.util.inspect.custom")] = P.toString;
P[Symbol.toStringTag] = "Decimal";
var Decimal = P.constructor = clone(DEFAULTS);
LN10 = new Decimal(LN10);
PI = new Decimal(PI);
var decimal_default = Decimal;

// src/shared/format.ts
decimal_default.set({ precision: 40, rounding: decimal_default.ROUND_HALF_UP, toExpNeg: -9, toExpPos: 12 });
function groupThousands(intPart) {
  const neg = intPart.startsWith("-");
  const digits = neg ? intPart.slice(1) : intPart;
  const out = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return neg ? `-${out}` : out;
}
var MAX_EXP = 12;
var MIN_EXP = -9;
function formatNumber(value, opts = {}) {
  const { decimals, grouping = true, significant = true } = opts;
  let d;
  try {
    d = value instanceof decimal_default ? value : new decimal_default(value);
  } catch {
    return "\u2014";
  }
  if (!d.isFinite()) return d.isNaN() ? "NaN" : d.isNegative() ? "-\u221E" : "\u221E";
  if (d.isZero()) return decimals !== void 0 ? 0 .toFixed(decimals) : "0";
  const abs2 = d.abs();
  if (decimals === void 0 && significant && (abs2.gte(new decimal_default(10).pow(MAX_EXP)) || abs2.lt(new decimal_default(10).pow(MIN_EXP)))) {
    const s2 = d.toSignificantDigits(12).toExponential();
    return s2.replace(/e([+-])(\d)$/, "e$10$2");
  }
  let s;
  if (decimals !== void 0) {
    s = d.toFixed(decimals, decimal_default.ROUND_HALF_UP);
  } else {
    s = d.toSignificantDigits(significant ? 12 : 20).toString();
    if (s.includes("e")) {
      return s.replace(/e([+-])(\d)$/, "e$10$2");
    }
    if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  }
  if (!grouping) return s;
  const [ip, fp] = s.split(".");
  return fp !== void 0 ? `${groupThousands(ip)}.${fp}` : groupThousands(ip);
}
function parseDecimal2(input) {
  const cleaned = input.replace(/,/g, "").replace(/\s/g, "").trim();
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  try {
    const d = new decimal_default(cleaned);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

// src/shared/engine.ts
var CalcError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "CalcError";
  }
};
var PI2 = new decimal_default(
  "3.14159265358979323846264338327950288419716939937510582097494459230781640628620899862803482534211706798"
);
var E_CONST = new decimal_default(
  "2.71828182845904523536028747135266249775724709369995957496696762772407663035354759457138217852516642743"
);
var TRIG_ZERO = new decimal_default("1e-25");
function decSin(x) {
  const twoPi = PI2.times(2);
  let v = x.mod(twoPi);
  if (v.gt(PI2)) v = v.minus(twoPi);
  if (v.lt(PI2.neg())) v = v.plus(twoPi);
  let term = v;
  let sum2 = v;
  const v2 = v.times(v);
  for (let n = 1; n < 120; n++) {
    term = term.times(v2).div(2 * n * (2 * n + 1)).neg();
    sum2 = sum2.plus(term);
    if (term.abs().lt(new decimal_default("1e-42"))) break;
  }
  return sum2.abs().lt(TRIG_ZERO) ? new decimal_default(0) : sum2;
}
function decCos(x) {
  const twoPi = PI2.times(2);
  let v = x.mod(twoPi);
  if (v.gt(PI2)) v = v.minus(twoPi);
  if (v.lt(PI2.neg())) v = v.plus(twoPi);
  let term = new decimal_default(1);
  let sum2 = new decimal_default(1);
  const v2 = v.times(v);
  for (let n = 1; n < 120; n++) {
    term = term.times(v2).div((2 * n - 1) * (2 * n)).neg();
    sum2 = sum2.plus(term);
    if (term.abs().lt(new decimal_default("1e-42"))) break;
  }
  return sum2.abs().lt(TRIG_ZERO) ? new decimal_default(0) : sum2;
}
function decAtan(x) {
  if (x.isZero()) return new decimal_default(0);
  const neg = x.isNegative();
  let v = x.abs();
  let invert = false;
  if (v.gt(1)) {
    v = new decimal_default(1).div(v);
    invert = true;
  }
  let k = 0;
  for (let i = 0; i < 3; i++) {
    v = v.div(new decimal_default(1).plus(v.times(v).plus(1).sqrt()));
    k++;
  }
  const v2 = v.times(v);
  let term = v;
  let sum2 = v;
  for (let n = 1; n < 200; n++) {
    term = term.times(v2).neg();
    const add2 = term.div(2 * n + 1);
    sum2 = sum2.plus(add2);
    if (add2.abs().lt(new decimal_default("1e-42"))) break;
  }
  let r = sum2.times(Math.pow(2, k));
  if (invert) r = PI2.div(2).minus(r);
  return neg ? r.neg() : r;
}
function decAsin(x) {
  if (x.abs().gt(1)) throw new CalcError("\u8F93\u5165\u8D85\u51FA\u5B9A\u4E49\u57DF\uFF0C\u65E0\u5B9E\u6570\u7ED3\u679C");
  if (x.abs().eq(1)) return x.isNegative() ? PI2.div(2).neg() : PI2.div(2);
  return decAtan(x.div(new decimal_default(1).minus(x.times(x)).sqrt()));
}
function decAcos(x) {
  if (x.abs().gt(1)) throw new CalcError("\u8F93\u5165\u8D85\u51FA\u5B9A\u4E49\u57DF\uFF0C\u65E0\u5B9E\u6570\u7ED3\u679C");
  return PI2.div(2).minus(decAsin(x));
}
function decFactorial(n) {
  if (!n.isInteger() || n.isNegative()) throw new CalcError("\u9636\u4E58\u4EC5\u652F\u6301\u975E\u8D1F\u6574\u6570");
  if (n.gt(170)) throw new CalcError("\u6570\u503C\u8D85\u51FA\u53EF\u8BA1\u7B97\u8303\u56F4");
  let r = new decimal_default(1);
  for (let i = 2; i <= n.toNumber(); i++) r = r.times(i);
  return r;
}
function tokenize(src) {
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "	") {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      if (j < src.length && /[eE]/.test(src[j]) && /[0-9+\-]/.test(src[j + 1] ?? "")) {
        let k = j + 1;
        if (/[+\-]/.test(src[k])) k++;
        if (/[0-9]/.test(src[k] ?? "")) {
          while (k < src.length && /[0-9]/.test(src[k])) k++;
          j = k;
        }
      }
      const text = src.slice(i, j);
      if ((text.match(/\./g) || []).length > 1) throw new CalcError("\u6570\u5B57\u683C\u5F0F\u6709\u8BEF");
      toks.push({ type: "num", text });
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++;
      toks.push({ type: "ident", text: src.slice(i, j).toLowerCase() });
      i = j;
      continue;
    }
    if ("+-*/^!%".includes(c)) {
      toks.push({ type: "op", text: c });
      i++;
      continue;
    }
    if (c === "(") {
      toks.push({ type: "lparen", text: c });
      i++;
      continue;
    }
    if (c === ")") {
      toks.push({ type: "rparen", text: c });
      i++;
      continue;
    }
    if (c === "," || c === "\uFF0C") {
      toks.push({ type: "comma", text: "," });
      i++;
      continue;
    }
    if (c === "\xD7") {
      toks.push({ type: "op", text: "*" });
      i++;
      continue;
    }
    if (c === "\xF7") {
      toks.push({ type: "op", text: "/" });
      i++;
      continue;
    }
    if (c === "\u03C0") {
      toks.push({ type: "ident", text: "pi" });
      i++;
      continue;
    }
    if (c === "\u221A") {
      toks.push({ type: "ident", text: "sqrt" });
      i++;
      continue;
    }
    throw new CalcError(`\u65E0\u6CD5\u8BC6\u522B\u7684\u5B57\u7B26\uFF1A${c}`);
  }
  toks.push({ type: "end", text: "" });
  return toks;
}
var FUNCS = /* @__PURE__ */ new Set([
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "ln",
  "lg",
  "log10",
  "log",
  "exp",
  "sqrt",
  "cbrt",
  "root",
  "abs"
]);
var Parser = class {
  constructor(toks, angleMode, ans) {
    this.toks = toks;
    this.angleMode = angleMode;
    this.ans = ans;
  }
  pos = 0;
  peek() {
    return this.toks[this.pos];
  }
  next() {
    return this.toks[this.pos++];
  }
  isOp(text) {
    const t = this.peek();
    return t.type === "op" && t.text === text;
  }
  parse() {
    const v = this.additive();
    if (this.peek().type !== "end") {
      const t = this.peek();
      if (t.type === "rparen") throw new CalcError("\u62EC\u53F7\u672A\u95ED\u5408");
      throw new CalcError(`\u8868\u8FBE\u5F0F\u6709\u8BEF\uFF1A\u591A\u4F59\u7B26\u53F7 ${t.text}`);
    }
    return v;
  }
  toRad(d) {
    return this.angleMode === "DEG" ? d.times(PI2).div(180) : d;
  }
  fromRad(d) {
    return this.angleMode === "DEG" ? d.times(180).div(PI2) : d;
  }
  additive() {
    let left = this.multiplicative();
    while (this.isOp("+") || this.isOp("-")) {
      const op = this.next().text;
      const right = this.multiplicative();
      let rv = right.v;
      if (right.pct) {
        rv = left.v.times(rv);
      }
      left = { v: op === "+" ? left.v.plus(rv) : left.v.minus(rv), pct: false };
    }
    return left;
  }
  multiplicative() {
    let left = this.unary();
    for (; ; ) {
      if (this.isOp("*") || this.isOp("/")) {
        const op = this.next().text;
        const right = this.unary();
        if (op === "/") {
          if (right.v.isZero()) throw new CalcError("\u9664\u6570\u4E0D\u80FD\u4E3A 0");
          left = { v: left.v.div(right.v), pct: false };
        } else {
          left = { v: left.v.times(right.v), pct: false };
        }
        continue;
      }
      const t = this.peek();
      if (t.type === "num" || t.type === "lparen" || t.type === "ident" && (t.text === "pi" || t.text === "e" || t.text === "ans" || FUNCS.has(t.text))) {
        const right = this.unary();
        left = { v: left.v.times(right.v), pct: false };
        continue;
      }
      break;
    }
    return left;
  }
  unary() {
    if (this.isOp("-")) {
      this.next();
      const v = this.unary();
      return { v: v.v.neg(), pct: v.pct };
    }
    if (this.isOp("+")) {
      this.next();
      return this.unary();
    }
    return this.power();
  }
  power() {
    const base = this.postfix();
    if (this.isOp("^")) {
      this.next();
      const exp2 = this.unary();
      if (base.v.isNegative() && !exp2.v.isInteger()) {
        const inv = new decimal_default(1).div(exp2.v);
        if (inv.isInteger() && inv.mod(2).eq(0)) return { v: sqrtDecimal(base.v), pct: false };
        throw new CalcError("\u8BE5\u8FD0\u7B97\u4E0D\u652F\u6301\u8D1F\u6570");
      }
      return { v: base.v.pow(exp2.v), pct: false };
    }
    return base;
  }
  postfix() {
    let val = this.primary();
    for (; ; ) {
      const t = this.peek();
      if (t.type === "op" && t.text === "!") {
        this.next();
        val = { v: decFactorial(val.v), pct: false };
        continue;
      }
      if (t.type === "op" && t.text === "%") {
        this.next();
        val = { v: val.v.div(100), pct: true };
        continue;
      }
      break;
    }
    return val;
  }
  primary() {
    const t = this.next();
    if (t.type === "num") {
      try {
        const d = new decimal_default(t.text);
        if (!d.isFinite()) throw new CalcError("\u6570\u503C\u8D85\u51FA\u53EF\u8BA1\u7B97\u8303\u56F4");
        return { v: d, pct: false };
      } catch (e) {
        if (e instanceof CalcError) throw e;
        throw new CalcError("\u6570\u5B57\u683C\u5F0F\u6709\u8BEF");
      }
    }
    if (t.type === "lparen") {
      const v = this.additive();
      const close = this.peek();
      if (close.type !== "rparen") throw new CalcError("\u62EC\u53F7\u672A\u95ED\u5408");
      this.next();
      return v;
    }
    if (t.type === "ident") {
      const name = t.text;
      if (name === "pi") return { v: PI2, pct: false };
      if (name === "e") return { v: E_CONST, pct: false };
      if (name === "ans") return { v: this.ans, pct: false };
      if (FUNCS.has(name)) return this.callFunc(name);
      throw new CalcError(`\u672A\u77E5\u7B26\u53F7\uFF1A${name}`);
    }
    if (t.type === "end") throw new CalcError("\u8868\u8FBE\u5F0F\u4E0D\u5B8C\u6574");
    throw new CalcError("\u8868\u8FBE\u5F0F\u6709\u8BEF");
  }
  callFunc(name) {
    const args = [];
    if (this.peek().type === "lparen") {
      this.next();
      if (this.peek().type !== "rparen") {
        for (; ; ) {
          const v = this.additive();
          args.push(v.v);
          if (this.peek().type === "comma") {
            this.next();
            continue;
          }
          break;
        }
      }
      if (this.peek().type !== "rparen") throw new CalcError("\u62EC\u53F7\u672A\u95ED\u5408");
      this.next();
    } else {
      const v = this.unary();
      args.push(v.v);
    }
    const a0 = args[0] ?? new decimal_default(0);
    switch (name) {
      case "sin":
        return { v: decSin(this.toRad(a0)), pct: false };
      case "cos":
        return { v: decCos(this.toRad(a0)), pct: false };
      case "tan": {
        if (this.angleMode === "DEG") {
          const m = a0.mod(180);
          if (m.abs().eq(90)) throw new CalcError("\u8BE5\u89D2\u5EA6\u65E0\u5B9A\u4E49");
        } else {
          const half = PI2.div(2);
          const m = a0.minus(half).div(PI2);
          if (m.isInteger()) throw new CalcError("\u8BE5\u89D2\u5EA6\u65E0\u5B9A\u4E49");
        }
        return { v: decSin(this.toRad(a0)).div(decCos(this.toRad(a0))), pct: false };
      }
      case "asin":
        return { v: this.fromRad(decAsin(a0)), pct: false };
      case "acos":
        return { v: this.fromRad(decAcos(a0)), pct: false };
      case "atan":
        return { v: this.fromRad(decAtan(a0)), pct: false };
      case "ln":
      case "log":
        if (a0.lte(0)) throw new CalcError("\u8BE5\u8FD0\u7B97\u4E0D\u652F\u6301\u8D1F\u6570");
        return { v: a0.ln(), pct: false };
      case "lg":
      case "log10":
        if (a0.lte(0)) throw new CalcError("\u8BE5\u8FD0\u7B97\u4E0D\u652F\u6301\u8D1F\u6570");
        return { v: a0.ln().div(new decimal_default(10).ln()), pct: false };
      case "exp":
        return { v: a0.exp(), pct: false };
      case "sqrt":
        return { v: sqrtDecimal(a0), pct: false };
      case "cbrt": {
        if (a0.isNegative()) return { v: a0.abs().cbrt().neg(), pct: false };
        return { v: a0.cbrt(), pct: false };
      }
      case "root": {
        const n = args[1] ?? new decimal_default(2);
        if (n.isZero()) throw new CalcError("\u9664\u6570\u4E0D\u80FD\u4E3A 0");
        if (a0.isNegative() && !n.isInteger()) throw new CalcError("\u8BE5\u8FD0\u7B97\u4E0D\u652F\u6301\u8D1F\u6570");
        if (n.isInteger() && n.mod(2).eq(0) && a0.isNegative()) throw new CalcError("\u8D1F\u6570\u4E0D\u652F\u6301\u5F00\u5E73\u65B9");
        if (a0.isNegative()) return { v: a0.abs().pow(new decimal_default(1).div(n)).neg(), pct: false };
        return { v: a0.pow(new decimal_default(1).div(n)), pct: false };
      }
      case "abs":
        return { v: a0.abs(), pct: false };
      default:
        throw new CalcError(`\u672A\u77E5\u51FD\u6570\uFF1A${name}`);
    }
  }
};
function sqrtDecimal(v) {
  if (v.isNegative()) throw new CalcError("\u8D1F\u6570\u4E0D\u652F\u6301\u5F00\u5E73\u65B9");
  return v.sqrt();
}
function checkParens(expr) {
  let depth = 0;
  for (const c of expr) {
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth < 0) return "extra";
    }
  }
  return depth > 0 ? "unclosed" : null;
}
function evaluate(expr, angleMode, ans) {
  const trimmed = expr.trim();
  if (!trimmed) throw new CalcError("\u8868\u8FBE\u5F0F\u4E0D\u5B8C\u6574");
  const balance = checkParens(trimmed);
  if (balance === "unclosed") throw new CalcError("\u62EC\u53F7\u672A\u95ED\u5408");
  if (balance === "extra") throw new CalcError("\u62EC\u53F7\u6709\u591A\u4F59\u7684\u53F3\u62EC\u53F7");
  const p = new Parser(tokenize(trimmed), angleMode, ans);
  const { v } = p.parse();
  if (!v.isFinite()) throw new CalcError("\u6570\u503C\u8D85\u51FA\u53EF\u8BA1\u7B97\u8303\u56F4");
  return { value: v, overflow: v.abs().gte(new decimal_default("1e308")) };
}
function toDisplayExpr(expr) {
  return expr.replace(/\bsqrt\(/g, "\u221A(").replace(/\bpi\b/g, "\u03C0").replace(/\bans\b/gi, "Ans").replace(/\*/g, "\xD7").replace(/\//g, "\xF7").replace(/cbrt\(/g, "\u221B(").replace(/\blog10\(/g, "log(").replace(/\blg\(/g, "log(");
}

// src/shared/trade.ts
var TO_M = { cm: "0.01", mm: "0.001", m: "1", inch: "0.0254" };
function toDecimal(v) {
  const s = v.replace(/,/g, "").trim();
  if (!s || s === "-" || s === ".") return null;
  try {
    const d = new decimal_default(s);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}
function calcCbm(i) {
  const l = toDecimal(i.length);
  const w = toDecimal(i.width);
  const h = toDecimal(i.height);
  const n = toDecimal(i.boxes || "1");
  if (!l || !w || !h) return { error: "\u8BF7\u586B\u5199\u5B8C\u6574\u7684\u957F\u3001\u5BBD\u3001\u9AD8" };
  if (l.lte(0) || w.lte(0) || h.lte(0)) return { error: "\u957F\u3001\u5BBD\u3001\u9AD8\u5FC5\u987B\u5927\u4E8E 0" };
  if (!n || n.lt(1)) return { error: "\u7BB1\u6570\u5FC5\u987B\u4E3A \u22651 \u7684\u6574\u6570" };
  if (!n.isInteger()) return { error: "\u7BB1\u6570\u5FC5\u987B\u4E3A\u6574\u6570" };
  const k = new decimal_default(TO_M[i.unit]);
  const single = l.times(k).times(w.times(k)).times(h.times(k));
  const total = single.times(n);
  const cft = total.times("35.3147");
  const warn = l.gt(1e3) || w.gt(1e3) || h.gt(1e3) ? "\u5C3A\u5BF8\u7591\u4F3C\u8F93\u5165\u9519\u8BEF\uFF0C\u8BF7\u786E\u8BA4\u5355\u4F4D" : void 0;
  return { single, total, cft, warn };
}
function calcVolumeWeight(i) {
  const l = toDecimal(i.length);
  const w = toDecimal(i.width);
  const h = toDecimal(i.height);
  if (!l || !w || !h) return { error: "\u8BF7\u586B\u5199\u5B8C\u6574\u7684\u957F\u3001\u5BBD\u3001\u9AD8\uFF08cm\uFF09" };
  if (l.lte(0) || w.lte(0) || h.lte(0)) return { error: "\u957F\u3001\u5BBD\u3001\u9AD8\u5FC5\u987B\u5927\u4E8E 0" };
  const actual = toDecimal(i.actual) ?? new decimal_default(0);
  if (actual.lt(0)) return { error: "\u5B9E\u9645\u91CD\u91CF\u4E0D\u80FD\u4E3A\u8D1F" };
  let volumetric;
  let divisorUsed;
  let warn;
  if (i.rule === "wm") {
    volumetric = l.times(w).times(h).div("1000000").times(1e3);
    divisorUsed = "W/M\uFF081 CBM = 1000 kg\uFF09";
  } else {
    let d;
    if (i.rule === "custom") {
      const parsed = toDecimal(i.divisor);
      if (!parsed || parsed.lte(0)) {
        d = new decimal_default(6e3);
        divisorUsed = "6000\uFF08\u9664\u6570\u65E0\u6548\uFF0C\u5DF2\u7528\u9ED8\u8BA4\u503C\uFF09";
        warn = "\u9664\u6570\u65E0\u6548\uFF0C\u5DF2\u6539\u7528\u9ED8\u8BA4 6000";
      } else {
        d = parsed;
        divisorUsed = d.toString();
      }
    } else {
      d = new decimal_default(i.rule);
      divisorUsed = i.rule;
    }
    volumetric = l.times(w).times(h).div(d);
  }
  const byVolume = volumetric.gt(actual);
  return {
    volumetric,
    chargeable: byVolume ? volumetric : actual,
    byVolume,
    divisorUsed,
    warn
  };
}
function calcVat(i) {
  const amt = toDecimal(i.amount);
  const ratePct = toDecimal(i.rate);
  if (!amt) return { error: "\u8BF7\u8F93\u5165\u91D1\u989D" };
  if (amt.lte(0)) return { error: "\u91D1\u989D\u5FC5\u987B\u5927\u4E8E 0" };
  if (!ratePct || ratePct.lt(0)) return { error: "\u8BF7\u8F93\u5165\u6709\u6548\u7A0E\u7387" };
  const r = ratePct.div(100);
  const warn = ratePct.gt(100) ? "\u7A0E\u7387\u5F02\u5E38\uFF0C\u8BF7\u786E\u8BA4" : void 0;
  if (i.direction === "exclusive2inclusive") {
    const tax = amt.times(r);
    return { exclusive: amt, tax, inclusive: amt.times(r.plus(1)), warn };
  }
  const exclusive = amt.div(r.plus(1));
  return { exclusive, tax: amt.minus(exclusive), inclusive: amt, warn };
}
function calcExportRefund(i) {
  const incl = toDecimal(i.purchaseIncl);
  const levy = toDecimal(i.levyRate);
  const refund = toDecimal(i.refundRate);
  if (!incl || incl.lte(0)) return { error: "\u8BF7\u8F93\u5165\u91C7\u8D2D\u542B\u7A0E\u91D1\u989D" };
  if (!levy || levy.lt(0)) return { error: "\u8BF7\u8F93\u5165\u6709\u6548\u5F81\u7A0E\u7387" };
  if (!refund || refund.lt(0)) return { error: "\u8BF7\u8F93\u5165\u6709\u6548\u9000\u7A0E\u7387" };
  const lv = levy.div(100);
  const rf = refund.div(100);
  const exclusive = incl.div(lv.plus(1));
  const refundable = exclusive.times(rf);
  const nonRefundable = exclusive.times(lv.minus(rf));
  const warn = refund.gt(levy) ? "\u9000\u7A0E\u7387\u4E0D\u5E94\u9AD8\u4E8E\u5F81\u7A0E\u7387\uFF0C\u8BF7\u786E\u8BA4" : void 0;
  return { exclusive, refundable, nonRefundable, realCost: incl.minus(refundable), warn };
}
function calcImportTax(i) {
  let cif;
  if (i.mode === "cif") {
    cif = toDecimal(i.cif);
    if (!cif) return { error: "\u8BF7\u8F93\u5165 CIF \u5B8C\u7A0E\u4EF7\u683C" };
  } else {
    const fob = toDecimal(i.fob);
    if (!fob) return { error: "\u8BF7\u8F93\u5165 FOB \u4EF7\u683C" };
    const fr = toDecimal(i.freight) ?? new decimal_default(0);
    const ins = toDecimal(i.insurance) ?? new decimal_default(0);
    cif = fob.plus(fr).plus(ins);
  }
  if (cif.lte(0)) return { error: "CIF \u5FC5\u987B\u5927\u4E8E 0" };
  const dutyRate = toDecimal(i.dutyRate) ?? new decimal_default(0);
  const vatRate = toDecimal(i.vatRate) ?? new decimal_default(13);
  const exciseRaw = i.exciseRate.trim() === "" ? new decimal_default(0) : toDecimal(i.exciseRate);
  if (!exciseRaw) return { error: "\u6D88\u8D39\u7A0E\u7387\u683C\u5F0F\u6709\u8BEF" };
  if (exciseRaw.gte(100)) return { error: "\u6D88\u8D39\u7A0E\u7387\u987B\u5C0F\u4E8E 100%" };
  if (exciseRaw.lt(0)) return { error: "\u6D88\u8D39\u7A0E\u7387\u4E0D\u80FD\u4E3A\u8D1F" };
  const dr = dutyRate.div(100);
  const vr = vatRate.div(100);
  const er = exciseRaw.div(100);
  const duty = cif.times(dr);
  const excise = er.isZero() ? new decimal_default(0) : cif.plus(duty).div(new decimal_default(1).minus(er)).times(er);
  const importVat = cif.plus(duty).plus(excise).times(vr);
  const totalTax = duty.plus(excise).plus(importVat);
  return {
    cif,
    duty,
    excise,
    importVat,
    totalTax,
    compositeRate: totalTax.div(cif).times(100),
    landedCost: cif.plus(totalTax)
  };
}
function calcPayment(totalStr, tiers) {
  const total = toDecimal(totalStr);
  if (!total) return { error: "\u8BF7\u8F93\u5165\u5408\u540C\u603B\u989D" };
  if (total.lt(0)) return { error: "\u5408\u540C\u603B\u989D\u4E0D\u80FD\u4E3A\u8D1F" };
  let ratioSum = new decimal_default(0);
  let amountSum = new decimal_default(0);
  const rows = tiers.map((t) => {
    const r = toDecimal(t.ratio) ?? new decimal_default(0);
    const amount = total.times(r).div(100);
    ratioSum = ratioSum.plus(r);
    amountSum = amountSum.plus(amount);
    return { id: t.id, label: t.label, ratio: r, amount };
  });
  return {
    total,
    rows,
    ratioSum,
    amountSum,
    diff: total.minus(amountSum),
    over: ratioSum.gt(100)
  };
}

// tests/core.test.mts
var pass = 0;
var fail = 0;
var failures = [];
function test(name, fn) {
  try {
    fn();
    pass++;
  } catch (e) {
    fail++;
    failures.push(`${name}
    \u2192 ${e instanceof Error ? e.message : String(e)}`);
  }
}
var D = (s) => new decimal_default(s);
var near = (a, b, eps = "1e-9") => {
  const diff = a.minus(new decimal_default(b)).abs();
  assert.ok(diff.lte(new decimal_default(eps)), `\u671F\u671B ${b}\uFF0C\u5B9E\u9645 ${a.toString()}\uFF0C\u5DEE ${diff.toString()}`);
};
var errIs = (fn, msg) => {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof CalcError, "\u5E94\u629B\u51FA CalcError");
    assert.equal(e.message, msg);
    return;
  }
  assert.fail(`\u5E94\u629B\u51FA\u300C${msg}\u300D\uFF0C\u4F46\u6CA1\u6709\u629B\u9519`);
};
test("\u5341\u8FDB\u5236\u5185\u6838 0.1+0.2 = 0.3\uFF08\u65E0\u6D6E\u70B9\u8BEF\u5DEE\uFF09", () => {
  near(evaluate("0.1+0.2", "DEG", D(0)).value, "0.3");
});
test("12 \u4F4D\u6709\u6548\u6570\u5B57 + \u53BB\u5C3E\u96F6", () => {
  assert.equal(formatNumber(D("1.23456789012345678")), "1.23456789012");
  assert.equal(formatNumber(D("5.10")), "5.1");
  assert.equal(formatNumber(D("100")), "100");
});
test("\u7EDD\u5BF9\u503C \u22651e12 \u81EA\u52A8\u79D1\u5B66\u8BA1\u6570\u6CD5", () => {
  const s = formatNumber(D("1234567890123456"));
  assert.ok(s.includes("e+"), `\u5E94\u79D1\u5B66\u8BA1\u6570\u6CD5\uFF0C\u5B9E\u9645 ${s}`);
});
test("\u7EDD\u5BF9\u503C <1e-9 \u81EA\u52A8\u79D1\u5B66\u8BA1\u6570\u6CD5", () => {
  const s = formatNumber(D("0.0000000000123"));
  assert.ok(s.includes("e-"), `\u5E94\u79D1\u5B66\u8BA1\u6570\u6CD5\uFF0C\u5B9E\u9645 ${s}`);
});
test("\u91D1\u989D\u56FA\u5B9A 2 \u4F4D / \u6C47\u7387\u56FA\u5B9A 4 \u4F4D", () => {
  assert.equal(formatNumber(D("1130"), { decimals: 2 }), "1,130.00");
  assert.equal(formatNumber(D("7.12345"), { decimals: 4 }), "7.1235");
});
test("half-up \u56DB\u820D\u4E94\u5165\uFF08\u975E\u94F6\u884C\u5BB6\u820D\u5165\uFF09", () => {
  assert.equal(formatNumber(D("2.5"), { decimals: 0 }), "3");
  assert.equal(formatNumber(D("0.125"), { decimals: 2 }), "0.13");
  assert.equal(formatNumber(D("1.005"), { decimals: 2 }), "1.01");
});
test("\u5343\u5206\u4F4D\u4EC5\u5C55\u793A\u5C42\u751F\u6548", () => {
  assert.equal(formatNumber(D("1234567.891"), { decimals: 2 }), "1,234,567.89");
  assert.equal(parseDecimal2("1,234,567.89")?.toString(), "1234567.89");
});
test("\u9A8C\u65361\uFF1A2*(3+4) = 14", () => {
  near(evaluate("2*(3+4)", "DEG", D(0)).value, "14");
  assert.equal(toDisplayExpr("2*(3+4)"), "2\xD7(3+4)");
});
test("\u9A8C\u65362\uFF1A5/0 \u63D0\u793A\u300C\u9664\u6570\u4E0D\u80FD\u4E3A 0\u300D", () => {
  errIs(() => evaluate("5/0", "DEG", D(0)), "\u9664\u6570\u4E0D\u80FD\u4E3A 0");
});
test("\u9A8C\u65364\uFF1ARAD \u4E0B sin(\u03C0) \u2248 0\uFF081e-12 \u5185\uFF09", () => {
  near(evaluate("sin(pi)", "RAD", D(0)).value, "0", "1e-12");
});
test("\u9A8C\u65365\uFF1A2*(3+4 \u63D0\u793A\u62EC\u53F7\u672A\u95ED\u5408", () => {
  errIs(() => evaluate("2*(3+4", "DEG", D(0)), "\u62EC\u53F7\u672A\u95ED\u5408");
});
test("\u5F02\u5E38\uFF1Atan(90\xB0) \u8BE5\u89D2\u5EA6\u65E0\u5B9A\u4E49", () => {
  errIs(() => evaluate("tan(90)", "DEG", D(0)), "\u8BE5\u89D2\u5EA6\u65E0\u5B9A\u4E49");
});
test("\u5F02\u5E38\uFF1A\u221A(-4) \u8D1F\u6570\u4E0D\u652F\u6301\u5F00\u5E73\u65B9", () => {
  errIs(() => evaluate("sqrt(-4)", "DEG", D(0)), "\u8D1F\u6570\u4E0D\u652F\u6301\u5F00\u5E73\u65B9");
});
test("\u5F02\u5E38\uFF1A2.5! \u9636\u4E58\u4EC5\u652F\u6301\u975E\u8D1F\u6574\u6570", () => {
  errIs(() => evaluate("2.5!", "DEG", D(0)), "\u9636\u4E58\u4EC5\u652F\u6301\u975E\u8D1F\u6574\u6570");
});
test("\u5F02\u5E38\uFF1A171! \u6570\u503C\u8D85\u51FA\u53EF\u8BA1\u7B97\u8303\u56F4", () => {
  errIs(() => evaluate("171!", "DEG", D(0)), "\u6570\u503C\u8D85\u51FA\u53EF\u8BA1\u7B97\u8303\u56F4");
});
test("\u5F02\u5E38\uFF1Aln(-1) \u8BE5\u8FD0\u7B97\u4E0D\u652F\u6301\u8D1F\u6570", () => {
  errIs(() => evaluate("ln(-1)", "DEG", D(0)), "\u8BE5\u8FD0\u7B97\u4E0D\u652F\u6301\u8D1F\u6570");
});
test("\u767E\u5206\u53F7\u4F5C\u7528\u4E8E\u524D\u4E00\u4E2A\u64CD\u4F5C\u6570\uFF1A200+10% = 220", () => {
  near(evaluate("200+10%", "DEG", D(0)).value, "220");
  near(evaluate("200-10%", "DEG", D(0)).value, "180");
});
test("Ans \u53C2\u4E0E\u8FD0\u7B97", () => {
  near(evaluate("ans*2", "DEG", D(21)).value, "42");
});
test("\u9636\u4E58 5! = 120\uFF0C0! = 1", () => {
  near(evaluate("5!", "DEG", D(0)).value, "120");
  near(evaluate("0!", "DEG", D(0)).value, "1");
});
test("\u5E42\u4E0E\u6839\uFF1A2^10=1024\u3001\u221A16=4\u3001\u221B27=3\u3001root(16,4)=2", () => {
  near(evaluate("2^10", "DEG", D(0)).value, "1024");
  near(evaluate("sqrt(16)", "DEG", D(0)).value, "4");
  near(evaluate("cbrt(27)", "DEG", D(0)).value, "3");
  near(evaluate("root(16,4)", "DEG", D(0)).value, "2");
});
test("\u4E09\u89D2\u7CBE\u5EA6\uFF1Asin30=0.5\u3001cos60=0.5\uFF08DEG\uFF09", () => {
  near(evaluate("sin(30)", "DEG", D(0)).value, "0.5", "1e-20");
  near(evaluate("cos(60)", "DEG", D(0)).value, "0.5", "1e-20");
});
test("\u53CD\u4E09\u89D2\uFF1Aasin(1)=90\uFF08DEG\uFF09\u3001atan(1)=45\uFF08DEG\uFF09", () => {
  near(evaluate("asin(1)", "DEG", D(0)).value, "90", "1e-10");
  near(evaluate("atan(1)", "DEG", D(0)).value, "45", "1e-10");
});
test("\u5BF9\u6570\u6307\u6570\uFF1Aln(e)=1\u3001log10(1000)=3\u3001exp(0)=1\u300110^2=100", () => {
  near(evaluate("ln(e)", "DEG", D(0)).value, "1", "1e-20");
  near(evaluate("log10(1000)", "DEG", D(0)).value, "3", "1e-20");
  near(evaluate("exp(0)", "DEG", D(0)).value, "1");
  near(evaluate("10^2", "DEG", D(0)).value, "100");
});
test("\u9690\u5F0F\u4E58\u6CD5\uFF1A2\u03C0 \u2248 6.28318530718", () => {
  near(evaluate("2pi", "DEG", D(0)).value, "6.283185307179586", "1e-12");
});
test("\u62EC\u53F7\u5747\u8861\u68C0\u6D4B", () => {
  assert.equal(checkParens("((1+2)"), "unclosed");
  assert.equal(checkParens("1+2)"), "extra");
  assert.equal(checkParens("(1+2)"), null);
});
test("\u8FD0\u7B97\u7B26\u4F18\u5148\u7EA7\uFF1A2+3*4=14\u3001(2+3)*4=20\u30012^3^2=512\uFF08\u53F3\u7ED3\u5408\uFF09", () => {
  near(evaluate("2+3*4", "DEG", D(0)).value, "14");
  near(evaluate("(2+3)*4", "DEG", D(0)).value, "20");
  near(evaluate("2^3^2", "DEG", D(0)).value, "512");
});
test("\u4E00\u5143\u8D1F\u53F7\uFF1A-3^2 = -9\u3001(-3)^2 = 9", () => {
  near(evaluate("-3^2", "DEG", D(0)).value, "-9");
  near(evaluate("(-3)^2", "DEG", D(0)).value, "9");
});
test("CBM\uFF1A60\xD740\xD730cm\u300110\u7BB1 \u2192 \u5355\u7BB1 0.072\u3001\u603B 0.72", () => {
  const r = calcCbm({ length: "60", width: "40", height: "30", unit: "cm", boxes: "10" });
  assert.ok(!("error" in r));
  near(r.single, "0.072");
  near(r.total, "0.72");
});
test("CBM\uFF1A\u6539\u7528 m \u8F93\u5165 0.6\xD70.4\xD70.3 \u7ED3\u679C\u4E00\u81F4", () => {
  const r = calcCbm({ length: "0.6", width: "0.4", height: "0.3", unit: "m", boxes: "1" });
  assert.ok(!("error" in r));
  near(r.total, "0.072");
});
test("CBM\uFF1A\u6750\u79EF ft\xB3 = m\xB3 \xD7 35.3147", () => {
  const r = calcCbm({ length: "60", width: "40", height: "30", unit: "cm", boxes: "10" });
  near(r.cft, "25.426584", "1e-6");
});
test("CBM\uFF1A\u4EFB\u4E00\u7EF4\u4E3A 0 \u62D2\u7EDD\u8BA1\u7B97", () => {
  const r = calcCbm({ length: "0", width: "40", height: "30", unit: "cm", boxes: "1" });
  assert.ok("error" in r);
});
test("CBM\uFF1A\u5355\u8FB9 >1000m \u8F6F\u63D0\u793A\u4E0D\u963B\u65AD", () => {
  const r = calcCbm({ length: "1200", width: "1", height: "1", unit: "m", boxes: "1" });
  assert.ok(!("error" in r));
  assert.ok(r.warn);
});
test("\u4F53\u79EF\u91CD\uFF1A50\xD740\xD730\u3001\u5B9E\u96458kg\u3001\u9664\u65706000 \u2192 10kg\uFF0C\u6309\u4F53\u79EF\u91CD\u8BA1\u8D39", () => {
  const r = calcVolumeWeight({ length: "50", width: "40", height: "30", actual: "8", rule: "6000", divisor: "6000" });
  assert.ok(!("error" in r));
  near(r.volumetric, "10");
  near(r.chargeable, "10");
  assert.equal(r.byVolume, true);
});
test("\u4F53\u79EF\u91CD\uFF1A\u9664\u6570 0 \u65F6\u56DE\u843D\u9ED8\u8BA4 6000 \u5E76\u63D0\u793A", () => {
  const r = calcVolumeWeight({ length: "50", width: "40", height: "30", actual: "8", rule: "custom", divisor: "0" });
  assert.ok(!("error" in r));
  near(r.volumetric, "10");
  assert.ok(r.warn);
});
test("\u4F53\u79EF\u91CD\uFF1A\u6D77\u8FD0 W/M 1CBM = 1000kg", () => {
  const r = calcVolumeWeight({ length: "100", width: "100", height: "100", actual: "5", rule: "wm", divisor: "" });
  near(r.volumetric, "1000");
});
test("\u7A0E\u989D\uFF1A1000 @13% \u4E0D\u542B\u7A0E\u2192\u542B\u7A0E \u2192 \u7A0E130\u3001\u542B\u7A0E1130", () => {
  const r = calcVat({ amount: "1000", rate: "13", direction: "exclusive2inclusive" });
  assert.ok(!("error" in r));
  near(r.tax, "130");
  near(r.inclusive, "1130");
});
test("\u7A0E\u989D\uFF1A1130 @13% \u542B\u7A0E\u2192\u4E0D\u542B\u7A0E \u2192 1000", () => {
  const r = calcVat({ amount: "1130", rate: "13", direction: "inclusive2exclusive" });
  near(r.exclusive, "1000", "1e-10");
  near(r.tax, "130", "1e-10");
});
test("\u7A0E\u989D\uFF1A\u7A0E\u7387 >100% \u8F6F\u63D0\u793A\u4E0D\u963B\u65AD", () => {
  const r = calcVat({ amount: "1000", rate: "150", direction: "exclusive2inclusive" });
  assert.ok(!("error" in r));
  assert.ok(r.warn);
});
test("\u7A0E\u989D\uFF1A\u91D1\u989D \u22640 \u62E6\u622A", () => {
  assert.ok("error" in calcVat({ amount: "0", rate: "13", direction: "exclusive2inclusive" }));
});
test("\u9000\u7A0E\uFF1A11300 \u542B\u7A0E\u300113%/13% \u2192 \u4E0D\u542B\u7A0E10000\u3001\u53EF\u90001300\u3001\u4E0D\u53EF\u90000\u3001\u6210\u672C10000", () => {
  const r = calcExportRefund({ purchaseIncl: "11300", levyRate: "13", refundRate: "13" });
  assert.ok(!("error" in r));
  near(r.exclusive, "10000", "1e-10");
  near(r.refundable, "1300", "1e-10");
  near(r.nonRefundable, "0", "1e-10");
  near(r.realCost, "10000", "1e-10");
});
test("\u9000\u7A0E\uFF1A\u9000\u7A0E\u7387\u6539 9% \u2192 \u53EF\u9000900\u3001\u4E0D\u53EF\u9000400\u3001\u6210\u672C10400", () => {
  const r = calcExportRefund({ purchaseIncl: "11300", levyRate: "13", refundRate: "9" });
  near(r.refundable, "900", "1e-10");
  near(r.nonRefundable, "400", "1e-10");
  near(r.realCost, "10400", "1e-10");
});
test("\u9000\u7A0E\uFF1A\u9000\u7A0E\u7387 > \u5F81\u7A0E\u7387 \u8F6F\u63D0\u793A", () => {
  const r = calcExportRefund({ purchaseIncl: "11300", levyRate: "9", refundRate: "13" });
  assert.ok(r.warn);
});
test("\u8FDB\u53E3\u7A0E\uFF1ACIF10000\u3001\u5173\u7A0E8%\u3001\u6D88\u8D39\u7A0E0\u3001\u589E\u503C\u7A0E13% \u2192 \u5173\u7A0E800\u3001\u589E\u503C\u7A0E1404\u3001\u5408\u8BA12204\u3001\u7EFC\u540822.04%\u3001\u6210\u672C12204", () => {
  const r = calcImportTax({
    mode: "cif",
    cif: "10000",
    fob: "",
    freight: "",
    insurance: "",
    dutyRate: "8",
    vatRate: "13",
    exciseRate: "0"
  });
  assert.ok(!("error" in r));
  near(r.duty, "800", "1e-10");
  near(r.excise, "0");
  near(r.importVat, "1404", "1e-10");
  near(r.totalTax, "2204", "1e-10");
  near(r.compositeRate, "22.04", "1e-10");
  near(r.landedCost, "12204", "1e-10");
});
test("\u8FDB\u53E3\u7A0E\u3010\u5FC5\u5B88\u3011\uFF1ACIF10000\u3001\u5173\u7A0E0\u3001\u6D88\u8D39\u7A0E10%\u3001\u589E\u503C\u7A0E13% \u2192 \u6D88\u8D39\u7A0E1111.11\u3001\u589E\u503C\u7A0E1444.44\uFF08\u4E0D\u5F97\u4E3A1300\uFF09", () => {
  const r = calcImportTax({
    mode: "cif",
    cif: "10000",
    fob: "",
    freight: "",
    insurance: "",
    dutyRate: "0",
    vatRate: "13",
    exciseRate: "10"
  });
  assert.ok(!("error" in r));
  near(r.excise, "1111.1111111", "1e-6");
  near(r.importVat, "1444.4444444", "1e-6");
  near(r.totalTax, "2555.5555556", "1e-6");
  const wrong = r.importVat;
  assert.ok(wrong.minus(new decimal_default("1300")).abs().gt(new decimal_default("100")), "\u589E\u503C\u7A0E\u8BA1\u7A0E\u57FA\u7840\u5FC5\u987B\u542B\u6D88\u8D39\u7A0E");
});
test("\u8FDB\u53E3\u7A0E\uFF1A\u6D88\u8D39\u7A0E\u7387 100 \u62E6\u622A", () => {
  const r = calcImportTax({
    mode: "cif",
    cif: "10000",
    fob: "",
    freight: "",
    insurance: "",
    dutyRate: "8",
    vatRate: "13",
    exciseRate: "100"
  });
  assert.ok("error" in r);
  assert.match(r.error, /小于 100/);
});
test("\u8FDB\u53E3\u7A0E\uFF1ACIF \u22640 \u62E6\u622A", () => {
  assert.ok("error" in calcImportTax({ mode: "cif", cif: "0", fob: "", freight: "", insurance: "", dutyRate: "8", vatRate: "13", exciseRate: "0" }));
});
test("\u8FDB\u53E3\u7A0E\uFF1AFOB+\u8FD0\u8D39+\u4FDD\u9669 \u4E09\u9879\u5408\u8BA1\u4E3A CIF", () => {
  const r = calcImportTax({
    mode: "fob",
    cif: "",
    fob: "9000",
    freight: "800",
    insurance: "200",
    dutyRate: "8",
    vatRate: "13",
    exciseRate: "0"
  });
  assert.ok(!("error" in r));
  near(r.cif, "10000");
});
test("\u8FDB\u53E3\u7A0E\uFF1A\u6D88\u8D39\u7A0E\u7559\u7A7A\u89C6\u540C 0", () => {
  const r = calcImportTax({
    mode: "cif",
    cif: "10000",
    fob: "",
    freight: "",
    insurance: "",
    dutyRate: "8",
    vatRate: "13",
    exciseRate: ""
  });
  assert.ok(!("error" in r));
  near(r.excise, "0");
});
test("\u8D27\u6B3E\u6BD4\u4F8B\uFF1A10000\u300130%/80% \u2192 \u5408\u8BA1110% \u63D0\u793A\u8D85 100% \u4F46\u4FDD\u7559", () => {
  const r = calcPayment("10000", [
    { id: "a", label: "\u5B9A\u91D1", ratio: "30" },
    { id: "b", label: "\u5C3E\u6B3E", ratio: "80" }
  ]);
  assert.ok(!("error" in r));
  near(r.ratioSum, "110");
  assert.equal(r.over, true);
  near(r.rows[0].amount, "3000");
  near(r.rows[1].amount, "8000");
});
test("\u8D27\u6B3E\u6BD4\u4F8B\uFF1A30%/70% \u2192 \u5408\u8BA1 100%\u3001\u5DEE\u989D 0", () => {
  const r = calcPayment("10000", [
    { id: "a", label: "\u5B9A\u91D1", ratio: "30" },
    { id: "b", label: "\u5C3E\u6B3E", ratio: "70" }
  ]);
  assert.equal(r.over, false);
  near(r.diff, "0");
});
test("\u6C47\u7387\uFF1A\u4E2D\u884C\u6BCF100\u5916\u5E01\u62A5\u4EF7712.34 \u2192 1USD=7.1234\uFF1BCNY1000 \u2192 140.38 USD", () => {
  const raw = 712.34;
  const perUnit = new decimal_default(raw).div(100);
  near(perUnit, "7.1234");
  const usd = new decimal_default(1e3).div(perUnit);
  near(usd, "140.3824", "1e-4");
  assert.equal(formatNumber(usd, { decimals: 2 }), "140.38");
});
var LEN = { mm: "0.001", cm: "0.01", m: "1", km: "1000", in: "0.0254", ft: "0.3048", yd: "0.9144", mi: "1609.344", nmi: "1852" };
var conv = (v, table, from, to) => v.times(table[from]).div(table[to]);
test("\u5355\u4F4D\uFF1A1 m \u2192 100cm / 1000mm / 39.3701in / 3.2808ft", () => {
  assert.equal(formatNumber(conv(D(1), LEN, "m", "cm"), { decimals: 4 }), "100.0000");
  assert.equal(formatNumber(conv(D(1), LEN, "m", "mm"), { decimals: 4 }), "1,000.0000");
  assert.equal(formatNumber(conv(D(1), LEN, "m", "in"), { decimals: 4 }), "39.3701");
  assert.equal(formatNumber(conv(D(1), LEN, "m", "ft"), { decimals: 4 }), "3.2808");
});
test("\u5355\u4F4D\uFF1A\u6E29\u5EA6 100\u2103 \u2192 212\u2109 / 373.15K", () => {
  assert.equal(formatNumber(D(100).times(9).div(5).plus(32), { decimals: 2 }), "212.00");
  assert.equal(formatNumber(D(100).plus("273.15"), { decimals: 2 }), "373.15");
});
test("\u5355\u4F4D\uFF1A32\u2109 \u2192 0\u2103\uFF08\u4E0D\u5F97\u663E\u793A 17.78\uFF09", () => {
  const c = D(32).minus(32).times(5).div(9);
  assert.equal(formatNumber(c, { decimals: 4 }), "0.0000");
});
test("\u5355\u4F4D\uFF1A2 \u65A4 \u2192 1kg / 1000g", () => {
  const KG = { g: "0.001", kg: "1", t: "1000", jin: "0.5", liang: "0.05", lb: "0.45359237", oz: "0.028349523125", stone: "6.35029318" };
  assert.equal(formatNumber(conv(D(2), KG, "jin", "kg"), { decimals: 4 }), "1.0000");
  assert.equal(formatNumber(conv(D(2), KG, "jin", "g"), { decimals: 4 }), "1,000.0000");
});
test("\u5355\u4F4D\uFF1A1 \u4EA9 \u2248 666.6667 m\xB2", () => {
  const AREA = { m2: "1", mu: "666.6666666666666666667" };
  assert.equal(formatNumber(conv(D(1), AREA, "mu", "m2"), { decimals: 4 }), "666.6667");
});
test("\u538B\u529B\uFF1A\u8FDE\u7EED 20000 \u6B21\u6C42\u503C\u8017\u65F6 < 3s \u4E14\u7ED3\u679C\u7A33\u5B9A", () => {
  const t0 = Date.now();
  let acc = new decimal_default(0);
  for (let i = 0; i < 2e4; i++) {
    acc = acc.plus(evaluate(`(${i % 97}+${i % 13})*2-${i % 7}`, "DEG", D(i)).value);
  }
  const dt = Date.now() - t0;
  assert.ok(Number.isFinite(Number(acc.toString())));
  assert.ok(dt < 3e3, `20000 \u6B21\u6C42\u503C\u8017\u65F6 ${dt}ms\uFF0C\u8D85\u8FC7 3s`);
});
test("\u538B\u529B\uFF1A\u4E09\u89D2/\u5BF9\u6570\u6DF7\u5408 5000 \u6B21\u6C42\u503C < 3s", () => {
  const t0 = Date.now();
  for (let i = 1; i <= 5e3; i++) {
    evaluate(`sin(${i % 360})+cos(${i % 360})*ln(${i + 1})`, "DEG", D(0));
  }
  const dt = Date.now() - t0;
  assert.ok(dt < 3e3, `5000 \u6B21\u4E09\u89D2\u6C42\u503C\u8017\u65F6 ${dt}ms`);
});
test("\u538B\u529B\uFF1A1000 \u5E01\u79CD\u6362\u6C47\u8BA1\u7B97 < 200ms", () => {
  const t0 = Date.now();
  const prices = Array.from({ length: 45 }, (_, i) => new decimal_default(1).plus(new decimal_default(i).div(10)));
  const amount = new decimal_default(1e3);
  let sum2 = new decimal_default(0);
  for (let i = 0; i < 1e3; i++) {
    for (const p of prices) sum2 = sum2.plus(amount.div(p));
  }
  const dt = Date.now() - t0;
  assert.ok(dt < 200, `1080 \u6B21\u6362\u6C47\u8017\u65F6 ${dt}ms`);
});
console.log(`
  \u901A\u8FC7 ${pass} \u9879 \xB7 \u5931\u8D25 ${fail} \u9879
`);
if (failures.length) {
  console.log("\u5931\u8D25\u660E\u7EC6\uFF1A");
  for (const f of failures) console.log(`  \u2717 ${f}`);
  process.exit(1);
}
console.log("  \u5168\u90E8\u9A8C\u6536\u7528\u4F8B\u901A\u8FC7 \u2713\n");
/*! Bundled license information:

decimal.js/decimal.mjs:
  (*!
   *  decimal.js v10.6.0
   *  An arbitrary-precision Decimal type for JavaScript.
   *  https://github.com/MikeMcl/decimal.js
   *  Copyright (c) 2025 Michael Mclaughlin <M8ch88l@gmail.com>
   *  MIT Licence
   *)
*/
