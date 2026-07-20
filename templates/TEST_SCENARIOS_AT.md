# TEST_SCENARIOS_AT — API 测试场景

> **用途**: 架构师每次修改后端 API 后更新，覆盖所有端点的正常/异常/安全路径。
> **执行**: `curl` / `wget` / `autotest run` 脚本

---

## 📋 基本信息

| 字段 | 值 |
|---|---|
| 项目名称 | `{PROJECT_NAME}` |
| API Base URL | `{BASE_URL}` |
| 认证方式 | `Bearer / API Key / Session` |
| 更新日期 | `{YYYY-MM-DD}` |
| 关联 Commit | `{COMMIT_HASH}` |

---

## 1. 端点清单

| # | Method | Path | Auth | 描述 | 请求体 | 期望状态码 | 期望响应 |
|---|---|---|---|---|---|---|---|
| AT-01 | `GET/POST/...` | `/api/...` | ✅/❌ | `{desc}` | `{body}` | `200/201/...` | `{response}` |

---

## 2. 认证测试

| # | 端点 | 场景 | Auth Header | 期望 |
|---|---|---|---|---|
| AT-A01 | `/api/...` | 无 Token | `—` | 401 |
| AT-A02 | `/api/...` | 过期 Token | `Bearer {expired}` | 401 |
| AT-A03 | `/api/...` | 无效签名 | `Bearer {invalid}` | 401 |
| AT-A04 | `/api/...` | 有效 Token | `Bearer {valid}` | 200 |
| AT-A05 | `/api/...` | Refresh Token | `POST /auth/refresh` | 200 + new Token |

---

## 3. 输入验证测试

| # | 端点 | 参数 | 输入 | 期望 |
|---|---|---|---|---|
| AT-V01 | `{endpoint}` | `{param}` | 空字符串 | 400 |
| AT-V02 | `{endpoint}` | `{param}` | SQL 注入 (`' OR '1'='1`) | 400 |
| AT-V03 | `{endpoint}` | `{param}` | XSS (`<script>alert(1)</script>`) | 400 / sanitized |
| AT-V04 | `{endpoint}` | `{param}` | 超长字符串 (10000+ chars) | 400 |
| AT-V05 | `{endpoint}` | `{param}` | 负数 (如果期望正数) | 400 |
| AT-V06 | `{endpoint}` | `{param}` | 特殊字符 (`../../../etc/passwd`) | 400 |

---

## 4. 鉴权/越权测试

| # | 端点 | 场景 | 期望 |
|---|---|---|---|
| AT-Z01 | `GET /api/user/{id}` | 访问他人资源 (IDOR) | 403 |
| AT-Z02 | `POST /api/admin/...` | 普通用户调用管理员接口 | 403 |
| AT-Z03 | `PUT /api/...` | 修改他人数据 | 403 |

---

## 5. 并发/幂等测试

| # | 端点 | 场景 | 期望 |
|---|---|---|---|
| AT-C01 | `POST /api/order` | 相同 payload 重复提交 5 次 | 仅 1 条记录 |
| AT-C02 | `POST /api/transfer` | 并发调用 10 次相同转账 | 仅成功 1 次 |
| AT-C03 | `PUT /api/...` | 并发更新同一资源 | 乐观锁 / 409 |

---

## 6. 限流测试

| # | 端点 | 场景 | 期望 |
|---|---|---|---|
| AT-R01 | `{endpoint}` | 100 req/s 持续 5s | 429 after threshold |

---

## 7. CORS 安全测试

| # | Origin | 方法 | 期望 |
|---|---|---|---|
| AT-CO01 | `https://trusted.example.com` | GET | 200 + CORS headers |
| AT-CO02 | `https://evil.com` | GET | CORS blocked / no ACAO |
| AT-CO03 | `null` | GET | CORS blocked |

---

## 8. 响应安全头

| # | 端点 | 头 | 期望值 |
|---|---|---|---|
| AT-H01 | `{endpoint}` | X-Content-Type-Options | `nosniff` |
| AT-H02 | `{endpoint}` | X-Frame-Options | `DENY` |
| AT-H03 | `{endpoint}` | Strict-Transport-Security | `max-age=...` |
| AT-H04 | `{endpoint}` | Content-Security-Policy | 存在 |

> 每次修改后端代码后更新此文件，并执行 `autotest run` 运行上述测试。
