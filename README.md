# 观影志 · Media Tracker

管理**电影、电视剧、动漫**的观看状态与**每一季**的独立进度。

- 电视剧 / 动漫：每一季都有独立的状态、已看集数、评分和重看次数
- 电影：用观看次数记录，支持重看
- 作品的整体状态由你**手动**维护，不会被某一季的状态变化带着变
- 数据源：TMDB（电影 / 剧集）+ AniList（番剧）+ 手动录入
- 多用户账号、邮箱密码登录（Auth.js）
- 统计面板、标签、CSV / JSON 导入导出、从 AniList 一键导入

---

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Next.js 16（App Router、Turbopack、React 19.2） |
| 数据库 | Neon Serverless Postgres（Vercel Marketplace 集成） |
| ORM | Prisma 7（`prisma-client` 生成器 + `@prisma/adapter-neon` 驱动适配器） |
| 认证 | Auth.js v5（`next-auth@beta`）+ Credentials + Prisma Adapter，bcrypt |
| UI | Tailwind CSS v4 + shadcn/ui（Radix）+ lucide-react + next-themes |
| 图表 | Recharts |
| 校验 | Zod 4 |

---

## 快速开始

```bash
npm install
cp .env.example .env    # 填入下方所需的环境变量
npm run db:push         # 建表
npm run db:generate     # 生成 Prisma Client
npm run dev
```

打开 http://localhost:3000 ，先注册一个账号。

### 需要的环境变量

| 变量 | 是否必需 | 说明 |
|---|---|---|
| `DATABASE_URL` | 必需 | Neon 的**池化**连接串，运行时使用 |
| `DIRECT_URL` | 必需 | Neon 的**直连**连接串，Prisma CLI（迁移）使用 |
| `AUTH_SECRET` | 必需 | `openssl rand -base64 32` 或 `npx auth secret` |
| `TMDB_API_READ_TOKEN` | 可选 | TMDB 后台的 **API Read Access Token**（`eyJ...` 开头）。没有它就只能搜番剧和手动录入 |
| `NEXT_PUBLIC_APP_URL` | 建议 | 部署后的站点地址 |

**AniList 无需密钥。**

### TMDB 凭证申请

1. 登录 <https://www.themoviedb.org/>
2. 进入 <https://www.themoviedb.org/settings/api>，按提示填写应用信息（类型选 Website，**必须填写真实的应用 URL**）
3. 提交后在 API 设置页复制 **API Read Access Token**
4. 填入 `.env` 的 `TMDB_API_READ_TOKEN`

> TMDB 条款要求：应用内必须展示归属声明。本项目已在侧边栏底部固定展示
> 「本产品使用 TMDB API 但未经 TMDB 认可或认证」及 AniList 链接（见 `src/components/tmdb-attribution.tsx`）。

---

## 部署到 Vercel

> ⚠️ **Vercel Postgres 已于 2024 年 12 月停止服务**并全部迁移到 Neon。新项目请使用 Marketplace 里的
> **Neon Postgres** 集成。

1. 把代码推到 GitHub
2. 在 Vercel 导入仓库
3. **Storage → Marketplace → Neon Postgres → Install**，Neon 会自动注入
   `DATABASE_URL`（池化）与 `DATABASE_URL_UNPOOLED`（直连）
4. 把 `DATABASE_URL_UNPOOLED` 复制一份为 `DIRECT_URL`
5. 在 **Settings → Environment Variables** 添加 `AUTH_SECRET`（和可选的 `TMDB_API_READ_TOKEN`）
6. 部署完成后运行一次建表：

   ```bash
   DATABASE_URL="<pooled>" DIRECT_URL="<direct>" npx prisma db push
   ```

   （也可以本地 `.env` 填好后执行 `npm run db:push`。）

---

## 数据模型

```
Media        作品（电影本身 / 整部剧集或番剧），跨用户共享的元数据
 └─ Season   季，仅 TV / ANIME 有；未追踪的季也建行，用于灰态展示
Genre        类型题材（全局）

MediaEntry   用户对「作品」的记录：整体状态（手动）、评分、收藏、标签、备注、观看次数
 └─ SeasonEntry   用户对「某一季」的记录：状态、已看集数、评分、重看次数

Tag          用户自定义标签，挂在作品级
User         Auth.js 用户 + 观看记录
```

**为什么系列状态与季状态分开？** 需求是「每一季独立追踪」，所以季是独立记录（`SeasonEntry`），
作品只是它们的容器。整体状态刻意做成手动字段，这样既能逐季精细控制，又能表达
「第 1 季很喜欢、第 2 季弃了、整部标记为搁置」这类组合。详情页提供
**「按季状态汇总」**按钮，把各季状态折叠成一个整体状态，但不会自动执行。

### 电影为什么没有 Season 行

电影没有「季」的概念，硬塞一个 `Season` 会让 `progress` 变成含义模糊的字段。
电影用 `MediaEntry.watchCount` 记录观看次数，UI 按 `kind` 分支，但卡片、
进度条、状态选择器组件完全复用。

### AniList 的多季合并

TMDB 的 `/tv/{id}` 直接返回 `seasons[]`，映射是一对一。

**AniList 把每一季当作独立作品**，没有系列概念，只能靠 `relations` 拼：

1. 查根作品的 `relations`，沿 `PREQUEL` / `SEQUENT` 关系链收集同系列作品
2. 用 `Page(media(id_in: [...]))` **一次请求**取回全部季的详情
   （限流友好：官方限 30–90 次/分，必须批量化）
3. 按 `(首播年, 首播月, id)` 排序，推导出 `seasonNumber = 1..N`
4. 建一个 `Media(kind=ANIME)` + N 条 `Season`，搜索页会弹窗让用户确认

单季番剧只会得到 1 条 `Season`，`totalSeasons` 保持 `null`。

> **关于中文标题**：AniList 的 `MediaTitle` 目前只提供 `romaji` / `english` / `native` /
> `userPreferred`，**没有独立的中文标题字段**。本项目把 `userPreferred` 当作本地化标题位
> （AniList 会根据访问者的语言偏好返回），拿不到时回退到罗马字标题。若需要稳定的中文番剧名，
> 需要额外接入 [Bangumi](https://bgm.tv/) 之类的中文数据源。

---

## 页面

| 路由 | 说明 |
|---|---|
| `/` | 首页：继续观看（季粒度，`+1 集`）、在看的电影、最近看完、年度统计摘要 |
| `/library` | 片库。默认按作品聚合，可切「按季」视图直接筛选和更新每一季 |
| `/media/[id]` | 详情：整体状态（手动）、评分、标签、备注、**季列表**、每季独立状态 / 进度 / 评分 |
| `/search` | 聚合搜索（TMDB + AniList 分 Tab）、多季识别确认弹窗、手动录入表单 |
| `/stats` | 每年看完数量、题材分布、评分分布、状态分布、累计时长、Top 10 |
| `/tags` | 标签增删改，按标签跳转片库 |
| `/settings` | 昵称、改密码、主题、数据源状态 |
| `/settings/import-export` | JSON / CSV 导出、导入（先预览）、从 AniList 导入 |

---

## 导入导出

- **JSON**：完整嵌套结构，字段无损，适合备份
- **CSV**：每行 = 一个 `(作品, 季)` 组合，电影只有一行且季相关列为空，适合在表格软件里查看
  - 表头见 `src/lib/csv.ts` 的 `CSV_HEADERS`
  - 带引号的字段、字段内的逗号与换行都能正确往返
- 导入支持 **合并**（保留现有数据）与 **覆盖**（用文件数据）
- 从 AniList 导入：按用户名拉取番剧列表。注意 AniList 每季是独立条目，
  所以导入后**每季会成为独立作品**，而不是合并成一部多季作品

---

## 常用命令

```bash
npm run dev            # 开发服务器
npm run build          # 生产构建
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm run db:generate    # 重新生成 Prisma Client（改了 schema 之后）
npm run db:push        # 把 schema 推到数据库
npm run db:studio      # Prisma Studio，可视化查看数据
```

---

## 实现说明

- 路由保护用 Next.js 16 的 `proxy.ts`（`middleware.ts` 已更名），运行时固定为 Node.js
- `src/lib/dal.ts` 的 `requireUser()` 是唯一的数据访问鉴权入口；
  每个 Server Action 都会先校验记录归属，绝不信任客户端传来的 id
- 上游 API 结果统一归一化成 `NormalizedMedia`，落库到 `Media` / `Season` 表当缓存，
  配合进程内 TTL 缓存（`src/lib/cache.ts`）避免触发限流
- AniList 遇 429 会按 `Retry-After` / `X-RateLimit-Reset` 退避重试
- 所有外部图片走 `next/image`，域名白名单见 `next.config.ts`

### 状态取值

`PLANNING` 想看 · `WATCHING` 在看 · `COMPLETED` 已看 · `ON_HOLD` 搁置 · `DROPPED` 弃剧

---

## 数据合规

- 本产品使用 [TMDB](https://www.themoviedb.org/) API 但未经 TMDB 认可或认证。
- 番剧元数据来自 [AniList](https://anilist.co/)（AniList API 为非商业用途免费）。
