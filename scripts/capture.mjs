/**
 * 界面截图脚本：启动打包后的应用，通过 CDP 逐模块 + 逐主题截图
 * 用法：node scripts/capture.mjs
 * 产物：docs/screenshots/*.png
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(root, 'docs', 'screenshots')
const EXE = process.env.JSCP_EXE || join(root, 'build-out', 'win-unpacked', 'JSCP.exe')
const PORT = 9333

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function httpJson(path) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`)
  return res.json()
}

/** 极简 CDP 客户端 */
class CDP {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
      }
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`timeout: ${method}`))
        }
      }, 30000)
    })
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', {
      expression: expr,
      awaitPromise: true,
      returnByValue: true
    })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''))
    return r.result.value
  }
  async shot(file) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    writeFileSync(file, Buffer.from(data, 'base64'))
  }
}

const MODULES = [
  ['sci', '01-sci'],
  ['rates', '02-rates'],
  ['trade', '03-trade'],
  ['units', '04-units'],
  ['percent', '05-percent'],
  ['clock', '06-clock']
]

async function main() {
  if (!existsSync(EXE)) {
    console.error(`找不到可执行文件：${EXE}\n请先执行 npm run pack:dir 生成 win-unpacked`)
    process.exit(1)
  }
  mkdirSync(OUT, { recursive: true })

  const env = { ...process.env }
  // 关键：清空 ELECTRON_RUN_AS_NODE，否则会进入 Node 模式而启动不了窗口
  delete env.ELECTRON_RUN_AS_NODE

  const child = spawn(EXE, [`--remote-debugging-port=${PORT}`], {
    env,
    stdio: 'ignore',
    detached: false
  })
  child.on('error', (e) => console.error('启动失败:', e.message))

  // 等待调试端口就绪
  let targets = null
  for (let i = 0; i < 60; i++) {
    await wait(500)
    try {
      targets = await httpJson('/json/list')
      if (targets?.some((t) => t.type === 'page' && t.webSocketDebuggerUrl)) break
    } catch {
      /* 继续等 */
    }
  }
  const page = targets?.find((t) => t.type === 'page')
  if (!page) {
    console.error('未能连接调试端口，目标列表:', JSON.stringify(targets))
    child.kill()
    process.exit(1)
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true })
    ws.addEventListener('error', rej, { once: true })
  })
  const cdp = new CDP(ws)
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await wait(1500)

  const results = []

  for (const theme of ['dark', 'light']) {
    // 通过真实点击切换主题，避免绕过 React 状态
    await cdp.eval(`(() => {
      const btn = document.querySelector('.theme-switch .${theme === 'dark' ? 'moon' : 'sun'}');
      if (btn) btn.click();
      return btn ? 'clicked' : 'not-found';
    })()`)
    await wait(600)

    for (const [key, name] of MODULES) {
      // percent 是单位换算里的子页，先切到 units 再点百分比
      if (key === 'percent') {
        await cdp.eval(`window.dispatchEvent(new CustomEvent('cluo:nav', { detail: 'units' }))`)
        await wait(600)
        const ok = await cdp.eval(`(() => {
          const btn = [...document.querySelectorAll('button')].find(b => /百分比/.test(b.textContent || ''));
          if (btn) { btn.click(); return true } return false;
        })()`)
        if (!ok) {
          results.push({ file: `${name}-${theme}.png`, ok: false, note: '未找到百分比入口' })
          continue
        }
        await wait(900)
      } else {
        await cdp.eval(`window.dispatchEvent(new CustomEvent('cluo:nav', { detail: '${key}' }))`)
        await wait(900)
      }

      // 填一点示意数据，让截图有内容
      await fillSample(cdp, key)

      const file = join(OUT, `${name}-${theme}.png`)
      await cdp.shot(file)
      results.push({ file: `${name}-${theme}.png`, ok: true })
    }
  }

  ws.close()
  child.kill()

  console.log('\n=== 截图完成 ===')
  for (const r of results) console.log(r.ok ? '  OK ' : '  -- ', r.file, r.note || '')
}

/** 给各模块填入示意数据 */
async function fillSample(cdp, key) {
  try {
    if (key === 'sci') {
      await cdp.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
      await wait(200)
      for (const k of ['1', '2', '8', '*', '6', '.', '5']) {
        await cdp.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: '${k}', bubbles: true }))`)
        await wait(50)
      }
      await cdp.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`)
      await wait(700)
    }
    if (key === 'rates') {
      // 触发一次牌价更新（走缓存，失败也不影响截图）
      await cdp.eval(`(() => {
        const b = [...document.querySelectorAll('button')].find(x => /一键更新/.test(x.textContent || ''));
        if (b) b.click(); return !!b;
      })()`)
      await wait(3000)
    }
    if (key === 'trade') {
      await cdp.eval(`(() => {
        const btn = [...document.querySelectorAll('button')].find(b => /CBM/.test(b.textContent || ''));
        if (btn) btn.click();
        return !!btn;
      })()`)
      await wait(600)
      await cdp.eval(`(() => {
        const ins = [...document.querySelectorAll('.input')];
        const vals = ['120', '50', '40', '2'];
        ins.forEach((el, i) => {
          if (i < vals.length) {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
            setter.call(el, vals[i]);
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
        return ins.length;
      })()`)
      await wait(700)
    }
    if (key === 'units') {
      await cdp.eval(`(() => {
        const ins = [...document.querySelectorAll('.unit-input')];
        if (ins[0]) {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          setter.call(ins[0], '100');
          ins[0].dispatchEvent(new Event('input', { bubbles: true }));
        }
        return ins.length;
      })()`)
      await wait(600)
    }
    if (key === 'percent') {
      await cdp.eval(`(() => {
        const ins = [...document.querySelectorAll('.unit-input, .input')];
        const vals = ['100', '120'];
        ins.forEach((el, i) => {
          if (i < vals.length) {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
            setter.call(el, vals[i]);
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
        return ins.length;
      })()`)
      await wait(700)
    }
  } catch (e) {
    console.warn('  填数跳过:', key, e.message)
  }
}

main().catch((e) => {
  console.error('异常:', e)
  process.exit(1)
})
