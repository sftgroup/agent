# TEST_SCENARIOS_FT — 前端测试场景

> **用途**: 架构师每次修改前端代码后更新，覆盖 UI/E2E 关键路径。
> **执行**: 浏览器自动化 / `autotest run`

---

## 📋 基本信息

| 字段 | 值 |
|---|---|
| 项目名称 | `{PROJECT_NAME}` |
| 前端 URL | `{FRONTEND_URL}` |
| 框架 | `React / Vue / Next.js / ...` |
| 更新日期 | `{YYYY-MM-DD}` |
| 关联 Commit | `{COMMIT_HASH}` |

---

## 1. 页面渲染测试 (SMOKE)

| # | 页面 | 路径 | 期望 |
|---|---|---|---|
| FT-S01 | `{page}` | `{route}` | 正常渲染，无白屏 |
| FT-S02 | `{page}` | `{route}` | Loading 状态显示 |
| FT-S03 | `{page}` | `{route}` | Empty 状态显示 (无数据) |
| FT-S04 | `{page}` | `{route}` | Error 状态显示 (网络错误) |
| FT-S05 | 404 | `/random-invalid-path` | 404 页面渲染 |

---

## 2. 用户交互流程

| # | 流程 | 操作序列 | 验证点 |
|---|---|---|---|
| FT-U01 | 登录 | Enter credentials → Click 登录 | Redirect to /dashboard, token stored |
| FT-U02 | 注册 | Fill form → Submit | Success message, redirect to login |
| FT-U03 | 表单提交 | Fill all fields → Submit | Success toast, data refreshed |
| FT-U04 | 表单校验 | Leave required empty → Submit | Inline error messages |
| FT-U05 | 登出 | Click 退出 | Token cleared, redirect to /login |

---

## 3. 路由测试

| # | 路由 | 条件 | 期望 |
|---|---|---|---|
| FT-R01 | `/dashboard` | 已登录 | 正常渲染 |
| FT-R02 | `/dashboard` | 未登录 | Redirect to /login |
| FT-R03 | `/admin` | 普通用户 | Redirect to /403 或 /dashboard |

---

## 4. API 集成测试

| # | 前端操作 | API 调用 | 成功 UI | 失败 UI |
|---|---|---|---|---|
| FT-API01 | 点击加载列表 | `GET /api/...` | 列表渲染 | Error + Retry 按钮 |
| FT-API02 | 提交表单 | `POST /api/...` | Toast "成功" | Toast "失败" + 错误信息 |
| FT-API03 | 401 响应 | 任何需要认证的 API | Redirect /login | — |
| FT-API04 | 网络超时 | 模拟 timeout | "请求超时" 提示 | — |

---

## 5. 响应式布局 (如有)

| # | 页面 | 视口 | 期望 |
|---|---|---|---|
| FT-L01 | `{page}` | Desktop (1920x1080) | 完整布局 |
| FT-L02 | `{page}` | Tablet (768x1024) | 适配布局 |
| FT-L03 | `{page}` | Mobile (375x667) | 移动端布局，汉堡菜单 |

---

## 6. 可访问性 (A11y)

| # | 页面 | 检查项 | 期望 |
|---|---|---|---|
| FT-AY01 | `{page}` | Tab 键焦序 | 逻辑顺序 |
| FT-AY02 | `{page}` | 图片 alt 属性 | 存在 |
| FT-AY03 | `{page}` | 表单 label 关联 | for/id 匹配 |
| FT-AY04 | `{page}` | 颜色对比度 | ≥4.5:1 |

---

## 7. 浏览器兼容性 (如适用)

| # | 浏览器 | 版本 | 页面 | 期望 |
|---|---|---|---|---|
| FT-BR01 | Chrome | latest | `{page}` | ✅ |
| FT-BR02 | Firefox | latest | `{page}` | ✅ |
| FT-BR03 | Safari | latest | `{page}` | ✅ |

---

## 8. XSS 防护 (前端)

| # | 操作 | 输入 | 期望 |
|---|---|---|---|
| FT-X01 | 表单输入 | `<script>alert(1)</script>` | 不执行脚本，渲染为文本 |
| FT-X02 | URL 参数 | `?q=<img src=x onerror=alert(1)>` | 不执行 |
| FT-X03 | 富文本渲染 | `javascript:alert(1)` in link | 过滤/移除非安全协议 |

---

## 9. 性能基准 (可选)

| # | 页面 | 指标 | 阈值 | 实际 |
|---|---|---|---|---|
| FT-P01 | `{page}` | FCP | <1.5s | `{actual}` |
| FT-P02 | `{page}` | LCP | <2.5s | `{actual}` |
| FT-P03 | `{page}` | TTI | <5s | `{actual}` |

> 更新后执行: `autotest run` 或手动浏览器测试，结果写入 test-reports/E2E_TEST_REPORT.md
