# 更新日志 (Changelog)

## v0.2.0 (2026-04-03)

### 🎉 重大改进

#### 安全修复 (P0)
- ✅ GameEngine 竞态条件修复 (Mutex)
- ✅ 金额校验加强 (MAX_AMOUNT, 最小加注)
- ✅ 数据库 balance 非负约束
- ✅ Docker 配置安全化 (.env.example)
- ✅ 登录限流分布式支持 (Redis)

#### 架构改进
- ✅ Socket.io 多实例广播 (Redis)
- ✅ 前端 Token 安全 (httpOnly Cookie)
- ✅ API 速率限制分级

#### 反作弊系统
- ✅ 动作速度异常检测
- ✅ 变速挂检测 (反应时间方差)
- ✅ 伙牌检测 (动作模式相似度)
- ✅ 投注模式分析
- ✅ 可验证随机发牌 (Provably Fair)

#### 测试
- ✅ 单元测试 (GameEngine, BettingRound, HandEvaluator)
- ✅ 集成测试 (GameFlow, SidePot)
- ✅ API 集成测试 (auth.test.ts)
- ✅ E2E 测试 (Playwright)

#### 文档
- ✅ docs/DEVELOPMENT.md
- ✅ docs/ARCHITECTURE.md
- ✅ docs/API.md
- ✅ docs/SECURITY.md
- ✅ docs/DEPLOYMENT.md
- ✅ e2e/README.md

---

## v0.1.0 (2026-04-02) - 初始版本

- 基础德州扑克服务器
- Express + Socket.io
- PostgreSQL + Redis
- React 前端
- 基本游戏逻辑
