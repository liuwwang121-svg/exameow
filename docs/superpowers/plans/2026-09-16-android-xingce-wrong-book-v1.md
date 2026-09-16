# 安卓行测错题本 V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Exameow 中交付安卓优先、本地优先、可批量导入 DOCX 并按到期时间复习的行测错题本，以及无需私钥的可安装 debug APK。

**Architecture:** 新功能位于 `frontend/src/features/wrong-book/`，业务层只依赖 `WrongBookRepository`；V1 由 IndexedDB 实现记录、图片和设置存储。Pinia store 负责页面状态与题库错题桥接，DOCX、调度、备份和 AI 分析均为独立纯模块，便于测试和未来替换云端适配器。

**Tech Stack:** Vue 3、Pinia、TypeScript、IndexedDB、Mammoth、Vitest、fake-indexeddb、Tauri v2、GitHub Actions。

**Spec:** `docs/superpowers/specs/2026-09-16-android-xingce-wrong-book-v1.md`

## Global Constraints

- 安卓手机第一优先级，页面最低宽度 320px 可用。
- V1 不做申论、云同步、多用户、复杂统计或批量 AI。
- 图片 Blob 不得写入 localStorage。
- DOCX 默认零 AI 调用，标题规则决定边界，原图片必须保留。
- 不破坏现有题库、会话和 `exameow-wrong-questions` 数据。
- 新持久化数据必须带稳定 UUID 和 `schemaVersion: 1`。

---

### Task 1: 测试基础、模型和复习调度

**Files:**
- Modify: `frontend/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `frontend/src/features/wrong-book/model.ts`
- Create: `frontend/src/features/wrong-book/scheduler.ts`
- Test: `frontend/src/features/wrong-book/scheduler.test.ts`

**Interfaces:**
- Produces: `WrongBookEntry`、`ReviewState`、`ReviewRating`、`createInitialReviewState(now)`、`scheduleReview(state, rating, now)`。

- [x] **Step 1: 添加 Vitest 与 fake-indexeddb，并建立 `test` 脚本**
- [x] **Step 2: 先写失败测试**：固定时间下验证新题四档到期时间、重来增加 lapses、难度边界、复习间隔增长。
- [x] **Step 3: 运行 `pnpm --dir frontend test -- scheduler.test.ts`，确认因模块不存在而失败**
- [x] **Step 4: 实现最小模型和调度函数，使测试通过**
- [x] **Step 5: 重跑该测试并提交 `feat: add wrong-book review model`**

### Task 2: IndexedDB Repository 与题库错题幂等写入

**Files:**
- Create: `frontend/src/features/wrong-book/repository.ts`
- Create: `frontend/src/features/wrong-book/indexedDbRepository.ts`
- Create: `frontend/src/features/wrong-book/entryFactory.ts`
- Test: `frontend/src/features/wrong-book/indexedDbRepository.test.ts`
- Test: `frontend/src/features/wrong-book/entryFactory.test.ts`

**Interfaces:**
- Consumes: `WrongBookEntry`、`WrongBookAsset`、`createInitialReviewState`。
- Produces: `WrongBookRepository.listEntries/getEntry/findBySourceKey/putEntry/deleteEntry/putAsset/getAsset/listAssets/getSetting/setSetting`、`createOrUpdatePracticeWrong(input, existing, now)`。

- [x] **Step 1: 写失败测试**：Blob 往返、列表排序、sourceKey 查询、级联删除资源、同一题二次答错保留 UUID 且 `wrongCount + 1`。
- [x] **Step 2: 运行测试，确认因接口与实现缺失而失败**
- [x] **Step 3: 实现接口、IndexedDB 事务封装与纯 entry factory**
- [x] **Step 4: 重跑两组测试并提交 `feat: persist wrong-book entries in indexeddb`**

### Task 3: DOCX 规则导入与预览

**Files:**
- Create: `frontend/src/features/wrong-book/docxImporter.ts`
- Test: `frontend/src/features/wrong-book/docxImporter.test.ts`

**Interfaces:**
- Produces: `parseWrongBookTitle(text)`、`parseWrongBookHtml(html, extractedImages, now)`、`importWrongBookDocx(arrayBuffer, now)`，返回 `DocxImportPreview { entries, assets, ignoredCount, warnings }`。

- [x] **Step 1: 写失败测试**：全角/半角竖线、模块映射、两题切分、文字图片顺序、“返回目录”忽略、无合法标题警告。
- [x] **Step 2: 运行测试并确认预期失败**
- [x] **Step 3: 使用 Mammoth `convertToHtml` 和图片回调实现解析；图片先保存在预览 Map，确认导入后才写 Repository**
- [x] **Step 4: 重跑测试并提交 `feat: import structured wrong questions from docx`**

### Task 4: 备份恢复和单题 AI 分析

**Files:**
- Create: `frontend/src/features/wrong-book/backup.ts`
- Create: `frontend/src/features/wrong-book/aiAnalysis.ts`
- Test: `frontend/src/features/wrong-book/backup.test.ts`
- Test: `frontend/src/features/wrong-book/aiAnalysis.test.ts`

**Interfaces:**
- Produces: `createWrongBookBackup(repository)`、`restoreWrongBookBackup(repository, json)`、`analyzeWrongEntry(entry, config, signal)`。

- [x] **Step 1: 写失败测试**：备份含 schema/记录/图片、恢复后 Blob 字节一致、拒绝未知 schema、AI 类别仅接受白名单且异常输出回退为自定义。
- [x] **Step 2: 运行测试并确认预期失败**
- [x] **Step 3: 实现 base64 转换、先校验后恢复，以及调用现有 OpenAI-compatible API 的单题分析适配**
- [x] **Step 4: 重跑测试并提交 `feat: back up and analyze wrong-book entries`**

### Task 5: Pinia store 与现有刷题桥接

**Files:**
- Create: `frontend/src/stores/wrongBook.ts`
- Modify: `frontend/src/views/PracticeView.vue`
- Modify: `frontend/src/App.vue`
- Test: `frontend/src/stores/wrongBook.test.ts`

**Interfaces:**
- Consumes: Repository、DOCX importer、scheduler、backup、AI analysis。
- Produces: `useWrongBookStore` 的 `initialize/recordPracticeWrong/addManual/previewDocx/confirmDocxImport/rateEntry/removeEntry/exportBackup/restoreBackup/runAiAnalysis`。

- [x] **Step 1: 写失败测试**：初始化到期数、答错桥接、DOCX 确认前不写库、复习反馈更新、每日提醒标记。
- [x] **Step 2: 运行测试并确认预期失败**
- [x] **Step 3: 实现 store；在 `PracticeView` 两个错误分支中 fire-and-forget 写入新错题本，保留旧 store 行为**
- [x] **Step 4: App 启动时初始化新 store；重跑测试并提交 `feat: connect practice mistakes to wrong book`**

### Task 6: 手机端错题本页面

**Files:**
- Create: `frontend/src/views/WrongBookView.vue`
- Create: `frontend/src/components/wrong-book/WrongEntryCard.vue`
- Create: `frontend/src/components/wrong-book/ManualEntryDialog.vue`
- Create: `frontend/src/components/wrong-book/DocxImportDialog.vue`
- Create: `frontend/src/components/wrong-book/ReviewPanel.vue`
- Create: `frontend/src/components/wrong-book/BackupRestorePanel.vue`
- Create: `frontend/src/components/wrong-book/AssetImage.vue`
- Modify: `frontend/src/router/index.ts`
- Modify: `frontend/src/components/layout/AppShell.vue`

**Interfaces:**
- Consumes: `useWrongBookStore`。
- Produces: `/wrong-book` 路由、手机底部“错题本”入口、到期角标、今日/全部筛选、拍照录入、DOCX 预览、复习、AI、备份恢复操作。

- [ ] **Step 1: 先建立页面交互验收清单，确保每个按钮都有可观察结果**
- [ ] **Step 2: 实现移动端页面和对话框；相机 input 使用 `accept="image/*" capture="environment"`，所有 URL 在卸载时 revoke**
- [ ] **Step 3: 用 320px 与 390px 视口做浏览器冒烟检查，修正溢出和不可点击区域**
- [ ] **Step 4: 运行类型检查与构建并提交 `feat: add mobile wrong-book experience`**

### Task 7: 每日到期提醒与 Android debug APK 流水线

**Files:**
- Create: `frontend/src/features/wrong-book/reminder.ts`
- Test: `frontend/src/features/wrong-book/reminder.test.ts`
- Create: `.github/workflows/android-debug-apk.yml`
- Modify: `README_zh.md`

**Interfaces:**
- Produces: `shouldShowDailyReminder(dueCount, lastShownDate, today)`；Actions artifact 名称 `exameow-android-debug-apk`。

- [ ] **Step 1: 写失败测试**：无到期不提醒、同日只提醒一次、次日仍有到期再次提醒。
- [ ] **Step 2: 实现提醒判定并接入 App 启动后的应用内提示**
- [ ] **Step 3: 工作流使用 Node 22、pnpm、Rust Android target、Java 17、NDK 27，执行 `pnpm tauri android init` 与 `pnpm tauri android build --apk --target aarch64 --debug`，上传找到的 APK**
- [ ] **Step 4: 运行完整前端测试、类型检查、生产构建，检查 workflow YAML 并提交 `ci: build installable android debug apk`**

### Task 8: 需求核对、代码审查和 APK 交付

**Files:**
- Review: all changed files

**Interfaces:**
- Consumes: 规格、完整 git diff、测试与 GitHub Actions 输出。
- Produces: 可安装 APK artifact 与交付说明。

- [ ] **Step 1: 逐条对照规格验收，记录任何未完成项**
- [ ] **Step 2: 进行独立代码审查，修复 Critical/Important 问题**
- [ ] **Step 3: fresh run `pnpm --dir frontend test && pnpm --dir frontend run type-check && pnpm --dir frontend run build-only`**
- [ ] **Step 4: 推送功能分支并触发 `android-debug-apk.yml` workflow_dispatch**
- [ ] **Step 5: 检查 Actions 日志、下载 artifact、确认 APK 文件存在且非空后交付**
