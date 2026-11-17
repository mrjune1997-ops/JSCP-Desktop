/**
 * 界面级验收脚本（由主进程在 JSCP_E2E 模式下注入执行）
 * 覆盖：键盘输入计算、历史写入、主题切换、模块切换、压力测试
 */
export const E2E_SCRIPT = String.raw`
(async () => {
  const R = { steps: [], errors: [] }
  const wait = (ms) => new Promise(r => setTimeout(r, ms))
  const log = (name, ok, detail) => R.steps.push({ name, ok, detail: detail === undefined ? null : detail })

  const key = (k, opts) => {
    const o = Object.assign({ key: k, bubbles: true, cancelable: true }, opts || {})
    window.dispatchEvent(new KeyboardEvent('keydown', o))
    window.dispatchEvent(new KeyboardEvent('keyup', o))
  }
  // 逐键输入，每键之间留出 React 渲染时间（模拟真实人工输入节奏）
  const type = async (keys, gap) => {
    for (const k of keys) { key(k); await wait(gap || 45) }
  }
  const resultText = () => ((document.querySelector('.sci-result') || {}).textContent || '').trim()
  const exprText = () => ((document.querySelector('.sci-expr') || {}).textContent || '').trim()
  const clean = (s) => (s || '').replace(/[,\s]/g, '')
  const clearAll = async () => { key('Escape'); await wait(220) }

  // ---- 0. 确保停留在科学计算页 ----
  window.dispatchEvent(new CustomEvent('cluo:nav', { detail: 'sci' }))
  await wait(900)
  log('进入科学计算页', !!document.querySelector('.sci-result'), null)

  // ---- 1. 键盘输入表达式 ----
  await clearAll()
  await type(['1','2','*','3','+','4'])
  await wait(200)
  log('键盘输入表达式', /12/.test(exprText()) && /3/.test(exprText()), exprText())

  // ---- 2. Enter 求值 12*3+4 = 40 ----
  key('Enter')
  await wait(700)
  const r1 = clean(resultText())
  log('Enter 求值 12*3+4=40', r1 === '40', r1)

  // ---- 3. Esc 清空表达式 ----
  await clearAll()
  log('Esc 清空表达式', exprText() === '' || !/12/.test(exprText()), 'expr=["' + exprText() + '"]')

  // ---- 4. 7^2=49 且写入历史 ----
  await type(['7','^','2'])
  await wait(150)
  key('Enter')
  await wait(700)
  const r2 = clean(resultText())
  log('7^2=49', r2 === '49', r2)
  const histCount = document.querySelectorAll('.hist-item').length
  log('历史已写入', histCount >= 2, 'histItems=' + histCount)

  // ---- 5. 高精度 0.1+0.2 ----
  await clearAll()
  await type(['0','.','1','+','0','.','2'])
  await wait(120)
  key('Enter')
  await wait(700)
  const r3 = clean(resultText())
  log('0.1+0.2=0.3 (无浮点误差)', r3 === '0.3', r3)

  // ---- 6. 百分号语义 200+10%=220 ----
  await clearAll()
  await type(['2','0','0','+','1','0','%'])
  await wait(120)
  key('Enter')
  await wait(700)
  const r4 = clean(resultText())
  log('200+10%=220', r4 === '220', r4)

  // ---- 7. 除零报错 ----
  await clearAll()
  await type(['5','/','0'])
  await wait(120)
  key('Enter')
  await wait(700)
  log('除零显示错误态', !!document.querySelector('.sci-result.err'), resultText().slice(0, 40))

  // ---- 8. 括号不匹配报错 ----
  await clearAll()
  await type(['(','1','+','2'])
  await wait(120)
  key('Enter')
  await wait(700)
  log('括号不匹配报错', !!document.querySelector('.sci-result.err'), resultText().slice(0, 40))

  // ---- 9. 超长输入不撑破布局 ----
  await clearAll()
  for (let i = 0; i < 60; i++) key('9')
  await wait(400)
  const displayEl = document.querySelector('.sci-display')
  const noBreak = displayEl ? displayEl.scrollWidth <= displayEl.clientWidth + 4 : false
  log('超长输入不撑破布局', noBreak, 'scrollW=' + (displayEl ? displayEl.scrollWidth : 'n/a') + ' clientW=' + (displayEl ? displayEl.clientWidth : 'n/a'))
  await clearAll()

  // ---- 10. 三角函数 DEG 模式 sin(30)=0.5（用点击键帽，字母键不在键盘映射内） ----
  const clickKey = (label) => {
    for (const b of document.querySelectorAll('.key')) {
      if ((b.textContent || '').trim() === label) { b.click(); return true }
    }
    return false
  }
  await clearAll()
  clickKey('sin')
  await wait(120)
  await type(['3','0'])
  await wait(120)
  clickKey(')')
  await wait(150)
  key('Enter')
  await wait(700)
  const r5 = clean(resultText())
  log('sin(30°) = 0.5', r5 === '0.5', r5)

  // ---- 11. 阶乘 10! = 3628800 ----
  await clearAll()
  await type(['1','0'])
  await wait(120)
  clickKey('n!')
  await wait(150)
  key('Enter')
  await wait(700)
  const r6 = clean(resultText())
  log('10! = 3628800', r6 === '3628800', r6)

  // ---- 12. 主题切换 暗→亮→暗 ----
  const before = document.documentElement.dataset.theme
  document.querySelector('.theme-switch button.sun')?.click()
  await wait(450)
  const afterSun = document.documentElement.dataset.theme
  document.querySelector('.theme-switch button.moon')?.click()
  await wait(450)
  const afterMoon = document.documentElement.dataset.theme
  log('主题切换 暗→亮→暗', before === 'dark' && afterSun === 'light' && afterMoon === 'dark', before + '>' + afterSun + '>' + afterMoon)

  // ---- 13. 五模块切换 ----
  for (const m of ['rates','trade','units','clock','sci']) {
    window.dispatchEvent(new CustomEvent('cluo:nav', { detail: m }))
    await wait(400)
    const panel = document.querySelector('.panel')
    const ok = !!panel && panel.getBoundingClientRect().height > 300
    log('模块切换 ' + m, ok, ok ? 'h=' + Math.round(panel.getBoundingClientRect().height) : 'FAIL')
  }

  // ---- 14. 各模块无横向溢出 ----
  const overflowMods = []
  for (const m of ['rates','trade','units','clock']) {
    window.dispatchEvent(new CustomEvent('cluo:nav', { detail: m }))
    await wait(400)
    const pb = document.querySelector('.panel-body') || document.querySelector('.rates') || document.querySelector('.clock')
    if (pb && pb.scrollWidth > pb.clientWidth + 6) overflowMods.push(m)
  }
  log('模块无横向溢出', overflowMods.length === 0, overflowMods.join(',') || 'none')

  // ---- 15. 压力测试：60 轮 999+1 ----
  window.dispatchEvent(new CustomEvent('cluo:nav', { detail: 'sci' }))
  await wait(500)
  const t0 = performance.now()
  for (let i = 0; i < 60; i++) {
    key('Escape')
    key('9'); key('9'); key('9')
    await wait(16)
    key('+'); key('1')
    await wait(16)
    key('Enter')
    await wait(16)
  }
  const dt = performance.now() - t0
  log('压力: 60 轮 999+1', dt < 20000, Math.round(dt) + 'ms')
  await wait(400)
  log('压力后界面仍存活', !!document.querySelector('.sci-result'), resultText().slice(0, 20))

  // ---- 16. 历史条目上限不超过 100 ----
  const histNow = document.querySelectorAll('.hist-item').length
  log('历史条目 ≤ 100', histNow <= 100, 'histItems=' + histNow)

  if (performance.memory) {
    R.memoryMB = Math.round(performance.memory.usedJSHeapSize / 1048576 * 10) / 10
  }

  R.ok = R.steps.every(s => s.ok)
  R.passCount = R.steps.filter(s => s.ok).length
  R.totalCount = R.steps.length
  return JSON.stringify(R)
})()
`
