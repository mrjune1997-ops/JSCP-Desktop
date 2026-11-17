import { Decimal } from './format'

/** 计算错误：message 直接面向用户 */
export class CalcError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CalcError'
  }
}

const PI = new Decimal(
  '3.14159265358979323846264338327950288419716939937510582097494459230781640628620899862803482534211706798'
)
const E_CONST = new Decimal(
  '2.71828182845904523536028747135266249775724709369995957496696762772407663035354759457138217852516642743'
)

export { PI, E_CONST }

/** 低于该阈值的三角结果视为 0（40 位内部精度下的噪声） */
const TRIG_ZERO = new Decimal('1e-25')

function decSin(x: Decimal): Decimal {
  const twoPi = PI.times(2)
  let v = x.mod(twoPi)
  if (v.gt(PI)) v = v.minus(twoPi)
  if (v.lt(PI.neg())) v = v.plus(twoPi)
  let term = v
  let sum = v
  const v2 = v.times(v)
  for (let n = 1; n < 120; n++) {
    term = term.times(v2).div((2 * n) * (2 * n + 1)).neg()
    sum = sum.plus(term)
    if (term.abs().lt(new Decimal('1e-42'))) break
  }
  return sum.abs().lt(TRIG_ZERO) ? new Decimal(0) : sum
}

function decCos(x: Decimal): Decimal {
  const twoPi = PI.times(2)
  let v = x.mod(twoPi)
  if (v.gt(PI)) v = v.minus(twoPi)
  if (v.lt(PI.neg())) v = v.plus(twoPi)
  let term = new Decimal(1)
  let sum = new Decimal(1)
  const v2 = v.times(v)
  for (let n = 1; n < 120; n++) {
    term = term.times(v2).div((2 * n - 1) * (2 * n)).neg()
    sum = sum.plus(term)
    if (term.abs().lt(new Decimal('1e-42'))) break
  }
  return sum.abs().lt(TRIG_ZERO) ? new Decimal(0) : sum
}

function decAtan(x: Decimal): Decimal {
  if (x.isZero()) return new Decimal(0)
  const neg = x.isNegative()
  let v = x.abs()
  let invert = false
  if (v.gt(1)) {
    v = new Decimal(1).div(v)
    invert = true
  }
  // 两次半角缩减：atan(v) = 2 atan(v / (1 + sqrt(1+v²)))
  let k = 0
  for (let i = 0; i < 3; i++) {
    v = v.div(new Decimal(1).plus(v.times(v).plus(1).sqrt()))
    k++
  }
  const v2 = v.times(v)
  let term = v
  let sum = v
  for (let n = 1; n < 200; n++) {
    term = term.times(v2).neg()
    const add = term.div(2 * n + 1)
    sum = sum.plus(add)
    if (add.abs().lt(new Decimal('1e-42'))) break
  }
  let r = sum.times(Math.pow(2, k))
  if (invert) r = PI.div(2).minus(r)
  return neg ? r.neg() : r
}

function decAsin(x: Decimal): Decimal {
  if (x.abs().gt(1)) throw new CalcError('输入超出定义域，无实数结果')
  if (x.abs().eq(1)) return x.isNegative() ? PI.div(2).neg() : PI.div(2)
  return decAtan(x.div(new Decimal(1).minus(x.times(x)).sqrt()))
}

function decAcos(x: Decimal): Decimal {
  if (x.abs().gt(1)) throw new CalcError('输入超出定义域，无实数结果')
  return PI.div(2).minus(decAsin(x))
}

function decFactorial(n: Decimal): Decimal {
  if (!n.isInteger() || n.isNegative()) throw new CalcError('阶乘仅支持非负整数')
  if (n.gt(170)) throw new CalcError('数值超出可计算范围')
  let r = new Decimal(1)
  for (let i = 2; i <= n.toNumber(); i++) r = r.times(i)
  return r
}

// ---------- 词法 ----------

type TokType = 'num' | 'ident' | 'op' | 'lparen' | 'rparen' | 'comma' | 'end'

interface Tok {
  type: TokType
  text: string
}

function tokenize(src: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === ' ' || c === '\t') {
      i++
      continue
    }
    if (/[0-9.]/.test(c)) {
      let j = i
      while (j < src.length && /[0-9.]/.test(src[j])) j++
      // 科学计数法后缀 e/E
      if (j < src.length && /[eE]/.test(src[j]) && /[0-9+\-]/.test(src[j + 1] ?? '')) {
        let k = j + 1
        if (/[+\-]/.test(src[k])) k++
        if (/[0-9]/.test(src[k] ?? '')) {
          while (k < src.length && /[0-9]/.test(src[k])) k++
          j = k
        }
      }
      const text = src.slice(i, j)
      if ((text.match(/\./g) || []).length > 1) throw new CalcError('数字格式有误')
      toks.push({ type: 'num', text })
      i = j
      continue
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++
      toks.push({ type: 'ident', text: src.slice(i, j).toLowerCase() })
      i = j
      continue
    }
    if ('+-*/^!%'.includes(c)) {
      toks.push({ type: 'op', text: c })
      i++
      continue
    }
    if (c === '(') {
      toks.push({ type: 'lparen', text: c })
      i++
      continue
    }
    if (c === ')') {
      toks.push({ type: 'rparen', text: c })
      i++
      continue
    }
    if (c === ',' || c === '，') {
      toks.push({ type: 'comma', text: ',' })
      i++
      continue
    }
    if (c === '×') {
      toks.push({ type: 'op', text: '*' })
      i++
      continue
    }
    if (c === '÷') {
      toks.push({ type: 'op', text: '/' })
      i++
      continue
    }
    if (c === 'π') {
      toks.push({ type: 'ident', text: 'pi' })
      i++
      continue
    }
    if (c === '√') {
      toks.push({ type: 'ident', text: 'sqrt' })
      i++
      continue
    }
    throw new CalcError(`无法识别的字符：${c}`)
  }
  toks.push({ type: 'end', text: '' })
  return toks
}

// ---------- 语法 ----------

interface Val {
  v: Decimal
  /** 该子表达式带百分号标记，用于 200+10% 语义 */
  pct: boolean
}

const FUNCS = new Set([
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
  'ln', 'lg', 'log10', 'log', 'exp', 'sqrt', 'cbrt', 'root', 'abs'
])

class Parser {
  private pos = 0
  constructor(
    private toks: Tok[],
    private angleMode: 'DEG' | 'RAD',
    private ans: Decimal
  ) {}

  private peek(): Tok {
    return this.toks[this.pos]
  }
  private next(): Tok {
    return this.toks[this.pos++]
  }
  private isOp(text: string): boolean {
    const t = this.peek()
    return t.type === 'op' && t.text === text
  }

  parse(): Val {
    const v = this.additive()
    if (this.peek().type !== 'end') {
      const t = this.peek()
      if (t.type === 'rparen') throw new CalcError('括号未闭合')
      throw new CalcError(`表达式有误：多余符号 ${t.text}`)
    }
    return v
  }

  private toRad(d: Decimal): Decimal {
    return this.angleMode === 'DEG' ? d.times(PI).div(180) : d
  }
  private fromRad(d: Decimal): Decimal {
    return this.angleMode === 'DEG' ? d.times(180).div(PI) : d
  }

  private additive(): Val {
    let left = this.multiplicative()
    while (this.isOp('+') || this.isOp('-')) {
      const op = this.next().text
      const right = this.multiplicative()
      let rv = right.v
      if (right.pct) {
        // 200 + 10% → 200 + 200*0.1
        rv = left.v.times(rv)
      }
      left = { v: op === '+' ? left.v.plus(rv) : left.v.minus(rv), pct: false }
    }
    return left
  }

  private multiplicative(): Val {
    let left = this.unary()
    for (;;) {
      if (this.isOp('*') || this.isOp('/')) {
        const op = this.next().text
        const right = this.unary()
        if (op === '/') {
          if (right.v.isZero()) throw new CalcError('除数不能为 0')
          left = { v: left.v.div(right.v), pct: false }
        } else {
          left = { v: left.v.times(right.v), pct: false }
        }
        continue
      }
      // 隐式乘法：2π、3(4+5)、2sin(π)
      const t = this.peek()
      if (t.type === 'num' || t.type === 'lparen' || (t.type === 'ident' && (t.text === 'pi' || t.text === 'e' || t.text === 'ans' || FUNCS.has(t.text)))) {
        const right = this.unary()
        left = { v: left.v.times(right.v), pct: false }
        continue
      }
      break
    }
    return left
  }

  private unary(): Val {
    if (this.isOp('-')) {
      this.next()
      const v = this.unary()
      return { v: v.v.neg(), pct: v.pct }
    }
    if (this.isOp('+')) {
      this.next()
      return this.unary()
    }
    return this.power()
  }

  private power(): Val {
    const base = this.postfix()
    if (this.isOp('^')) {
      this.next()
      const exp = this.unary()
      if (base.v.isNegative() && !exp.v.isInteger()) {
        const inv = new Decimal(1).div(exp.v)
        if (inv.isInteger() && inv.mod(2).eq(0)) return { v: sqrtDecimal(base.v), pct: false }
        throw new CalcError('该运算不支持负数')
      }
      return { v: base.v.pow(exp.v), pct: false }
    }
    return base
  }

  private postfix(): Val {
    let val = this.primary()
    for (;;) {
      const t = this.peek()
      if (t.type === 'op' && t.text === '!') {
        this.next()
        val = { v: decFactorial(val.v), pct: false }
        continue
      }
      if (t.type === 'op' && t.text === '%') {
        this.next()
        val = { v: val.v.div(100), pct: true }
        continue
      }
      break
    }
    return val
  }

  private primary(): Val {
    const t = this.next()
    if (t.type === 'num') {
      try {
        const d = new Decimal(t.text)
        if (!d.isFinite()) throw new CalcError('数值超出可计算范围')
        return { v: d, pct: false }
      } catch (e) {
        if (e instanceof CalcError) throw e
        throw new CalcError('数字格式有误')
      }
    }
    if (t.type === 'lparen') {
      const v = this.additive()
      const close = this.peek()
      if (close.type !== 'rparen') throw new CalcError('括号未闭合')
      this.next()
      return v
    }
    if (t.type === 'ident') {
      const name = t.text
      if (name === 'pi') return { v: PI, pct: false }
      if (name === 'e') return { v: E_CONST, pct: false }
      if (name === 'ans') return { v: this.ans, pct: false }
      if (FUNCS.has(name)) return this.callFunc(name)
      throw new CalcError(`未知符号：${name}`)
    }
    if (t.type === 'end') throw new CalcError('表达式不完整')
    throw new CalcError('表达式有误')
  }

  private callFunc(name: string): Val {
    const args: Decimal[] = []
    if (this.peek().type === 'lparen') {
      this.next()
      if (this.peek().type !== 'rparen') {
        for (;;) {
          const v = this.additive()
          args.push(v.v)
          if (this.peek().type === 'comma') {
            this.next()
            continue
          }
          break
        }
      }
      if (this.peek().type !== 'rparen') throw new CalcError('括号未闭合')
      this.next()
    } else {
      // 允许 sin 90 形式的单参数调用
      const v = this.unary()
      args.push(v.v)
    }
    const a0 = args[0] ?? new Decimal(0)
    switch (name) {
      case 'sin':
        return { v: decSin(this.toRad(a0)), pct: false }
      case 'cos':
        return { v: decCos(this.toRad(a0)), pct: false }
      case 'tan': {
        if (this.angleMode === 'DEG') {
          const m = a0.mod(180)
          if (m.abs().eq(90)) throw new CalcError('该角度无定义')
        } else {
          const half = PI.div(2)
          const m = a0.minus(half).div(PI)
          if (m.isInteger()) throw new CalcError('该角度无定义')
        }
        return { v: decSin(this.toRad(a0)).div(decCos(this.toRad(a0))), pct: false }
      }
      case 'asin':
        return { v: this.fromRad(decAsin(a0)), pct: false }
      case 'acos':
        return { v: this.fromRad(decAcos(a0)), pct: false }
      case 'atan':
        return { v: this.fromRad(decAtan(a0)), pct: false }
      case 'ln':
      case 'log':
        if (a0.lte(0)) throw new CalcError('该运算不支持负数')
        return { v: a0.ln(), pct: false }
      case 'lg':
      case 'log10':
        if (a0.lte(0)) throw new CalcError('该运算不支持负数')
        return { v: a0.ln().div(new Decimal(10).ln()), pct: false }
      case 'exp':
        return { v: a0.exp(), pct: false }
      case 'sqrt':
        return { v: sqrtDecimal(a0), pct: false }
      case 'cbrt': {
        if (a0.isNegative()) return { v: a0.abs().cbrt().neg(), pct: false }
        return { v: a0.cbrt(), pct: false }
      }
      case 'root': {
        const n = args[1] ?? new Decimal(2)
        if (n.isZero()) throw new CalcError('除数不能为 0')
        if (a0.isNegative() && !n.isInteger()) throw new CalcError('该运算不支持负数')
        if (n.isInteger() && n.mod(2).eq(0) && a0.isNegative()) throw new CalcError('负数不支持开平方')
        if (a0.isNegative()) return { v: a0.abs().pow(new Decimal(1).div(n)).neg(), pct: false }
        return { v: a0.pow(new Decimal(1).div(n)), pct: false }
      }
      case 'abs':
        return { v: a0.abs(), pct: false }
      default:
        throw new CalcError(`未知函数：${name}`)
    }
  }
}

function sqrtDecimal(v: Decimal): Decimal {
  if (v.isNegative()) throw new CalcError('负数不支持开平方')
  return v.sqrt()
}

export interface EvalResult {
  value: Decimal
  /** 结果是否达到可表示上限 */
  overflow: boolean
}

/** 括号均衡检查，返回缺失类型 */
export function checkParens(expr: string): 'unclosed' | 'extra' | null {
  let depth = 0
  for (const c of expr) {
    if (c === '(') depth++
    else if (c === ')') {
      depth--
      if (depth < 0) return 'extra'
    }
  }
  return depth > 0 ? 'unclosed' : null
}

/** 求值：expr 为 ASCII 表达式 */
export function evaluate(expr: string, angleMode: 'DEG' | 'RAD', ans: Decimal): EvalResult {
  const trimmed = expr.trim()
  if (!trimmed) throw new CalcError('表达式不完整')
  const balance = checkParens(trimmed)
  if (balance === 'unclosed') throw new CalcError('括号未闭合')
  if (balance === 'extra') throw new CalcError('括号有多余的右括号')
  const p = new Parser(tokenize(trimmed), angleMode, ans)
  const { v } = p.parse()
  if (!v.isFinite()) throw new CalcError('数值超出可计算范围')
  return { value: v, overflow: v.abs().gte(new Decimal('1e308')) }
}

/** 表达式转展示文本：× ÷ π √ Ans */
export function toDisplayExpr(expr: string): string {
  return expr
    .replace(/\bsqrt\(/g, '√(')
    .replace(/\bpi\b/g, 'π')
    .replace(/\bans\b/gi, 'Ans')
    .replace(/\*/g, '×')
    .replace(/\//g, '÷')
    .replace(/cbrt\(/g, '∛(')
    .replace(/\blog10\(/g, 'log(')
    .replace(/\blg\(/g, 'log(')
}

/** 正态化用户输入：把中文符号转成 ASCII */
export function normalizeInput(raw: string): string {
  return raw
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/，/g, ',')
    .replace(/π/g, 'pi')
    .replace(/√/g, 'sqrt(')
}
