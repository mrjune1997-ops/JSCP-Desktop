/**
 * 修复 electron-builder 的 winCodeSign 缓存。
 *
 * 背景：electron-builder 首次打包会下载 winCodeSign-2.6.0.7z，解压时其中包含
 * macOS 的 .dylib 符号链接。Windows 无符号链接特权（或未开开发者模式）时
 * 报 "Cannot create symbolic link : 客户端没有所需的特权"，导致打包中断。
 *
 * 做法：用 7za 解压后删掉 darwin 目录（Windows 打包用不到），重新封成 7z
 * 放回缓存目录，之后再跑 electron-builder 就会直接命中缓存。
 *
 * 用法：npm run fix:cache
 */
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync, mkdirSync, readdirSync, renameSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir, homedir } from 'node:os'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sevenZip = join(root, 'node_modules/7zip-bin/win/x64/7za.exe')

if (!existsSync(sevenZip)) {
  console.error('找不到 7za.exe，请先执行 npm install')
  process.exit(1)
}

const cacheBase = join(homedir(), 'AppData/Local/electron-builder/Cache/winCodeSign')
const ver = '2.6.0'
const cacheDir = join(cacheBase, `winCodeSign-${ver}`)
const work = join(tmpdir(), `wcs-fix-${Date.now()}`)

// 已经修好（没有 darwin 且目录非空）就直接退出
if (existsSync(join(cacheDir, 'windows-10')) && !existsSync(join(cacheDir, 'darwin'))) {
  console.log(`✓ 缓存已就绪：${cacheDir}`)
  process.exit(0)
}

console.log(`缓存目录：${cacheDir}`)
mkdirSync(work, { recursive: true })

// 1. 清空可能残缺的缓存目录（保留 .7z 源包用于重新解压）
const src7z = join(cacheBase, `winCodeSign-${ver}.7z`)
if (!existsSync(src7z)) {
  console.error(`✗ 找不到源包 ${src7z}\n  请先执行一次 npx electron-builder --win（失败也可以），让它把 7z 下载下来。`)
  process.exit(1)
}

// 2. 解压到临时目录，不跟随符号链接
console.log('解压中…')
try {
  execFileSync(sevenZip, ['x', '-bd', '-y', `-o${work}`, src7z], { stdio: 'pipe' })
} catch {
  // 符号链接报错时会留下部分文件，只要 darwin 之外的内容齐了就能继续
  console.log('  解压有警告（符号链接），继续检查文件完整性')
}

// 3. 剔除 darwin 目录
const darwinDirs = ['darwin']
for (const d of readdirSync(work)) {
  if (darwinDirs.includes(d)) {
    rmSync(join(work, d), { recursive: true, force: true })
    console.log(`  已移除 ${d}/（Windows 打包用不到）`)
  }
}

// 4. 重新封回缓存目录
const repacked = join(work, `winCodeSign-${ver}.7z`)
console.log('重新封装…')
execFileSync(sevenZip, ['a', '-bd', '-y', '-mx=5', repacked, '*'], { cwd: work, stdio: 'pipe' })

rmSync(cacheDir, { recursive: true, force: true })
mkdirSync(cacheDir, { recursive: true })

console.log('释放回缓存…')
execFileSync(sevenZip, ['x', '-bd', '-y', `-o${cacheDir}`, repacked], { stdio: 'pipe' })

rmSync(work, { recursive: true, force: true })
console.log(`✓ 修复完成：${cacheDir}`)
console.log('  现在可以重新执行 npm run pack')
