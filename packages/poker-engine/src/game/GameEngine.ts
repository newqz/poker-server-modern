/**
 * 游戏引擎
 * @module game/GameEngine
 * @author ARCH
 * @date 2026-03-26
 * @task BE-001
 * @description 德州扑克游戏核心逻辑管理
 * 
 * 安全修复 (2026-04-02):
 * - 使用 async-mutex 替代简单 boolean 作为 actionLock，防止竞态条件
 * - 添加金额边界检查，防止整数溢出
 * - 改进错误处理，确保锁正确释放
 */

import type { 
  Card, 
  GameStatus, 
  GameRound, 
  PlayerAction,
  GameConfig
} from '@poker/shared';
import { logger } from '../utils/logger';
import { GameStatus as GameStatusEnum, PlayerAction as PlayerActionEnum } from '@poker/shared';
import { Deck } from '../deck/Deck';
import { HandEvaluator } from '../evaluator/HandEvaluator';
import { BettingRound, BettingAction } from './BettingRound';

// 引入 Mutex 库
// 注意：如果没有安装 async-mutex，可以使用简单实现作为后备
let Mutex: any;
try {
  const asyncMutex = require('async-mutex');
  Mutex = asyncMutex.Mutex;
} catch (e) {
  // 后备：使用简单互斥锁实现
  Mutex = class SimpleMutex {
    private locked = false;
    private waitQueue: Array<() => void> = [];

    async acquire(): Promise<() => void> {
      if (!this.locked) {
        this.locked = true;
        return () => {
          this.release();
        };
      }
      return new Promise((resolve) => {
        this.waitQueue.push(() => {
          this.locked = true;
          resolve(() => this.release());
        });
      });
    }

    release(): void {
      const next = this.waitQueue.shift();
      if (next) {
        next();
      } else {
        this.locked = false;
      }
    }

    isLocked(): boolean {
      return this.locked;
    }
  };
}

export interface GamePlayer {
  userId: string;
  username: string;
  seatNumber: number;
  holeCards: Card[];
  chips: number;
  betAmount: number;
  isFolded: boolean;
  isAllIn: boolean;
  isActive: boolean;
}

export interface GameState {
  id: string;
  roomId: string;
  status: GameStatus;
  round: GameRound | null;
  communityCards: Card[];
  players: GamePlayer[];
  dealerSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  currentPlayerSeat: number;
  pot: number;
  bettingRound: BettingRound;
  lastAction?: BettingAction;
  winners?: Array<{
    playerId: string;
    amount: number;
    handDescription: string;
  }>;
}

/**
 * 动作处理结果
 * 包含筹码变动明细，供事务处理使用
 */
export interface ActionResult {
  playerId: string;
  action: PlayerAction;
  amount?: number;
  // 筹码变动
  chipChange: {
    playerId: string;
    deducted: number;      // 从玩家余额扣减
    addedToPot: number;   // 加入底池
    newBalance: number;   // 玩家新余额
  };
  // 游戏状态
  newState: GameState;
  nextPlayerId?: string;
}

/**
 * 游戏引擎
 * 管理德州扑克的完整游戏流程
 * 
 * 线程安全说明：
 * - 使用 Mutex 确保 processAction 串行执行
 * - 所有状态修改必须通过 processAction 进行
 * - 避免直接修改 state 对象
 */
export class GameEngine {
  private state: GameState;
  private deck: Deck;
  private config: GameConfig;
  // 修复：使用真正的互斥锁替代简单 boolean
  private actionMutex: InstanceType<typeof Mutex>;
  private stateSnapshot: GameState | null = null;  // 用于回滚的状态快照
  private readonly ACTIONABLE_STATUSES = new Set([
    GameStatusEnum.PREFLOP,
    GameStatusEnum.FLOP,
    GameStatusEnum.TURN,
    GameStatusEnum.RIVER
  ]);
  
  // 安全限制常量
  private static readonly MAX_AMOUNT = 1000000000; // 10亿，防止整数溢出
  private static readonly MAX_POT_MULTIPLIER = 1000; // 最大下注额不能超过底池的1000倍

  constructor(gameId: string, roomId: string, config: GameConfig) {
    this.config = config;
    this.deck = new Deck();
    this.actionMutex = new Mutex();
    this.state = {
      id: gameId,
      roomId,
      status: GameStatusEnum.WAITING,
      round: null,
      communityCards: [],
      players: [],
      dealerSeat: 0,
      smallBlindSeat: 1,
      bigBlindSeat: 2,
      currentPlayerSeat: -1,
      pot: 0,
      bettingRound: new BettingRound()
    };
  }

  /**
   * 添加玩家到游戏
   */
  addPlayer(userId: string, username: string, seatNumber: number, buyIn: number): void {
    if (this.state.status !== GameStatusEnum.WAITING) {
      throw new Error('GAME_ALREADY_STARTED');
    }

    // 检查座位是否已被占用
    const existingPlayer = this.state.players.find(p => p.seatNumber === seatNumber);
    if (existingPlayer) {
      throw new Error('SEAT_OCCUPIED');
    }

    this.state.players.push({
      userId,
      username,
      seatNumber,
      holeCards: [],
      chips: buyIn,
      betAmount: 0,
      isFolded: false,
      isAllIn: false,
      isActive: true
    });
  }

  /**
   * 开始游戏
   */
  start(dealerSeat: number): void {
    if (this.state.players.length < 2) {
      throw new Error('NEED_AT_LEAST_2_PLAYERS');
    }

    this.state.status = GameStatusEnum.STARTING;
    this.state.dealerSeat = dealerSeat;
    
    // 计算盲注位置
    const playerCount = this.state.players.length;
    this.state.smallBlindSeat = (dealerSeat + 1) % playerCount;
    this.state.bigBlindSeat = (dealerSeat + 2) % playerCount;
    
    // 收取盲注
    this.postBlinds();
    
    // 发底牌
    this.dealHoleCards();
    
    // 进入翻牌前
    this.startRound('preflop');
  }

  /**
   * 收取盲注
   */
  private postBlinds(): void {
    const sbPlayer = this.getPlayerBySeat(this.state.smallBlindSeat);
    const bbPlayer = this.getPlayerBySeat(this.state.bigBlindSeat);

    if (sbPlayer) {
      const sbAmount = Math.min(this.config.smallBlind, sbPlayer.chips);
      if (sbAmount > 0) {
        sbPlayer.chips -= sbAmount;
        sbPlayer.betAmount = sbAmount;
        this.state.bettingRound.addToPot(sbAmount, sbPlayer.userId);
      }
    }

    if (bbPlayer) {
      const bbAmount = Math.min(this.config.bigBlind, bbPlayer.chips);
      if (bbAmount > 0) {
        bbPlayer.chips -= bbAmount;
        bbPlayer.betAmount = bbAmount;
        this.state.bettingRound.addToPot(bbAmount, bbPlayer.userId);
      }
    }
  }

  /**
   * 发底牌
   */
  private dealHoleCards(): void {
    for (const player of this.state.players) {
      if (player.isActive) {
        player.holeCards = this.deck.dealMultiple(2);
      }
    }
  }

  /**
   * 开始新轮次
   */
  private startRound(round: GameRound): void {
    this.state.round = round;
    
    switch (round) {
      case 'preflop':
        this.state.status = GameStatusEnum.PREFLOP;
        // 从大盲注下家开始
        this.state.currentPlayerSeat = (this.state.bigBlindSeat + 1) % this.state.players.length;
        break;
      
      case 'flop':
        this.state.status = GameStatusEnum.FLOP;
        this.deck.burn(); // 烧牌
        this.state.communityCards = this.deck.dealMultiple(3); // 发3张翻牌
        this.resetBettingRound();
        this.state.currentPlayerSeat = this.state.smallBlindSeat;
        break;
      
      case 'turn':
        this.state.status = GameStatusEnum.TURN;
        this.deck.burn();
        const turnCard = this.deck.deal();
        if (turnCard) this.state.communityCards.push(turnCard);
        this.resetBettingRound();
        this.state.currentPlayerSeat = this.state.smallBlindSeat;
        break;
      
      case 'river':
        this.state.status = GameStatusEnum.RIVER;
        this.deck.burn();
        const riverCard = this.deck.deal();
        if (riverCard) this.state.communityCards.push(riverCard);
        this.resetBettingRound();
        this.state.currentPlayerSeat = this.state.smallBlindSeat;
        break;
    }
  }

  /**
   * 重置下注轮次
   */
  private resetBettingRound(): void {
    // 保存之前的底池金额
    this.state.pot += this.state.bettingRound.getTotalPot();
    this.state.bettingRound = new BettingRound();
    
    // 重置玩家当前下注
    for (const player of this.state.players) {
      player.betAmount = 0;
    }
  }

  /**
   * 处理玩家动作
   * 使用 Mutex 确保线程安全，防止竞态条件
   * 
   * @returns ActionResult 包含筹码变动明细
   */
  async processAction(playerId: string, action: PlayerAction, amount?: number): Promise<ActionResult> {
    // 获取互斥锁
    const release = await this.actionMutex.acquire();
    
    try {
      return this.doProcessAction(playerId, action, amount);
    } finally {
      // 确保锁被释放
      release();
    }
  }

  /**
   * 实际处理动作的内部方法
   * 在持有互斥锁时调用
   */
  private doProcessAction(playerId: string, action: PlayerAction, amount?: number): ActionResult {
    const player = this.getPlayerById(playerId);
    
    if (!player) {
      throw new Error('INVALID_PLAYER');
    }

    // 检查游戏阶段是否接受动作
    if (!this.ACTIONABLE_STATUSES.has(this.state.status)) {
      throw new Error('INVALID_PHASE');
    }

    // 检查是否是自己的回合
    if (player.seatNumber !== this.state.currentPlayerSeat) {
      throw new Error('NOT_YOUR_TURN');
    }

    // 检查是否已弃牌
    if (player.isFolded) {
      throw new Error('ALREADY_FOLDED');
    }

    // 检查是否已全押
    if (player.isAllIn) {
      throw new Error('ALREADY_ALL_IN');
    }

    // 校验金额参数
    if (amount !== undefined) {
      const validatedAmount = this.sanitizeAmount(amount);
      if (validatedAmount <= 0) {
        throw new Error('INVALID_AMOUNT');
      }
      amount = validatedAmount;
    }

    // 验证动作合法性
    this.validateAction(player, action, amount);

    // 筹码变动记录
    let chipChange = {
      playerId,
      deducted: 0,
      addedToPot: 0,
      newBalance: player.chips
    };

    // 执行动作并记录筹码变动
    switch (action) {
      case PlayerActionEnum.FOLD:
        player.isFolded = true;
        break;

      case PlayerActionEnum.CHECK:
        // 什么都不做
        break;

      case PlayerActionEnum.CALL:
        const callAmount = this.state.bettingRound.getCurrentBet() - player.betAmount;
        const actualCall = Math.min(callAmount, player.chips);
        if (actualCall > 0) {
          player.chips -= actualCall;
          player.betAmount += actualCall;
          this.state.bettingRound.addToPot(actualCall, playerId);
          chipChange = {
            playerId,
            deducted: actualCall,
            addedToPot: actualCall,
            newBalance: player.chips
          };
        }
        break;

      case PlayerActionEnum.RAISE:
        if (!amount) throw new Error('RAISE_REQUIRES_AMOUNT');
        const raiseAmount = amount - player.betAmount;
        if (raiseAmount > player.chips) {
          throw new Error('INSUFFICIENT_CHIPS');
        }
        if (raiseAmount > 0) {
          player.chips -= raiseAmount;
          player.betAmount = amount;
          this.state.bettingRound.addToPot(raiseAmount, playerId);
          chipChange = {
            playerId,
            deducted: raiseAmount,
            addedToPot: raiseAmount,
            newBalance: player.chips
          };
        }
        break;

      case PlayerActionEnum.ALL_IN:
        const allInAmount = player.chips;
        if (allInAmount > 0) {
          player.betAmount += allInAmount;
          player.chips = 0;
          player.isAllIn = true;
          this.state.bettingRound.addToPot(allInAmount, playerId);
          chipChange = {
            playerId,
            deducted: allInAmount,
            addedToPot: allInAmount,
            newBalance: 0
          };
          
          // 如果全押金额大于当前下注，视为加注
          if (player.betAmount > this.state.bettingRound.getCurrentBet()) {
            this.state.bettingRound.recordAction(playerId, action, player.betAmount);
          }
        }
        break;
    }

    // 记录动作
    this.state.bettingRound.recordAction(playerId, action, amount);
    this.state.lastAction = {
      playerId,
      action,
      amount,
      timestamp: new Date()
    };

    // 检查轮次是否结束
    if (this.isRoundComplete()) {
      this.advanceToNextRound();
    } else {
      this.moveToNextPlayer();
    }

    // 返回结果
    const nextPlayer = this.getCurrentPlayer();
    return {
      playerId,
      action,
      amount,
      chipChange,
      newState: this.getState(),
      nextPlayerId: nextPlayer?.userId
    };
  }

  /**
   * 校验金额参数：确保为正整数且在安全范围内
   */
  private sanitizeAmount(amount: number): number {
    // 转换为整数
    const validated = Math.floor(Number(amount));
    
    // 检查是否为有效数字
    if (!Number.isFinite(validated)) {
      return 0;
    }
    
    // 检查是否为正数
    if (validated <= 0) {
      return 0;
    }
    
    // 检查是否超过最大限制（防止溢出）
    if (validated > GameEngine.MAX_AMOUNT) {
      return 0;
    }
    
    return validated;
  }

  /**
   * 验证动作合法性
   */
  private validateAction(player: GamePlayer, action: PlayerAction, amount?: number): void {
    const currentBet = this.state.bettingRound.getCurrentBet();
    const playerBet = player.betAmount;
    const currentPot = this.state.pot + this.state.bettingRound.getTotalPot();

    switch (action) {
      case PlayerActionEnum.CHECK:
        if (currentBet > playerBet) {
          throw new Error('MUST_CALL_OR_FOLD');
        }
        break;

      case PlayerActionEnum.CALL:
        if (currentBet <= playerBet) {
          throw new Error('NO_NEED_TO_CALL');
        }
        break;

      case PlayerActionEnum.RAISE:
        if (!amount) throw new Error('RAISE_REQUIRES_AMOUNT');
        
        // 验证下注金额不超过玩家拥有的筹码
        const totalBet = amount - playerBet;
        if (totalBet > player.chips) {
          throw new Error('INSUFFICIENT_CHIPS');
        }
        
        // 验证下注金额不超过底池的合理倍数（防止过度加注）
        if (amount > playerBet + currentPot * GameEngine.MAX_POT_MULTIPLIER) {
          throw new Error('BET_TOO_LARGE');
        }
        
        if (amount <= currentBet) {
          throw new Error('RAISE_MUST_BE_MORE_THAN_CURRENT_BET');
        }
        
        // 验证最小加注额（必须至少是当前下注额的两倍，或至少加大盲注）
        const minRaise = Math.max(currentBet * 2, this.config.bigBlind);
        if (amount < minRaise) {
          throw new Error('RAISE_TOO_SMALL');
        }
        break;
    }
  }

  /**
   * 移动到下一个玩家
   */
  private moveToNextPlayer(): void {
    const activePlayers = this.getActivePlayers();
    if (activePlayers.length === 0) return;
    
    const currentIndex = activePlayers.findIndex(p => p.seatNumber === this.state.currentPlayerSeat);
    const nextIndex = (currentIndex + 1) % activePlayers.length;
    this.state.currentPlayerSeat = activePlayers[nextIndex].seatNumber;
  }

  /**
   * 检查轮次是否完成
   */
  private isRoundComplete(): boolean {
    const activePlayers = this.getActivePlayers().filter(p => !p.isAllIn);
    return this.state.bettingRound.isRoundComplete(
      activePlayers.map(p => p.userId)
    );
  }

  /**
   * 进入下一轮
   */
  private advanceToNextRound(): void {
    // 检查是否只剩一名玩家未弃牌
    const notFolded = this.state.players.filter(p => !p.isFolded);
    if (notFolded.length === 1) {
      this.endGame();
      return;
    }

    // 根据当前轮次决定下一步
    switch (this.state.round) {
      case 'preflop':
        this.startRound('flop');
        break;
      case 'flop':
        this.startRound('turn');
        break;
      case 'turn':
        this.startRound('river');
        break;
      case 'river':
        this.showdown();
        break;
    }
  }

  /**
   * 摊牌
   */
  private showdown(): void {
    this.state.status = GameStatusEnum.SHOWDOWN;

    const notFolded = this.state.players.filter(p => !p.isFolded);
    
    // 使用牌型评估器找出赢家
    const hands = notFolded.map(p => ({
      playerId: p.userId,
      holeCards: p.holeCards,
      communityCards: this.state.communityCards
    }));

    const winners = HandEvaluator.compareHands(hands);
    
    // 分配底池
    const totalPot = this.state.pot + this.state.bettingRound.getTotalPot();
    const winAmount = Math.floor(totalPot / winners.length);

    this.state.winners = winners.map(w => ({
      playerId: w.playerId,
      amount: winAmount,
      handDescription: w.handInfo.description
    }));

    // 给赢家发放筹码
    for (const winner of this.state.winners) {
      const player = this.getPlayerById(winner.playerId);
      if (player) {
        player.chips += winner.amount;
      }
    }

    this.state.status = GameStatusEnum.ENDED;
  }

  /**
   * 结束游戏 (玩家提前获胜)
   */
  private endGame(): void {
    const winner = this.state.players.find(p => !p.isFolded);
    if (winner) {
      const totalPot = this.state.pot + this.state.bettingRound.getTotalPot();
      winner.chips += totalPot;
      this.state.winners = [{
        playerId: winner.userId,
        amount: totalPot,
        handDescription: '其他玩家弃牌'
      }];
    }
    this.state.status = GameStatusEnum.ENDED;
  }

  /**
   * 获取当前状态
   */
  getState(): GameState {
    return {
      ...this.state,
      players: this.state.players.map(p => ({
        ...p,
        holeCards: [...p.holeCards]
      }))
    };
  }

  /**
   * 获取玩家的公开信息 (不包含底牌)
   */
  getPlayerPublicInfo(playerId: string): Omit<GamePlayer, 'holeCards'> {
    const player = this.getPlayerById(playerId);
    if (!player) throw new Error('PLAYER_NOT_FOUND');
    
    const { holeCards, ...publicInfo } = player;
    return publicInfo;
  }

  /**
   * 获取玩家的底牌
   */
  getPlayerHoleCards(playerId: string): Card[] {
    const player = this.getPlayerById(playerId);
    if (!player) throw new Error('PLAYER_NOT_FOUND');
    return [...player.holeCards];
  }

  /**
   * 根据ID获取玩家
   */
  private getPlayerById(userId: string): GamePlayer | undefined {
    return this.state.players.find(p => p.userId === userId);
  }

  /**
   * 根据座位获取玩家
   */
  private getPlayerBySeat(seatNumber: number): GamePlayer | undefined {
    return this.state.players.find(p => p.seatNumber === seatNumber);
  }

  /**
   * 获取活跃玩家 (未弃牌)
   */
  private getActivePlayers(): GamePlayer[] {
    return this.state.players.filter(p => p.isActive && !p.isFolded);
  }

  /**
   * 获取当前轮到行动的玩家
   */
  getCurrentPlayer(): GamePlayer | undefined {
    return this.getPlayerBySeat(this.state.currentPlayerSeat);
  }

  /**
   * 从快照恢复完整游戏状态
   * 用于服务器重启后恢复游戏
   */
  restoreFromSnapshot(snapshot: GameState): void {
    // 恢复基本状态
    this.state.id = snapshot.id;
    this.state.roomId = snapshot.roomId;
    this.state.status = snapshot.status;
    this.state.round = snapshot.round;
    this.state.communityCards = [...snapshot.communityCards];
    this.state.dealerSeat = snapshot.dealerSeat;
    this.state.smallBlindSeat = snapshot.smallBlindSeat;
    this.state.bigBlindSeat = snapshot.bigBlindSeat;
    this.state.currentPlayerSeat = snapshot.currentPlayerSeat;
    this.state.pot = snapshot.pot;
    this.state.lastAction = snapshot.lastAction;
    this.state.winners = snapshot.winners;
    
    // 恢复玩家状态
    for (const snapshotPlayer of snapshot.players) {
      const existingPlayer = this.state.players.find(p => p.userId === snapshotPlayer.userId);
      if (existingPlayer) {
        existingPlayer.holeCards = [...snapshotPlayer.holeCards];
        existingPlayer.chips = snapshotPlayer.chips;
        existingPlayer.betAmount = snapshotPlayer.betAmount;
        existingPlayer.isFolded = snapshotPlayer.isFolded;
        existingPlayer.isAllIn = snapshotPlayer.isAllIn;
        existingPlayer.isActive = snapshotPlayer.isActive;
      }
    }
    
    // 重新创建下注轮次并恢复动作
    this.state.bettingRound = new BettingRound();
    // 注意：下注轮次的内部状态通过 recordAction 恢复
    // 这需要在外部调用 restoreBettingRoundActions
    
    logger.info(`Game ${this.state.id} state restored from snapshot`);
  }

  /**
   * 恢复下注轮次动作历史
   */
  restoreBettingRoundActions(actions: BettingAction[]): void {
    for (const action of actions) {
      this.state.bettingRound.recordAction(action.playerId, action.action, action.amount);
    }
  }

  /**
   * 保存状态快照（用于事务回滚）
   */
  saveSnapshotForRollback(): void {
    this.stateSnapshot = JSON.parse(JSON.stringify(this.state));
  }

  /**
   * 回滚到保存的状态快照
   * 用于数据库事务失败时恢复一致性
   */
  rollback(): void {
    if (this.stateSnapshot) {
      this.state = JSON.parse(JSON.stringify(this.stateSnapshot));
      this.stateSnapshot = null;
      logger.info({ gameId: this.state.id }, 'Game state rolled back');
    }
  }
}
