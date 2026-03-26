/**
 * Socket.io 客户端
 * @module services/socket
 * @author ARCH
 * @date 2026-03-26
 * @task FE-001
 */

import { io, Socket } from 'socket.io-client'
import { useAuthStore, useGameStore } from '../store'

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000'

class SocketService {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private currentRoomId: string | null = null
  private currentGameId: string | null = null
  private gameStateVersion = 0  // 用于版本校验

  /**
   * 连接 WebSocket
   */
  connect() {
    // 防止重复连接
    if (this.socket?.connected) {
      console.log('Already connected')
      return
    }

    // 断开旧连接
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }

    const token = useAuthStore.getState().accessToken
    
    if (!token) {
      console.error('No access token available')
      return
    }
    
    this.socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
    })
    
    this.setupListeners()
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.reconnectAttempts = 0
      this.currentRoomId = null
      this.currentGameId = null
    }
  }
  
  /**
   * 重新连接（用于 token 刷新后）
   */
  reconnect(newToken: string) {
    console.log('Reconnecting with new token...')
    
    // 保存当前房间/游戏信息用于恢复
    const roomId = this.currentRoomId
    const gameId = this.currentGameId
    
    // 断开旧连接
    this.disconnect()
    
    // 更新 token
    useAuthStore.getState().login(
      useAuthStore.getState().user!,
      newToken,
      useAuthStore.getState().refreshToken!
    )
    
    // 重新连接
    this.connect()
    
    // 恢复房间/游戏订阅
    if (roomId) {
      setTimeout(() => this.joinRoom(roomId!), 1000)
    }
  }
  
  /**
   * 加入房间（用于重连后恢复）
   */
  joinRoom(roomId: string) {
    this.currentRoomId = roomId
    this.socket?.emit('join_room', { roomId })
  }
  
  /**
   * 离开房间
   */
  leaveRoom(roomId: string) {
    this.socket?.emit('leave_room', { roomId })
    if (this.currentRoomId === roomId) {
      this.currentRoomId = null
    }
  }

  private setupListeners() {
    // 空值检查防止竞争条件
    if (!this.socket) {
      console.warn('setupListeners called but socket is null')
      return
    }

    // 连接成功
    this.socket.on('connect', () => {
      console.log('Connected to server')
      useAuthStore.getState().isAuthenticated && 
        useAuthStore.getState().setIsConnected?.(true)
      this.reconnectAttempts = 0
      
      // 重连后恢复房间订阅
      if (this.currentRoomId) {
        this.joinRoom(this.currentRoomId)
      }
    })

    // 断开连接
    this.socket.on('disconnect', () => {
      console.log('Disconnected from server')
      useAuthStore.getState().setIsConnected?.(false)
    })

    // 连接错误
    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error)
      this.reconnectAttempts++
      
      // 检测是否是认证错误
      if (error.message?.includes('Authentication') || error.message?.includes('401')) {
        console.error('Token expired, need to refresh')
        // 触发 token 刷新（需要调用方实现）
        window.dispatchEvent(new CustomEvent('socket:auth_error'))
      }
    })

    // 认证成功
    this.socket.on('auth_success', (data) => {
      console.log('Auth success:', data)
    })

    // 房间创建成功
    this.socket.on('room_created', (data) => {
      this.currentRoomId = data.room?.id
      useAuthStore.getState().setCurrentRoom?.(data.room)
    })

    // 加入房间成功
    this.socket.on('room_joined', (data) => {
      console.log('Joined room:', data)
      this.currentRoomId = data.roomId
    })

    // 游戏开始
    this.socket.on('game_started', (data) => {
      this.currentGameId = data.gameId
      useAuthStore.getState().setCurrentGame?.(data.game)
    })

    // 游戏状态更新 - 带版本校验防止旧状态覆盖新状态
    this.socket.on('game_state_update', (data) => {
      const newVersion = data.version || 0
      
      // 如果收到旧版本，忽略
      if (newVersion <= this.gameStateVersion && this.gameStateVersion > 0) {
        console.warn('Ignoring old game state update', { old: this.gameStateVersion, new: newVersion })
        return
      }
      
      this.gameStateVersion = newVersion
      useAuthStore.getState().setGameState?.(data.state)
    })

    // 玩家加入
    this.socket.on('player_joined', (data) => {
      console.log('Player joined:', data)
    })

    // 玩家离开
    this.socket.on('player_left', (data) => {
      console.log('Player left:', data)
    })

    // 轮到你了
    this.socket.on('your_turn', (data) => {
      console.log('Your turn! Timeout:', data.timeout)
      // 更新游戏状态中的回合信息
      useGameStore.getState().setMyTurn(true, data.timeout)
      window.dispatchEvent(new CustomEvent('socket:your_turn', { detail: data }))
    })

    // 聊天消息
    this.socket.on('chat_message', (data) => {
      console.log('Chat:', data)
      window.dispatchEvent(new CustomEvent('socket:chat_message', { detail: data }))
    })

    // 玩家断线
    this.socket.on('player_disconnected', (data) => {
      console.log('Player disconnected:', data)
    })

    // 玩家重连
    this.socket.on('player_reconnected', (data) => {
      console.log('Player reconnected:', data)
    })

    // 错误
    this.socket.on('error', (data) => {
      console.error('Socket error:', data)
      window.dispatchEvent(new CustomEvent('socket:error', { detail: data }))
    })
  }
  
  // 发送事件
  createRoom(data: {
    name: string
    maxPlayers: number
    smallBlind: number
    bigBlind: number
    minBuyIn: number
    maxBuyIn: number
  }) {
    this.socket?.emit('create_room', data)
  }
  
  joinRoomByCode(roomCode: string, password?: string) {
    this.socket?.emit('join_room', { roomCode, password })
  }
  
  ready(roomId: string) {
    this.socket?.emit('ready', { roomId })
  }
  
  /**
   * 发送玩家动作
   * @param gameId 游戏ID
   * @param action 动作类型
   * @param amount 金额（加注时需要）
   * @param callback 确认回调
   */
  playerAction(
    gameId: string, 
    action: string, 
    amount?: number,
    callback?: (error?: string) => void
  ) {
    // 本地校验 action
    const validActions = ['fold', 'check', 'call', 'raise', 'all_in']
    if (!validActions.includes(action)) {
      console.error('Invalid action:', action)
      callback?.('Invalid action')
      return
    }
    
    // 本地校验 amount
    if (action === 'raise' && (!amount || amount <= 0)) {
      console.error('Raise requires positive amount')
      callback?.('Invalid amount')
      return
    }
    
    // 发送动作，使用 ack 回调确认
    this.socket?.emit('player_action', { gameId, action, amount }, (response: any) => {
      if (response.error) {
        console.error('Action error:', response.error)
        callback?.(response.error)
      } else {
        callback?.()
      }
    })
  }
  
  sendMessage(roomId: string, message: string) {
    // 限制消息长度
    const safeMessage = message.slice(0, 500)
    this.socket?.emit('send_message', { roomId, message: safeMessage })
  }
  
  leaveCurrentRoom() {
    if (this.currentRoomId) {
      this.leaveRoom(this.currentRoomId)
    }
  }
}

export const socketService = new SocketService()
