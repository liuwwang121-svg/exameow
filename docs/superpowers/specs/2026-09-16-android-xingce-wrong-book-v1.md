# 安卓行测错题本 V1 设计规格

## 目标

在 Exameow 现有 Vue 3 + Tauri Android 应用内增加一个本地优先的行测错题闭环：题库做错自动入库、拍照/相册手动录入、按固定标题规则批量导入 DOCX、今日到期复习、四档反馈、单题 AI 解析、完整备份恢复，并产出可安装的 Android 调试 APK。

## V1 范围

### 必做

- 保留现有刷题、题库、AI 配置、OCR 与 Android 能力。
- 题库内答错后，按 `bankId + questionId` 幂等写入统一行测错题库；再次答错累计错误次数并立即到期。
- 手动录入支持相机/相册图片，原图作为 Blob 存入 IndexedDB，不塞入 localStorage。
- DOCX 历史错题按 `编号｜日期｜模块/题号｜错因标题` 切分；保留正文与内嵌图片的先后顺序；“返回目录”忽略。
- DOCX 导入先预览再确认；不符合标题规则的内容进入异常提示，不静默丢失。
- 历史导入默认完全不调用 AI。
- AI 只在用户点击单道题的“AI 解析”时调用现有 OpenAI-compatible 配置；结果保存到该错题，错因类别仍可人工修改。
- 错因类别：知识不会/遗忘、方法错误、审题关键词漏读、主体/指标/口径错误、计算错误、选项理解错误、时间/跳题策略、执行粗心、自定义。
- 复习状态使用可迁移到 FSRS 的字段：`due`、`stability`、`difficulty`、`elapsedDays`、`scheduledDays`、`reps`、`lapses`、`state`、`lastReview`；反馈为重来/困难/一般/简单。
- 今日复习只列 `due <= now` 的题。完成反馈后更新复习状态和下次到期时间。
- 备份文件包含 `schema_version`、稳定 UUID、所有错题、复习状态及 base64 图片资产；恢复时先校验再写入。
- 数据访问通过 `WrongBookRepository` 接口，V1 实现为 `IndexedDbWrongBookRepository`，以后云同步通过新增适配器完成，不改变页面和业务层的数据结构。
- 有到期错题时，App 当天首次打开显示本地提醒/应用内提示，并在错题本导航入口显示数量。
- 提供无需私有签名 secrets、可手动触发的 Android arm64 debug APK GitHub Actions 工作流。

### 不做

- 申论错题及申论专用字段。
- 云同步、多用户、账号系统。
- 复杂统计大屏。
- 批量 AI 分析。
- App 完全退出后的后台定时推送；V1 仅在 App 启动/回到前台时执行每日到期提醒。

## 数据模型

`WrongBookEntry` 是持久化主记录：

- `id`: `crypto.randomUUID()` 生成的稳定 UUID。
- `schemaVersion`: 当前为 `1`。
- `source`: `practice | manual | docx`。
- `sourceKey`: 题库错题使用 `practice:${bankId}:${questionId}`，用于幂等 upsert；手动和 DOCX 导入为空。
- `title`、`recordedAt`、`examDate`、`subject`、`section`、`originalQuestionNo`。
- `stem`、`options`、`answer`、`analysis`、`userAnswer`、`notes`、`aiAnalysis`。
- `cause` 与可选 `customCause`。
- `blocks`: 按原顺序保存 `{ kind: 'text', text }` 或 `{ kind: 'image', assetId, alt? }`。
- `assetIds`: 便于备份和删除时清理资源。
- `wrongCount`、`needsConfirmation`、`createdAt`、`updatedAt`。
- `review`: FSRS-compatible 状态。

图片资产为 `WrongBookAsset`：`id`、`entryId`、`mimeType`、`blob`、`createdAt`。IndexedDB 数据库 `exameow-wrong-book` 含 `entries`、`assets`、`settings` 三个 object store。

## DOCX 规则

标题正则接受全角或半角竖线：

```text
^\s*(\d+)\s*[｜|]\s*(\d{4}-\d{2}-\d{2})\s*[｜|]\s*([^｜|]+?)\s*[｜|]\s*(.+?)\s*$
```

遇到匹配标题时开始新错题；直到下一标题前的段落、表格文字和图片均归当前题。标题前的目录、空白和“返回目录”记入忽略统计。通过 Mammoth 转 HTML，并用图片转换回调获取原始 Blob；HTML 只作为瞬时解析载体，不长期保存 base64 图片。

模块映射优先覆盖用户现有格式：片段/逻填归“言语理解”，图推/类比/定义/逻辑/科学归“判断推理”，资料归“资料分析”，数量归“数量关系”，政治归“政治理论”，常识归“常识判断”。无法识别时保留原模块文本并标记待确认。

## 复习算法

V1 不声称实现完整 FSRS 参数训练，而是采用确定性的四档调度，同时保存 FSRS-compatible 字段：

- 新题：重来 10 分钟、困难 1 天、一般 3 天、简单 7 天。
- 已复习题：分别按当前稳定度的 `0.2 / 1.2 / 2.0 / 3.5` 倍增长，至少 `10 分钟 / 1 天 / 1 天 / 2 天`。
- 重来增加 `lapses` 并进入 `relearning`；其他反馈进入 `review`。
- `difficulty` 限制在 1～10，重来/困难上调，一般/简单下调。

该结构保证以后替换为标准 FSRS 库时不需要重新录题或重新建立复习历史。

## 用户流程

1. 底部导航进入“错题本”，默认看到今日到期数量。
2. 可切换“今日复习/全部错题”，按模块和关键词筛选。
3. “拍照录题”选择相机或相册，填写标题、模块、答案、错因后保存；OCR 可用于辅助填写，但原图始终保留。
4. “导入 Word”选择 `.docx`，显示识别条数、忽略内容、待确认条目和前几条预览；确认后批量写入。
5. 复习时先看题目/原图，再展开答案；选择重来/困难/一般/简单，进入下一题。
6. 点击“AI 解析”才消耗 API；未配置 AI 时引导到现有配置页。
7. “备份”导出一个 JSON；“恢复”先预检版本与数量，再导入。

## 兼容与迁移

- 不更改现有 `exameow-banks`、`exameow-practice-session`、`exameow-wrong-questions` 数据格式。
- 新错题本独立使用 IndexedDB；现有错题练习功能继续可用。
- 题库答错时同时写入原错题记录和新错题本，确保现有体验不回退。
- 所有新增 UI 以手机窄屏优先，桌面宽屏仍可使用。

## 验收标准

- 单元测试覆盖标题切分、图片顺序、异常文档、四档调度、题库错题幂等 upsert、备份/恢复校验与图片往返。
- `pnpm --dir frontend test`、`pnpm --dir frontend run type-check`、`pnpm --dir frontend run build-only` 全部通过。
- GitHub Actions 能生成 Android arm64 debug APK artifact；下载后可在允许未知来源的安卓手机上安装。
