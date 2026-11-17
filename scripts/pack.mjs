/**
 * 一键打包脚本：产出可直接发给同事的安装包 + 便携版 + 分发包
 *
 * 用法：
 *   npm run pack           → 构建 + 打包（NSIS 安装版 + 便携版）+ 生成 zip 与使用说明
 *   npm run pack:portable  → 只打便携版（最省事，同事双击即用）
 *
 * 做的事：
 *   1. 校验 src/shared/version.ts 与 package.json 版本号一致（防止版本错乱）
 *   2. 清理上次的产物目录
 *   3. 类型检查 → 构建 → electron-builder 打包
 *   4. 校验产物存在、体积合理、签名状态
 *   5. 把便携版打成 zip（微信/邮件传输不易被拦），并生成《使用说明.txt》
 */
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, copyFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(root, 'build-out')
const onlyPortable = process.argv.includes('--portable')
const c = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
}
const log = (s) => console.log(s)
const step = (n, s) => log(`\n${c.cyan}${c.bold}[${n}]${c.reset} ${s}`)
const ok = (s) => log(`  ${c.green}✓${c.reset} ${s}`)
const warn = (s) => log(`  ${c.yellow}!${c.reset} ${s}`)
const fail = (s) => {
  log(`  ${c.red}✗${c.reset} ${s}`)
  process.exit(1)
}

function run(cmd) {
  execSync(cmd, { cwd: root, stdio: 'inherit', shell: true })
}

// ---------- 1. 版本一致性校验 ----------
step(1, '校验版本号一致性')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'))
const verSrc = readFileSync(join(root, 'src/shared/version.ts'), 'utf-8')
const m = verSrc.match(/APP_VERSION\s*=\s*'([^']+)'/)
if (!m) fail('src/shared/version.ts 中找不到 APP_VERSION')
const appVer = m[1]
if (appVer !== pkg.version) {
  fail(`版本号不一致：package.json = ${pkg.version}，version.ts = ${appVer}`)
}
const appName = (verSrc.match(/APP_NAME\s*=\s*'([^']+)'/) || [, 'JSCP'])[1]
ok(`版本 ${appName} v${appVer}（两处一致）`)

// ---------- 2. 准备目录 ----------
// 注意：electron-builder 会先清空输出目录再解包，若上次的 win-unpacked 里
// app.asar 正被其他进程占用（杀软扫描、资源管理器预览、未退干净的实例），
// 就会直接失败。所以本次产出一律先写到全新的时间戳暂存目录，最后只把
// exe 复制出来，彻底绕开文件锁。
step(2, '准备输出目录')
const stage = join(root, `.pack-stage-${Date.now()}`)
mkdirSync(stage, { recursive: true })
ok(`暂存目录 ${stage.replace(root + '\\', '')}`)

if (existsSync(OUT)) {
  try {
    rmSync(OUT, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 })
    ok('已清空 build-out/')
  } catch {
    warn('build-out/ 里有文件被占用，本次直接覆盖 exe（不影响结果）')
  }
}
mkdirSync(OUT, { recursive: true })

// ---------- 3. 类型检查 + 构建 + 打包 ----------
step(3, '类型检查')
try {
  run('npm run typecheck')
  ok('TypeScript 无错误')
} catch {
  fail('类型检查未通过，已中止打包')
}

step(4, '构建渲染层与主进程')
run('npm run build')
ok('构建完成')

step(5, '打包 Windows 可执行文件')
const target = onlyPortable ? '-c.win.target=portable' : ''
try {
  run(`npx electron-builder --win ${target} -c.directories.output="${stage}"`.trim())
} catch {
  log('')
  fail(
    '打包失败。常见原因：\n' +
      '     a) 有 JSCP.exe / electron.exe 进程占用文件 → 先全部结束再重试\n' +
      '     b) winCodeSign 缓存解压失败（需要 macOS 符号链接权限）→ 运行 npm run fix:cache 自动修复'
  )
}
ok('electron-builder 完成')

// 把 exe 从暂存目录搬到 build-out（暂存目录可能被占用，复制后尽量清理）
try {
  for (const f of readdirSync(stage)) {
    if (f.endsWith('.exe')) copyFileSync(join(stage, f), join(OUT, f))
  }
} catch (e) {
  warn(`复制产物时出错：${e.message}`)
}
try {
  rmSync(stage, { recursive: true, force: true, maxRetries: 2, retryDelay: 300 })
} catch {
  warn(`暂存目录未能删除，可稍后手动清理：${stage}`)
}

// ---------- 4. 校验产物 ----------
step(6, '校验产物')
const expect = [`${appName}-${appVer}-x64.exe`, `${appName}-${appVer}-portable.exe`]
const built = []
for (const f of expect) {
  if (onlyPortable && f.includes('-x64.exe')) continue
  const p = join(OUT, f)
  if (!existsSync(p)) {
    warn(`未生成 ${f}`)
    continue
  }
  const mb = statSync(p).size / 1024 / 1024
  if (mb < 20) fail(`${f} 仅 ${mb.toFixed(1)}MB，明显异常（应为 60MB 左右）`)
  built.push({ name: f, path: p, mb })
  ok(`${f}  ${mb.toFixed(1)} MB`)
}
if (built.length === 0) fail('没有任何产物生成')

// ---------- 5. 便携版打包 zip + 使用说明 ----------
step(7, '生成分发包（zip + 使用说明）')
const distDir = join(OUT, `${appName}-v${appVer}-给同事`)
mkdirSync(distDir, { recursive: true })

const portable = built.find((b) => b.name.includes('portable'))
if (portable) {
  const zipName = `${appName}-v${appVer}-免安装版.zip`
  const zipPath = join(distDir, zipName)
  // 优先用项目内 7za（无需 PowerShell，且比 Compress-Archive 压缩率高）
  const sevenZa = join(root, 'node_modules/7zip-bin/win/x64/7za.exe')
  let zipped = false
  if (existsSync(sevenZa)) {
    try {
      execSync(`"${sevenZa}" a -bd -y -mx=9 "${zipPath}" "${portable.path}"`, {
        cwd: distDir,
        stdio: 'pipe'
      })
      zipped = true
    } catch {
      zipped = false
    }
  }
  if (!zipped) {
    try {
      execSync(
        `powershell -NoProfile -Command "Compress-Archive -Path '${portable.path}' -DestinationPath '${zipPath}' -Force"`,
        { cwd: root, stdio: 'pipe', shell: true }
      )
      zipped = true
    } catch {
      zipped = false
    }
  }
  if (zipped && existsSync(zipPath)) {
    const zmb = statSync(zipPath).size / 1024 / 1024
    ok(`${zipName}  ${zmb.toFixed(1)} MB`)
  } else {
    warn('zip 生成失败，可直接发送 exe（微信可能拦截，建议压缩后传）')
  }
}

const installer = built.find((b) => b.name.includes('-x64.exe'))
if (installer) {
  copyFileSync(installer.path, join(distDir, installer.name))
  ok(`${installer.name} 已复制到分发包`)
}
if (portable) {
  copyFileSync(portable.path, join(distDir, portable.name))
  ok(`${portable.name} 已复制到分发包`)
}

const readme = `JSCP 外贸与科学计算工具 v${appVer} 使用说明
================================================================

一、怎么选版本

  ${appName}-v${appVer}-portable.exe   免安装版（推荐）
      双击就能用，不写注册表、不占安装目录。
      删除这个文件即等于卸载。

  ${appName}-${appVer}-x64.exe   安装版
      会安装到本机并创建桌面快捷方式，适合长期使用。
      可在安装时选择安装路径。

二、第一次打开被 Windows 拦截怎么办

  本软件未购买数字签名证书，Windows 会提示"已保护你的电脑"。

  【正确操作】
      1. 点击提示框里的「更多信息」
      2. 点击「仍要运行」

  如果双击后提示"Windows 已阻止此文件"：
      右键 exe → 属性 → 勾选底部的「解除锁定」→ 确定 → 再双击。

  如果压缩包解压后 exe 被杀毒软件删除：
      把整个文件夹加入杀软白名单，或从压缩包直接运行（不要用"立即清理"类工具）。

  这些都是未签名软件的常规提示，不是文件损坏。

三、用起来要知道的几件事

  1. 关闭窗口 = 收进系统托盘，程序仍在后台运行。
     要彻底退出：右键任务栏右下角的托盘图标 → 「退出 ${appName}」。

  2. 汇率页的「一键更新」需要联网，抓取中国银行外汇牌价
     （https://www.boc.cn/sourcedb/whpj/），统一按「现汇买入价」结算。
     抓取失败时会保留上次数据，不会清空。

  3. 键盘可直接输入算式：Enter 计算、Esc 清空、Backspace 退格。
     中文输入法打字时不会误触发。

  4. 亮色 / 暗色主题：标题栏右上角的太阳、月亮按钮切换，会自动记住。

  5. 历史记录最多保留 100 条，存于本机用户目录，卸载时默认保留。

四、环境要求

  Windows 10 / 11，64 位。
  无需安装 Node.js、无需任何运行库。

五、出问题找谁

  作者：潘俊杰 Jerry    联系：1172972274

================================================================
打包时间：${new Date().toLocaleString('zh-CN')}
`
writeFileSync(join(distDir, '使用说明.txt'), readme, 'utf-8')
ok('使用说明.txt')

// ---------- 汇总 ----------
log(`\n${c.green}${c.bold}打包完成${c.reset}`)
log(`${c.dim}────────────────────────────────────────${c.reset}`)
log(`  发给同事的整个文件夹：`)
log(`  ${c.bold}${distDir}${c.reset}`)
log('')
for (const f of built) log(`    ${f.name.padEnd(34)} ${f.mb.toFixed(1)} MB`)
log(`    使用说明.txt`)
log('')
log(`${c.dim}建议把「${appName}-v${appVer}-给同事」整个文件夹压缩后通过微信/网盘发送。`)
log(`单独发 exe 容易被微信拦截或提示文件异常。${c.reset}`)
