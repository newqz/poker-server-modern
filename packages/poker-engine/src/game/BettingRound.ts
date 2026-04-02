/**
 * 下注轮次管理
 * @module game/BettingRound
 * @author ARCH
 * @date 2026-03-26
 * @task BE-001
 * @description 德州扑克下注轮次管理，支持主池和边池
 * 
 * 边池算法说明：
 * - 当玩家全押时，计算该玩家的总投入
 * - 创建新边池，包含超出全押金额的投入
 * - 主池包含所有玩家的全押金额（取最小值）
 */

import type { PlayerAction } from '@poker/shared';

export interface BettingAction {
  playerId: string;
  action: PlayerAction;
  amount?: number;
  timestamp: Date;
}

export interface Pot {
  id: number;
  amount: number;
  eligiblePlayers: string[]; // 有资格赢取此底池的玩家ID
  allInAmount?: number; // 全押玩家投入的金额（用于边池计算）
}

/**
 * 下注轮次管理器
 * 管理一轮游戏中的下注流程
 */
export class BettingRound {
  private actions: BettingAction[];
  private currentBet: number;
  private pots: Pot[];
  private currentPotIndex: number;
  private playerBets: Map<string, number>; // 玩家本轮总下注

  constructor() {
    this.actions = [];
    this.currentBet = 0;
    this.pots = [{ id: 1, amount: 0, eligiblePlayers: [] }];
    this.currentPotIndex = 0;
    this.playerBets = new Map();
  }

  /**
   * 获取玩家本轮总下注
   */
  getPlayerTotalBet(playerId: string): number {
    return this.playerBets.get(playerId) || 0;
  }

  /**
   * 记录玩家动作
   */
  recordAction(playerId: string, action: PlayerAction, amount?: number): void {
    this.actions.push({
      playerId,
      action,
      amount,
      timestamp: new Date()
    });

    // 更新当前下注额
    if ((action === 'raise' || action === 'all_in') && amount) {
      this.currentBet = amount;
    }
  }

  /**
   * 向当前底池添加筹码
   * @param amount 金额
   * @param playerId 玩家ID
   */
  addToPot(amount: number, playerId: string): void {
    // 校验金额
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('INVALID_POT_AMOUNT');
    }
    
    const pot = this.pots[this.currentPotIndex];
    pot.amount += amount;
    
    // 更新玩家本轮总下注
    const currentBet = this.playerBets.get(playerId) || 0;
    this.playerBets.set(playerId, currentBet + amount);
    
    // 添加到有资格玩家列表
    if (!pot.eligiblePlayers.includes(playerId)) {
      pot.eligiblePlayers.push(playerId);
    }
  }

  /**
   * 创建边池
   * 当玩家全押时调用，将超出全押金额的筹码拆分到边池
   * 
   * 算法：
   * 1. 计算全押玩家 totalBet
   * 2. 对于每个已有底池，计算哪些玩家超出了全押金额
   * 3. 创建边池包含超出部分
   * 4. 主池限制为全押金额
   * 
   * @param allInPlayerId - 全押玩家ID
   * @param allInAmount - 全押金额（该玩家本轮总投入）
   */
  createSidePot(allInPlayerId: string, allInAmount: number): void {
    // 找到全押玩家在各池中的最小投入
    // 这将决定主池的大小
    
    // 创建一个新边池来存储超出部分
    const newPots: Pot[] = [];
    const mainPot = { ...this.pots[this.currentPotIndex] };
    
    // 计算需要创建多少个边池
    // 按玩家投入金额排序，确定边池层级
    const betAmounts: Array<{ playerId: string; bet: number }> = [];
    for (const [playerId, bet] of this.playerBets) {
      betAmounts.push({ playerId, bet });
    }
    betAmounts.sort((a, b) => a.bet - b.bet);
    
    // 如果全押玩家不是最小投入，需要创建边池
    if (betAmounts.length > 1 && betAmounts[0].playerId !== allInPlayerId) {
      // 全押玩家投入最少，只能参与主池
      const minBet = betAmounts[0].bet; // 全押玩家的投入
      
      // 主池金额 = minBet * 有资格玩家数
      // 但我们已经有了当前底池的数据
    }
    
    // 简化实现：如果有玩家全押，重新计算各池
    // 找到最小投入
    let minBet = allInAmount;
    for (const bet of this.playerBets.values()) {
      if (bet < minBet) minBet = bet;
    }
    
    // 主池 = minBet * 参与玩家数
    const eligiblePlayers = this.pots[this.currentPotIndex].eligiblePlayers;
    const mainPoolAmount = minBet * eligiblePlayers.length;
    
    // 计算超出部分
    let extraAmount = 0;
    for (const [playerId, bet] of this.playerBets) {
      if (bet > minBet) {
        extraAmount += bet - minBet;
      }
    }
    
    // 更新主池
    mainPot.amount = mainPoolAmount;
    mainPot.allInAmount = minBet;
    newPots.push(mainPot);
    
    // 如果有超出部分，创建边池
    if (extraAmount > 0) {
      const sidePot: Pot = {
        id: this.pots.length + 1,
        amount: extraAmount,
        eligiblePlayers: [],
        allInAmount: minBet
      };
      
      // 边池的有资格玩家：投入超过 minBet 的玩家
      for (const [playerId, bet] of this.playerBets) {
        if (bet > minBet) {
          sidePot.eligiblePlayers.push(playerId);
        }
      }
      
      newPots.push(sidePot);
    }
    
    this.pots = newPots;
    this.currentPotIndex = 0;
  }

  /**
   * 获取当前需要跟注的金额
   */
  getCurrentBet(): number {
    return this.currentBet;
  }

  /**
   * 获取当前总底池（所有池的总和）
   */
  getTotalPot(): number {
    return this.pots.reduce((sum, pot) => sum + pot.amount, 0);
  }

  /**
   * 获取所有底池
   */
  getPots(): Pot[] {
    return [...this.pots];
  }

  /**
   * 获取动作历史
   */
  getActions(): BettingAction[] {
    return [...this.actions];
  }

  /**
   * 检查是否所有玩家都已行动
   * @param activePlayers - 活跃玩家ID列表（已排除弃牌和全押的玩家）
   */
  isRoundComplete(activePlayers: string[]): boolean {
    if (this.actions.length === 0) return false;
    if (activePlayers.length === 0) return true;

    // 找出还需要行动的玩家
    const playersToAct = new Set<string>(activePlayers);
    
    for (const action of this.actions) {
      if (action.action === 'fold') {
        playersToAct.delete(action.playerId);
      } else if (action.action === 'call' || action.action === 'check') {
        playersToAct.delete(action.playerId);
      } else if (action.action === 'raise') {
        // 加注后，所有还活跃的玩家都需要重新行动
        playersToAct.delete(action.playerId);
        // 检查其他活跃玩家是否都已行动（相对于新的加注额）
        // 实际上，如果有人加注，所有人（除加注者外）都需要再行动一次
      } else if (action.action === 'all_in') {
        // 全押玩家已完成行动
        playersToAct.delete(action.playerId);
      }
    }
    
    // 如果还有人需要行动，没完成
    if (playersToAct.size > 0) return false;
    
    // 进一步检查：所有人都达到了当前下注额
    for (const playerId of activePlayers) {
      const playerTotalBet = this.getPlayerTotalBet(playerId);
      // 如果玩家没有达到当前下注额（且不是全押），没完成
      // 但全押玩家已经完成
      const isAllIn = this.actions.some(
        a => a.playerId === playerId && a.action === 'all_in'
      );
      if (!isAllIn && playerTotalBet < this.currentBet) {
        return false;
      }
    }

    return true;
  }

  /**
   * 计算玩家当前轮次已下注总额
   */
  getPlayerBetInRound(playerId: string): number {
    return this.getPlayerTotalBet(playerId);
  }

  /**
   * 重置轮次
   */
  reset(): void {
    this.actions = [];
    this.currentBet = 0;
    this.playerBets = new Map();
    // 保留 pots 但重置金额
    for (const pot of this.pots) {
      pot.amount = 0;
      pot.eligiblePlayers = [];
    }
    this.currentPotIndex = 0;
  }
}
