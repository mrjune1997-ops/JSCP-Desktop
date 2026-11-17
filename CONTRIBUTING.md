# 贡献指南

本项目是个人维护的 Windows 桌面工具，欢迎提 Issue 反馈问题；如需提交代码，请先阅读本文件。

## 分支约定

| 分支 | 用途 |
|---|---|
| `main` | 稳定分支，可发布状态。禁止直接推送功能改动 |
| `feat/<模块>-<简述>` | 新功能，例如 `feat/rates-retry` |
| `fix/<模块>-<简述>` | 缺陷修复，例如 `fix/units-percent-blank` |
| `chore/<简述>` | 构建、依赖、文档类改动 |

流程：从最新 `main` 切出分支 → 完成改动 → 跑通验收 → 提 PR 合回 `main`。

## 提交信息

采用 Conventional Commits，首行不超过 72 字符：

```
<type>(<scope>): <中文简述>

<可选的正文，说明动机与影响>
```

- **type**：`feat` 新功能 / `fix` 缺陷修复 / `docs` 文档 / `style` 样式 / `refactor` 重构 / `perf` 性能 / `build` 构建打包 / `test` 测试 / `chore` 杂项
- **scope**：`sci` 科学计算 / `rates` 汇率 / `trade` 外贸 / `units` 单位 / `clock` 时差 / `ui` 界面 / `core` 内核 / `main` 主进程
- 一次提交只做一件事，不要把无关改动混在一起

## 版本号

版本号维护在两个位置，**必须同步**：`src/shared/version.ts` 的 `APP_VERSION` 与 `package.json` 的 `version`。打包脚本会校验，不一致直接中止。

- 小功能补充 / 修补：第三位 +1 → `v1.0.1`、`v1.0.2` …
- 大板块 / 新模块：第二位 +1，第三位归零 → `v1.1.0`

## 提交前自检

```bash
npm run typecheck        # 类型检查必须零报错
node tests/_bundle.mjs   # 计算内核与业务公式（59 项）
node tests/_rates.mjs    # 汇率折算口径
```

涉及界面的改动，额外确认：

- 暗色 / 亮色两套主题下文字与数字都要清晰可读
- 界面缩放在 75% / 100% / 150% 三档下布局不溢出
- 900×600 最小窗口下底栏不被挤坏

## 代码约定

- **数值计算一律走 decimal.js**，禁止用 JS 原生浮点数做金额、汇率、单位换算
- **不写死颜色**，颜色走 `styles.css` 里的 CSS 变量；数字强调色用 `--num-txt` 系列
- 渲染层不引入新的运行时依赖，保持 `app.asar` 体积（当前约 500 KB）
- 主进程与渲染层共享的类型、常量放 `src/shared/`，不要两边各写一份
- 跨进程调用统一走 `window.cluo`（preload 的 `contextBridge`），不开启 `nodeIntegration`

## 数据来源

汇率抓取 [中国银行外汇牌价](https://www.boc.cn/sourcedb/whpj/)，统一按「现汇买入价」结算，每 100 外币报价需 ÷ 100。抓取失败时保留上次缓存，不得清空用户看到的牌价。

## 报告问题

请附上：JSCP 版本号、Windows 版本、复现步骤、期望结果与实际结果。界面问题尽量带截图。
