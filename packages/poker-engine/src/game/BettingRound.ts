/**
 * 下注轮次管理
 * @module game/BettingRound
 * @author ARCH
 * @date 2026-03-26
 * @task BE-001
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

  constructor() {
    this.actions = [];
    this.currentBet = 0;
    this.pots = [{ id: 1, amount: 0, eligiblePlayers: [] }];
    this.currentPotIndex = 0;
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
    if (action === 'raise' && amount) {
      this.currentBet = amount;
    }
  }

  /**
   * 向底池添加筹码
   */
  addToPot(amount: number, playerId: string): void {
    // 校验金额
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('INVALID_POT_AMOUNT');
    }
    
    const pot = this.pots[this.currentPotIndex];
    pot.amount += amount;
    
    if (!pot.eligiblePlayers.includes(playerId)) {
      pot.eligiblePlayers.push(playerId);
    }
  }

  /**
   * 创建边池
   * 当玩家全押时调用，将超出全押金额的筹码拆分到边池
   * @param allInPlayerId - 全押玩家ID
   * @param allInAmount - 全押金额（该玩家投入的总额）
   */
  createSidePot(allInPlayerId: string, allInAmount: number): void {
    const currentPot = this.pots[this.currentPotIndex];
    
    // 计算所有玩家在本轮中的总投入
    const playerBets = new Map<string, number>();
    for (const action of this.actions) {
      if (action.action === 'raise' || action.action === 'call' || action.action === 'all_in') {
        const current = playerBets.get(action.playerId) || 0;
        playerBets.set(action.playerId, current + (action.amount || 0));
      }
    }
    
    // 计算哪些玩家超过了全押金额
    const overAllInPlayers: string[] = [];
    let sidePotAmount = 0;
    
    for (const [playerId, bet] of playerBets) {
      if (playerId !== allInPlayerId && bet > allInAmount) {
        overAllInPlayers.push(playerId);
        sidePotAmount += bet - allInAmount;
      }
    }
    
    // 如果没有玩家超出全押金额，不需要创建边池
    if (sidePotAmount === 0) {
      return;
    }
    
    // 主池：只包含全押玩家
    currentPot.eligiblePlayers = currentPot.eligiblePlayers.filter(id => id === allInPlayerId);
    
    // 创建边池：超出全押金额的部分由其他玩家争夺
    const sidePot: Pot = {
      id: this.pots.length + 1,
      amount: sidePotAmount,
      eligiblePlayers: overAllInPlayers  // 不包含全押玩家
    };
    
    this.pots.push(sidePot);
    // 注意：不改变 currentPotIndex，主池仍在索引0，边池在索引1+
  }

  /**
   * 获取当前需要跟注的金额
   */
  getCurrentBet(): number {
    return this.currentBet;
  }

  /**
   * 获取当前总底池
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

    // 找出还需要行动的玩家
    let playersToAct = new Set(activePlayers);
    
    for (const action of this.actions) {
      if (action.action === 'fold') {
        playersToAct.delete(action.playerId);
      } else if (action.action === 'call' || action.action === 'check') {
        playersToAct.delete(action.playerId);
      } else if (action.action === 'raise') {
        // 加注后，所有玩家都需要重新行动
        // 但加注者本人已完成行动
        playersToAct = new Set(activePlayers);
        
        // 移除加注者和弃牌玩家
        playersToAct.delete(action.playerId);
        for (const playerId of playersToAct) {
          if (this.actions.some(a => a.playerId === playerId && a.action === 'fold')) {
            playersToAct.delete(playerId);
          }
        }
        
        // 移除弃牌的玩家
        for (const playerId of playersToAct) {
          if (this.actions.some(a => a.playerId === playerId && a.action === 'fold')) {
            playersToAct.delete(playerId);
          }
        }
      } else if (action.action === 'all_in') {
        // 全押玩家已完成行动
        playersToAct.delete(action.playerId);
      }
    }

    return playersToAct.size === 0;
  }

  /**
   * 计算玩家当前轮次已下注总额
   */
  getPlayerBetInRound(playerId: string): number {
    return this.actions
      .filter(a => a.playerId === playerId && (a.action === 'raise' || a.action === 'call' || a.action === 'all_in'))
      .reduce((sum, a) => sum + (a.amount || 0), 0);
  }

  /**
   * 重置轮次
   */
  reset(): void {
    this.actions = [];
    this.currentBet = 0;
  }
}
