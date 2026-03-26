# poker-server-modern 代码评审报告

**评审日期**: 2026-03-26  
**评审模型**: Claude Opus 4.6  
**评审轮次**: 2轮

---

## 第一轮评审：核心游戏逻辑

### 模块: GameEngine.ts

#### 问题列表

| 严重程度 | 问题 | 位置 | 建议修复 |
|----------|------|------|----------|
| 🔴 Critical | **竞态条件**：缺乏原子性保护。`processAction` 在验证回合和执行动作之间无锁保护，玩家可通过并发请求在同一回合内多次执行动作（双倍下注） | GameEngine.ts:processAction | 添加互斥锁（每桌一把锁）或使用乐观锁（版本号） |
| 🔴 Critical | **amount参数未校验**：未做负数/NaN/溢出校验。恶意玩家可构造 `amount = -1000` 使筹码增加 | processAction/validateAction | 添加 `sanitizeAmount()` 函数校验金额为正整数且在安全范围内 |
| 🔴 Critical | **playerId信任客户端**：如果playerId来自客户端消息体而非服务端session，可被身份伪造 | processAction入口 | playerId必须从服务端认证上下文获取，绝不使用客户端提供的值 |
| 🟠 High | **isFolded检查顺序错误**：应先检查弃牌状态再检查回合，避免信息泄露 | processAction | 调整检查顺序并统一错误消息 |
| 🟠 High | **缺少All-In状态检查**：All-In玩家不应再有任何操作权 | processAction | 添加 `if (player.isAllIn) throw new Error(...)` |
| 🟠 High | **缺少游戏阶段验证**：SHOWDOWN/WAITING阶段不应接受动作 | processAction | 添加阶段校验 `if (!ACTIONABLE_PHASES.has(this.state.currentPhase))` |
| 🟠 High | **isRoundComplete边界条件**：只剩一个玩家时应直接结束而非继续轮转 | advanceToNextRound | 添加 `if (activePlayers.length <= 1) { this.endHand(); return; }` |
| 🟡 Medium | **缺少操作超时机制**：恶意玩家可无限期不操作阻塞游戏 | 整个模块 | 实现操作倒计时，超时自动弃牌/过牌 |
| 🟡 Medium | **异常处理不完整**：executeAction成功后advanceToNextRound抛异常会导致状态不一致 | processAction | 使用状态快照回滚机制 |
| 🟡 Medium | **错误消息暴露内部信息**：不同错误消息泄露游戏状态 | 整个模块 | 使用统一错误码，不暴露内部细节 |

#### 优点
- 代码结构清晰，职责分离良好
- 使用TypeScript强类型减少错误
- 游戏流程基本符合德州扑克规则

#### 总体评分: 6/10

---

### 模块: HandEvaluator.ts

#### 问题列表

| 严重程度 | 问题 | 位置 | 建议修复 |
|----------|------|------|----------|
| 🟡 Medium | **pokersolver排名映射未验证**：`mapRank` 直接强制类型转换，未验证范围 | mapRank | 添加范围校验 `if (rank < 1 \|\| rank > 10) throw new Error(...)` |
| 🟡 Medium | **平局处理过于简单**：平分底池时使用 `Math.floor` 可能损失筹码 | showdown | 将余数分配给最先行动的赢家 |

#### 总体评分: 8/10

---

## 第二轮评审：系统架构与安全

### 模块: BettingRound 边池逻辑

#### 问题列表

| 严重程度 | 问题 | 位置 | 建议修复 |
|----------|------|------|----------|
| 🔴 Critical | **边池计算根本性错误**：`createSidePot` 未将主池中超出all-in玩家投入的差额转移到边池，导致边池金额从0开始 | createSidePot() | 计算all-in玩家的投入额，将其他玩家超出该额度的部分拆分到新边池 |
| 🔴 Critical | **isRoundComplete中const重新赋值**：TypeScript严格模式下编译报错 | isRoundComplete():52 | 将 `const playersToAct` 改为 `let playersToAct` |
| 🔴 Critical | **raise后未排除raiser本人**：导致raiser需要再次行动才能结束轮次，可能死循环 | isRoundComplete():52-57 | raise重置后立即 `playersToAct.delete(action.playerId)` |
| 🟠 High | **raise金额语义不明确**：未区分"加注到"和"加注额"，未验证min-raise规则 | recordAction():17-19 | 明确amount为"raise to"，校验 `amount >= currentBet + lastRaiseIncrement` |
| 🟠 High | **addToPot无校验**：amount可为负数/NaN/Infinity | addToPot() | 添加 `if (!Number.isFinite(amount) \|\| amount <= 0) throw new Error(...)` |
| 🟠 High | **eligiblePlayers逻辑反了**：all-in玩家应有资格赢得主池，边池才应排除 | createSidePot() | all-in玩家应保留在主池的eligiblePlayers中 |
| 🟡 Medium | **未处理all_in玩家**：all-in玩家不应出现在"待行动"集合 | isRoundComplete() | 维护allInPlayers集合 |
| 🟡 Medium | **多个边池时currentPotIndex只递增不回退**：后续投注可能进入错误的池 | createSidePot() | 重新设计为按投入额排序的多层边池结构 |

#### 总体评分: 4/10

---

### 模块: Socket.io 连接管理和断线重连

#### 问题列表

| 严重程度 | 问题 | 位置 | 建议修复 |
|----------|------|------|----------|
| 🔴 Critical | **内存泄漏**：`setTimeout`回调持有闭包引用，断线玩家多了后定时器堆积 | disconnect handler | 将timer存储在disconnectedPlayers中，重连时clearTimeout |
| 🔴 Critical | **缺少重连机制**：玩家重连后不会自动恢复房间和游戏状态 | 整个文件缺失 | 添加 `socket.on("reconnect_game")` 处理器 |
| 🟠 High | **socket.userId可能为undefined**：未认证断连会污染Map | disconnect handler | 开头添加 `if (!socket.userId) return;` |
| 🟠 High | **多设备登录覆盖**：userSockets只存一个socketId，旧连接断开时误标用户断线 | userSockets.set | 改用 `Map<string, Set<string>>` |
| 🟠 High | **断线期间行动回合未处理**：其他玩家无限等待 | 整个文件缺失 | 断线时启动超时自动fold |
| 🟡 Medium | **player_disconnected广播userId**：可能泄露内部用户标识符 | emit调用 | 广播seatNumber或displayName |
| 🟡 Medium | **通过socket.rooms查找游戏房间**：脆弱，可能匹配到错误的room | disconnect handler | 使用独立的 `Map<socketId, roomId>` 维护映射 |

#### 总体评分: 5/10

---

### 模块: 游戏恢复和快照机制

#### 问题列表

| 严重程度 | 问题 | 位置 | 建议修复 |
|----------|------|------|----------|
| 🔴 Critical | **recoverGame使用硬编码零值配置**：恢复后盲注为0，游戏规则完全偏离 | recoverGame():7 | 将房间配置序列化到快照中，恢复时从state.config读取 |
| 🔴 Critical | **恢复时未恢复关键状态**：未恢复轮次、公共牌、底池、牌组状态等 | recoverGame():8-10 | GameEngine提供 `restoreFromSnapshot(state)` 方法 |
| 🟠 High | **快照数据无schema验证**：强制类型断言 `as any`，数据篡改或版本不匹配时被静默吞掉 | recoverGame():5 | 使用Zod/Joi验证快照schema |
| 🟠 High | **快照写入时机和频率未体现**：可能丢失操作或数据库压力过大 | 整个文件缺失 | 实现WAL模式：每个action追加写入，快照定期写入 |
| 🟠 High | **recoverGame成功后未注册到activeGames**：服务层无法通过gameId找到引擎 | recoverGame() | return前添加 `this.activeGames.set(gameId, gameEngine)` |
| 🟡 Medium | **快照无完整性校验**：无checksum/hash，被篡改后无法检测 | recoverGame() | 快照写入时计算HMAC签名，恢复时验证 |
| 🟡 Medium | **catch吞掉所有异常无日志**：恢复失败时无法排查 | recoverGame():11 | 至少记录 `logger.error(...)` |

#### 总体评分: 3/10

---

### 模块: 数据库事务安全

#### 问题列表

| 严重程度 | 问题 | 位置 | 建议修复 |
|----------|------|------|----------|
| 🔴 Critical | **事务与内存状态不一致**：数据库事务成功后但activeGames.set前崩溃，游戏在DB中存在但内存中无引擎 | startGame():8 | 启动时扫描DB中PLAYING游戏并自动恢复 |
| 🔴 Critical | **筹码变动未在事务中**：扣减筹码成功但增加底池失败会导致筹码凭空消失 | 整个文件缺失 | 所有筹码变动必须在同一个prisma.$transaction中完成 |
| 🟠 High | **startGame事务中未检查房间当前状态**：可能出现重复startGame | startGame() | 添加 `where: { id: roomId, status: "WAITING" }` 条件 |
| 🟠 High | **事务隔离级别未指定**：高并发下可能出现幻读 | prisma.$transaction | 显式指定 `isolationLevel: Serializable` 或使用advisory lock |
| 🟡 Medium | **庄家和盲注位置硬编码**：未根据实际入座玩家计算 | startGame():3 | 根据实际入座玩家列表动态计算 |
| 🟡 Medium | **游戏结束结算未展示**：如果结算不在事务中可能部分玩家未收到筹码 | 整个文件缺失 | 结算必须原子化 |

#### 总体评分: 5/10

---

### 模块: 前端安全（Web）

#### 问题列表

| 严重程度 | 问题 | 位置 | 建议修复 |
|----------|------|------|----------|
| 🔴 Critical | **服务端广播完整游戏状态可能泄露其他玩家手牌**：攻击者可通过DevTools读取WebSocket帧 | Socket广播事件 | 按玩家过滤广播数据：每个玩家只收到自己的手牌+公共牌+其他玩家公开信息 |
| 🔴 Critical | **认证token存储风险**：localStorage易受XSS，query parameter会出现在日志中 | Socket连接建立 | 使用httpOnly cookie或短期token |
| 🟠 High | **前端直接信任服务端推送的游戏状态**：恶意中间人可推送伪造状态 | 前端状态管理 | 对关键数据签名验证，使用WSS防止中间人 |
| 🟠 High | **客户端操作消息未做基本校验**：可产生大量无效请求 | 前端操作发送 | 添加基本校验+操作节流 |
| 🟠 High | **缺少CSRF防护**：Socket.io默认不检查Origin | Socket.io配置 | 配置cors.origin白名单，添加CSRF token |
| 🟡 Medium | **用户昵称直接渲染**：存在XSS风险 | 前端渲染 | 使用框架默认转义机制 |

#### 总体评分: 6/10

---

## 问题严重程度汇总

| 严重程度 | 第一轮 | 第二轮 | 总计 |
|----------|--------|--------|------|
| 🔴 Critical | 3 | 9 | 12 |
| 🟠 High | 5 | 9 | 14 |
| 🟡 Medium | 3 | 8 | 11 |
| **总计** | **11** | **26** | **37** |

---

## 优先修复建议

### P0 - 必须立即修复（安全性/资金风险）

1. **添加processAction互斥锁** - 防止竞态条件导致的双重下注
2. **修复BettingRound边池逻辑** - 当前实现完全错误
3. **修复recoverGame使用硬编码零值** - 恢复后游戏规则完全错误
4. **添加amount参数校验** - 防止恶意金额攻击
5. **添加Socket.io重连机制** - 防止玩家断线后无法恢复

### P1 - 高优先级（功能正确性）

1. **修复isRoundComplete的const重赋值Bug**
2. **修复createSidePot的eligiblePlayers逻辑**
3. **添加playerId服务端校验**
4. **添加游戏阶段验证**
5. **添加All-In状态检查**

### P2 - 中优先级（健壮性）

1. **添加操作超时机制**
2. **添加快照schema验证**
3. **添加错误日志记录**
4. **修复多设备登录覆盖问题**
5. **添加前端数据过滤**

---

*报告生成时间: 2026-03-26 18:50*
*第三轮补充: 2026-03-26 19:25*

---

# 第三轮评审：认证、审计、数据库与基础设施

## 问题严重程度汇总（第三轮）

| 严重程度 | 数量 |
|----------|------|
| 🔴 Critical | 15 |
| 🟠 High | 16 |
| 🟡 Medium | 12 |

---

## 模块: auth.ts (认证授权系统)

### 问题列表

| 严重程度 | 问题 | 位置 | 建议修复 |
|----------|------|------|----------|
| 🔴 Critical | **JWT_SECRET 未校验**：`jwt.sign(payload, undefined)` 会生成 `alg: "none"` 无签名令牌，可被任何人伪造 | generateTokens() | 启动时强制校验 secret 存在 |
| 🔴 Critical | **登录失败追踪使用内存 Map**：在 `replicas: 2` 环境下，攻击者可轮询两个实例绕过账号锁定 | loginAttempts | 迁移到 Redis 实现分布式限流 |
| 🔴 Critical | **Refresh Token 存在 TOCTOU 竞态**：同一 token 可被并发多次使用，每次都生成新 token（Replay Attack） | /refresh 路由 | 事务内原子删除，或 Redis 一次性消费标记 |
| 🟠 High | **注册接口无速率限制**：攻击者可批量注册账号获得初始筹码 | router.post("/register") | 添加 IP 限流 + CAPTCHA |
| 🟠 High | **用户存在检查存在竞态**：两个并发请求可能同时通过检查 | 注册路由 | 直接 create 并 catch P2002 错误 |
| 🟠 High | **登录存在 Timing Oracle**：用户不存在时响应更快，攻击者可枚举有效邮箱 | 登录路由 | 不存在时也执行 bcrypt.compare 消除时间差 |
| 🟠 High | **expiresIn 无校验**：可能配置超长有效期令牌 | generateTokens() | 白名单格式校验 + 上限 |
| 🟡 Medium | **Refresh Token 明文存储**：数据库泄露后可直接使用所有 token | RefreshToken 模型 | 存储 sha256 哈希 |
| 🟡 Medium | **无 Token 家族追踪**：无法检测 token 被盗后的滥用 | /refresh 路由 | 引入 tokenFamily 字段 |
| 🟡 Medium | **登录后未清理过期 token**：RefreshToken 表无限增长 | 登录路由 | 登录时清理过期 token |

#### 总体评分: 4/10

---

## 模块: audit.ts (审计日志服务)

### 问题列表

| 严重程度 | 问题 | 位置 | 建议修复 |
|----------|------|------|----------|
| 🔴 Critical | **审计写入失败被静默吞掉**：资金类审计丢失后无补偿，违反审计完整性要求 | log() catch 块 | 关键审计失败时应回滚业务操作或写入 WAL |
| 🟠 High | **BigInt 序列化会崩溃**：`JSON.stringify(bigint)` 会抛出 TypeError | log() JSON序列化 | 使用自定义 replacer 处理 BigInt |
| 🟠 High | **logBalanceUpdate 未传播错误**：log() 吞掉所有异常，调用方无法知道审计是否成功 | logBalanceUpdate() | 关键审计应重新抛出异常 |
| 🟡 Medium | **审计与业务操作不在同一事务**：可能出现数据不一致 | 架构设计 | 将审计纳入业务事务 |
| 🟡 Medium | **IP 来源未规范化**：X-Forwarded-For 未处理，可能记录伪造 IP | AuditContext | 规范化处理代理 IP |
| 🟡 Medium | **审计表无分区/归档策略**：高频操作导致表膨胀 | 架构设计 | 按月分区或归档 |

#### 总体评分: 4/10

---

## 模块: room.ts (房间路由)

### 问题列表

| 严重程度 | 问题 | 位置 | 建议修复 |
|----------|------|------|----------|
| 🔴 Critical | **JWT 验证在每个路由手动重复**：易遗漏且 secret 未配置时可能接受 `alg: none` 令牌 | 路由开头 JWT 解析 | 抽取为中间件，启动时校验 secret |
| 🟠 High | **房间码生成无最大重试限制**：空间接近饱和时可能无限循环 | while(!isUnique) 循环 | 添加最大重试次数 |
| 🟠 High | **code 唯一性检查存在竞态** | 房间创建逻辑 | 直接 create 并 catch P2002 |
| 🟡 Medium | **未验证 token 类型**：refresh token 可当 access token 使用 | JWT 验证 | 检查 `decoded.type === "access"` |

#### 总体评分: 5/10

---

## 模块: requestSignature.ts (请求签名)

### 问题列表

| 严重程度 | 问题 | 位置 | 建议修复 |
|----------|------|------|----------|
| 🔴 Critical | **secret 未配置时直接跳过验证**：生产环境忘记配置则签名保护形同虚设 | if(!secret) return next() | 生产环境必须配置，否则启动失败 |
| 🟠 High | **JSON 序列化不保证字段顺序**：可能导致签名不一致 | JSON.stringify(req.body) | 使用确定性序列化或基于 rawBody |
| 🟠 High | **hex 解析异常处理不当**：`Buffer.from(invalidHex)` 不抛错 | 签名比较 | 先校验 hex 格式 |
| 🟡 Medium | **5分钟时间窗口过大**：允许较长时间重放攻击 | 时间戳校验 | 缩短到 30-60 秒 |
| 🟡 Medium | **无 nonce 机制**：同一签名在窗口内可重复使用 | 整个模块 | 添加 Redis nonce 去重 |
| 🟡 Medium | **GET 请求 URL 编码差异**：可能导致签名不一致 | req.originalUrl | 规范化 URL 后再签名 |

#### 总体评分: 4/10

---

## 模块: docker-compose.yml (基础设施)

### 问题列表

| 严重程度 | 问题 | 位置 | 建议修复 |
|----------|------|------|----------|
| 🔴 Critical | **replicas: 2 但 Socket.io 无 Redis adapter**：两个实例 WebSocket 不互通 | server.deploy | 配置 @socket.io/redis-adapter |
| 🔴 Critical | **PostgreSQL 和 Redis 无密码**：容器网络内可直连数据库 | postgres/redis 服务 | 添加密码认证 |
| 🟠 High | **无健康检查**：服务不可用时容器不会重启/摘除 | 所有服务 | 添加 healthcheck 配置 |
| 🟠 High | **无网络隔离**：数据库层与应用层在同一网络 | 网络配置 | 分离 frontend/backend 网络 |
| 🟠 High | **Redis 未挂载持久化卷**：--appendonly yes 写入临时层 | redis 服务 | 添加 volumes 配置 |
| 🟡 Medium | **512M 内存限制对 Node.js 偏紧** | memory: 512M | 配合 --max-old-space-size 或提升限制 |
| 🟡 Medium | **无日志驱动配置**：容器日志可能无限增长 | 所有服务 | 配置 logging + max-size |
| 🟡 Medium | **无 restart 策略**：进程崩溃后不会自动恢复 | 所有服务 | 添加 restart: unless-stopped |

#### 总体评分: 3/10

---

## 模块: schema.prisma (数据库设计)

### 问题列表

| 严重程度 | 问题 | 位置 | 建议修复 |
|----------|------|------|----------|
| 🔴 Critical | **balance 无数据库约束防止负数**：并发扣款可能导致余额为负 | User.balance | 添加 CHECK 约束 balance >= 0 |
| 🟠 High | **RefreshToken 存储明文 token**：数据库泄露后可直接使用 | RefreshToken.token | 存储 sha256 哈希 |
| 🟠 High | **GameSnapshot.state 无大小限制**：复杂状态可能产生巨大 JSON | GameSnapshot.state | 校验 JSON 大小上限 |
| 🟠 High | **RefreshToken.userId 无索引**：按用户查询时全表扫描 | RefreshToken 模型 | 添加 @@index([userId]) |
| 🟡 Medium | **RefreshToken.expiresAt 无索引**：清理过期 token 全表扫描 | RefreshToken 模型 | 添加 @@index([expiresAt]) |
| 🟡 Medium | **GameSnapshot 每游戏只能有一个快照**：无法保留历史快照 | GameSnapshot | 改为 @@unique([gameId, type]) |
| 🟡 Medium | **Room.code 非主键**：关联查询需要额外查询 | Room 模型 | 评估使用 code 作为主键 |

#### 总体评分: 5/10

---

## 完整问题汇总（全部三轮）

| 严重程度 | 第一轮 | 第二轮 | 第三轮 | 总计 |
|----------|--------|--------|--------|------|
| 🔴 Critical | 3 | 9 | 15 | 27 |
| 🟠 High | 5 | 9 | 16 | 30 |
| 🟡 Medium | 3 | 8 | 12 | 23 |
| **总计** | **11** | **26** | **43** | **80** |

---

## 新增优先修复建议

### P0 - 必须立即修复（新增）
1. **JWT_SECRET 必须启动时校验** - 当前可能接受 alg:none 令牌
2. **登录失败追踪必须用 Redis** - 多实例下绕过问题
3. **Refresh Token 必须防Replay** - 使用原子删除
4. **Socket.io 必须配置 Redis Adapter** - 当前多实例无法通信
5. **数据库必须设置密码** - 当前裸奔

### P1 - 高优先级（新增）
1. **注册接口必须加限流** - 防批量注册滥用
2. **审计日志失败必须处理** - 当前静默丢失
3. **balance 必须加数据库约束** - 防负数
4. **添加健康检查** - 服务不可用时无感知
5. **修复 BigInt 序列化问题** - 会导致崩溃

---

*第三轮评审完成时间: 2026-03-26 19:25*
*第四轮补充: 2026-03-26 20:30*

---

# 第四轮评审：前端状态管理、Socket客户端、路由配置

## 模块: store/index.ts (Zustand 状态管理)

### 问题列表

| 严重程度 | 问题 | 位置 | 建议修复 |
|----------|------|------|----------|
| 🔴 Critical | **refreshToken明文持久化到localStorage**：XSS漏洞可窃取并长期冒充用户 | persist配置 | refreshToken应存httpOnly cookie，前端不应持有；若必须存前端使用sessionStorage或加密 |
| 🔴 Critical | **accessToken持久化到localStorage**：同样面临XSS窃取风险 | persist配置 | accessToken存内存(非持久化部分)，refreshToken走httpOnly cookie |
| 🟡 Medium | **logout未清除持久化存储**：手动在DevTools恢复storage后旧token仍可用 | logout action | logout时显式调用localStorage.removeItem并调用后端吊销接口 |
| 🟡 Medium | **isAuthenticated派生状态被冗余持久化**：可能导致不一致 | partialize | 从partialize中移除，改为getter或selector |
| 🟡 Medium | **gameState无类型约束且无脏数据防护**：恶意数据进入UI可能崩溃或XSS | setGameState | 添加Zod schema校验 |
| 🟢 Low | **缺少devtools中间件**：生产调试困难 | 整个store | 添加devtools中间件 |
| 🟢 Low | **setTokens和setUser分离调用存在中间状态**：可能导致带无效token的请求 | setUser/setTokens | 合并为login()原子操作 |

#### 总体评分: 4/10

---

## 模块: socket.ts (前端Socket客户端)

### 问题列表

| 严重程度 | 问题 | 位置 | 建议修复 |
|----------|------|------|----------|
| 🔴 Critical | **Token过期后无刷新机制**：游戏中途token过期将静默断开 | connect() | 监听connect_error，检测401后自动刷新token并重连 |
| 🔴 Critical | **断线重连后不恢复房间/游戏订阅**：重连后收不到任何游戏事件 | 无重连处理 | connect事件中重新emit join_room |
| 🔴 Critical | **setupListeners中this.socket.on无空值检查**：竞争条件可能导致崩溃 | setupListeners() | 添加空值检查 |
| 🟡 Medium | **单例模式但无防重复连接**：多次connect()会创建多个socket实例 | connect() | connect前检查并断开旧连接 |
| 🟡 Medium | **playerAction无本地校验**：无效action/amount会浪费带宽触发服务端错误 | playerAction() | 发送前校验action枚举值和amount范围 |
| 🟡 Medium | **无心跳/连接状态同步**：isConnected未与socket实际状态同步 | 整个类 | 监听connect/disconnect事件自动更新store |
| 🟡 Medium | **game_state_update无序列号/版本校验**：旧状态可能覆盖新状态 | game_state_update监听 | 添加版本号校验 |
| 🟡 Medium | **your_turn事件仅console.log**：用户无法看到倒计时 | your_turn监听 | 更新store中的turn状态和timeout |
| 🟢 Low | **无事件重试/确认机制**：关键操作无ack回调无法确认 | playerAction | 使用ack回调确认 |

#### 总体评分: 3/10

---

## 模块: user.ts (用户路由)

### 问题列表

| 严重程度 | 问题 | 位置 | 建议修复 |
|----------|------|------|----------|
| 🔴 Critical | **绕过中间件自行解析JWT，逻辑重复且不一致**：extractUserId与verifySignature中间件可能冲突 | extractUserId() | 直接使用中间件注入的req.user.userId |
| 🔴 Critical | **process.env.JWT_SECRET!非空断言**：secret未设置时行为未定义 | extractUserId() | 启动时校验必需环境变量 |
| 🟡 Medium | **select语法错误**：应为select: { id: true, username: true, ... } | /me路由Prisma查询 | 修正为正确语法 |
| 🟡 Medium | **email字段暴露在响应中**：PII信息增加泄露风险 | /me路由 | 评估是否需要返回完整email |
| 🟡 Medium | **leaderboard无认证但被verifySignature保护**：公开数据不应要求签名 | /leaderboard路由 | 移至公开路由 |
| 🟡 Medium | **limit参数解析无NaN防护**：parseInt("abc")返回NaN | /leaderboard路由 | 添加isNaN检查 |
| 🟡 Medium | **TODO端点返回硬编码假数据**：生产环境误导用户 | /me/stats和/leaderboard | 返回501 Not Implemented |
| 🟢 Low | **无async错误处理包装**：Promise rejection可能不被Express捕获 | 所有路由handler | 添加try-catch或使用express-async-errors |

#### 总体评分: 4/10

---

## 模块: routes/index.ts (路由中间件配置)

### 问题列表

| 严重程度 | 问题 | 位置 | 建议修复 |
|----------|------|------|----------|
| 🔴 Critical | **verifySignature命名误导**：暗示签名验证但实际用于认证，导致误解 | 所有受保护路由 | 明确分离authenticate和verifySignature |
| 🟡 Medium | **auth路由完全无保护**：注册/登录应有rate limiting和CAPTCHA | app.use(/auth, authRouter) | 添加rate limiting |
| 🟡 Medium | **404处理器暴露内部路径信息**：`Route ${req.method} ${req.path} not found` | 404处理器 | 改为通用消息 |

#### 总体评分: 5/10

---

## 四轮问题汇总

| 严重程度 | 第一轮 | 第二轮 | 第三轮 | 第四轮 | 总计 |
|----------|--------|--------|--------|--------|------|
| 🔴 Critical | 3 | 9 | 15 | 12 | 39 |
| 🟠 High | 5 | 9 | 16 | 0 | 30 |
| 🟡 Medium | 3 | 8 | 12 | 13 | 36 |
| 🟢 Low | 0 | 0 | 0 | 6 | 6 |
| **总计** | **11** | **26** | **43** | **31** | **111** |

---

## 新增P0修复建议

1. **前端token必须移除localStorage持久化** - 改用httpOnly cookie或内存存储
2. **Socket客户端必须实现token刷新和重连恢复** - 当前游戏中途断连无任何恢复
3. **user.ts的extractUserId必须删除** - 与中间件冲突导致双重认证逻辑
4. **routes/index.ts的命名必须修正** - verifySignature不应是认证中间件

---

*第四轮评审完成时间: 2026-03-26 20:30*
