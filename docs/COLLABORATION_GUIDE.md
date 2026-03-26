# 多人协作指南

> 本项目支持多模型/多人协作开发，请遵循以下规范以确保代码一致性。

---

## 👥 团队角色定义

| 角色 | 标识 | 职责 | 当前分配 |
|------|------|------|----------|
| **架构师** | `ARCH` | 系统设计、技术选型、代码审查 | kimi-coding/k2p5 |
| **后端开发** | `BE` | API开发、数据库设计、游戏逻辑 | 待分配 |
| **前端开发** | `FE` | UI实现、状态管理、样式 | 待分配 |
| **DevOps** | `OPS` | 部署配置、监控、CI/CD | 待分配 |
| **测试工程师** | `QA` | 测试用例、自动化测试、Bug跟踪 | 待分配 |

---

## 🔄 协作工作流程

### 1. 任务分配流程

```
1. 架构师 (ARCH) 创建任务单
   ↓
2. 在 DEVELOPMENT_REPORT.md 中更新任务状态
   ↓
3. 分配给具体开发者 (BE/FE/OPS/QA)
   ↓
4. 开发者完成任务并提交
   ↓
5. 架构师审查并合并
   ↓
6. 更新开发报告
```

### 2. 代码提交规范

#### 提交信息格式
```
[角色] <类型>(<模块>): <描述>

[详细说明]

相关任务: #<任务ID>
```

#### 示例
```
[BE] feat(auth): 实现JWT登录功能

- 添加 /api/auth/login 接口
- 实现密码bcrypt加密
- 生成accessToken和refreshToken

相关任务: #AUTH-001
```

#### 角色标识
- `[ARCH]` - 架构师
- `[BE]` - 后端开发
- `[FE]` - 前端开发
- `[OPS]` - DevOps
- `[QA]` - 测试

### 3. 文件修改标记

在修改文件前，添加注释标记:

```typescript
/**
 * @author ARCH
 * @date 2026-03-26
 * @task CORE-001
 * @description 初始化项目结构
 * @status completed
 */
```

### 4. 代码审查清单

审查者需要检查:

- [ ] 代码符合 TypeScript 严格模式
- [ ] 新增功能有对应的类型定义
- [ ] 错误处理完善
- [ ] 日志记录恰当
- [ ] 单元测试覆盖 (核心逻辑)
- [ ] 文档已更新

---

## 📋 任务跟踪

### 当前任务看板

| 任务ID | 描述 | 负责人 | 状态 | 优先级 |
|--------|------|--------|------|--------|
| CORE-001 | 项目初始化 & 架构设计 | ARCH | ✅ 完成 | P0 |
| CORE-002 | 共享类型包 (@poker/shared) | ARCH | ✅ 完成 | P0 |
| CORE-003 | Docker开发环境配置 | ARCH | ✅ 完成 | P0 |
| BE-001 | 扑克引擎 (poker-engine) | BE | 🟡 待开始 | P0 |
| BE-002 | Prisma数据库模型 | BE | 🔴 待分配 | P0 |
| BE-003 | 后端API框架搭建 | BE | 🔴 待分配 | P0 |
| FE-001 | React前端项目初始化 | FE | 🔴 待分配 | P1 |
| FE-002 | 登录/注册页面 | FE | 🔴 待分配 | P1 |

### 任务状态说明

- 🔴 **待分配**: 等待分配给开发者
- 🟡 **进行中**: 开发者正在处理
- 🔵 **待审查**: 等待代码审查
- ✅ **已完成**: 已合并到主分支
- ⚪ **已取消**: 任务取消

---

## 💬 沟通规范

### 1. 日常同步

每天结束时在开发报告中更新:
- 今日完成工作
- 遇到的问题/阻塞
- 明日计划

### 2. 问题上报

遇到阻塞问题时:
```
问题: <简短描述>
影响: <影响范围>
尝试: <已尝试的解决方案>
需要: <需要什么帮助>
```

### 3. 技术决策

重要技术决策需要记录到 `docs/adr/` 目录:
```
docs/adr/
├── 001-use-turborepo.md
├── 002-postgresql-database.md
└── 003-socketio-websocket.md
```

---

## 🔐 代码规范

### TypeScript 配置

必须启用严格模式:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

### 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 文件 | kebab-case | `game-state.ts` |
| 类 | PascalCase | `GameStateManager` |
| 接口 | PascalCase + I前缀 | `IGameState` |
| 类型 | PascalCase | `GameStatus` |
| 枚举 | PascalCase + 大写下划线 | `GameStatus.WAITING` |
| 函数 | camelCase | `getPlayerById` |
| 常量 | UPPER_SNAKE_CASE | `MAX_PLAYERS` |
| 变量 | camelCase | `currentPlayer` |

### 注释规范

```typescript
/**
 * 计算玩家的最佳牌型
 * @param holeCards - 玩家的两张底牌
 * @param communityCards - 五张公共牌
 * @returns 最佳牌型信息
 * @throws 如果牌数不正确会抛出错误
 */
function calculateBestHand(
  holeCards: Card[],
  communityCards: Card[]
): HandInfo {
  // 实现...
}
```

---

## 📁 项目文件归属

| 目录 | 负责角色 | 说明 |
|------|----------|------|
| `apps/server/` | BE | 后端服务代码 |
| `apps/web/` | FE | 前端应用代码 |
| `packages/shared/` | ARCH | 共享类型定义 |
| `packages/poker-engine/` | BE | 扑克游戏引擎 |
| `infra/docker/` | OPS | Docker配置 |
| `infra/k8s/` | OPS | Kubernetes配置 |
| `docs/` | ALL | 项目文档 |
| `scripts/` | OPS | 开发脚本 |

---

## 🚀 快速开始 (协作模式)

### 新成员加入流程

1. 阅读本协作指南
2. 查看开发报告了解当前进度
3. 认领待分配任务
4. 创建功能分支 (`feature/任务ID-简短描述`)
5. 开发并提交代码
6. 创建 PR 请求审查
7. 审查通过后合并

### 示例工作流

```bash
# 1. 获取最新代码
git pull origin develop

# 2. 创建功能分支
git checkout -b feature/BE-001-poker-engine

# 3. 开发代码...

# 4. 提交 (遵循提交规范)
git commit -m "[BE] feat(poker-engine): 实现牌组洗牌逻辑

- 使用Fisher-Yates算法
- 添加单元测试

相关任务: #BE-001"

# 5. 推送分支
git push origin feature/BE-001-poker-engine

# 6. 创建 PR 并请求审查
```

---

## 📞 紧急联系

遇到紧急问题:
1. 在开发报告中标记为 🆘 紧急
2. 联系架构师协调资源
3. 如需要，可召开临时同步会议

---

**最后更新**: 2026-03-26  
**版本**: v1.0
