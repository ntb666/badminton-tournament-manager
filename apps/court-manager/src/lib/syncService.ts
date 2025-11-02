/**
 * 离线同步服务 - 处理网络恢复后的数据同步
 */

import { getDB, PendingSyncData } from './db'

const MAX_RETRIES = 3
const SYNC_INTERVAL = 5000 // 5秒检查一次

export class SyncService {
  private syncTimer: NodeJS.Timeout | null = null
  private isSyncing: boolean = false
  private onSyncStatusChange?: (status: 'syncing' | 'idle' | 'error', message?: string) => void

  constructor(onSyncStatusChange?: (status: 'syncing' | 'idle' | 'error', message?: string) => void) {
    this.onSyncStatusChange = onSyncStatusChange
  }

  /**
   * 启动自动同步
   */
  start() {
    if (this.syncTimer) {
      return
    }

    // 立即执行一次同步
    this.syncPendingData()

    // 定期检查并同步
    this.syncTimer = setInterval(() => {
      this.syncPendingData()
    }, SYNC_INTERVAL)

    console.log('Sync service started')
  }

  /**
   * 停止自动同步
   */
  stop() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
      console.log('Sync service stopped')
    }
  }

  /**
   * 同步待上传的数据
   */
  async syncPendingData() {
    if (this.isSyncing) {
      return
    }

    // 检查网络连接
    if (!navigator.onLine) {
      console.log('Offline, skipping sync')
      return
    }

    this.isSyncing = true
    this.onSyncStatusChange?.('syncing')

    try {
      const db = getDB()
      const pendingData = await db.getAllPendingSync()

      if (pendingData.length === 0) {
        this.onSyncStatusChange?.('idle')
        this.isSyncing = false
        return
      }

      console.log(`Found ${pendingData.length} pending sync items`)

      // 逐个同步数据
      for (const item of pendingData) {
        try {
          await this.syncSingleItem(item)
          // 同步成功，删除待同步记录
          await db.removePendingSync(item.id!)
          console.log(`Synced item ${item.id} successfully`)
        } catch (error) {
          console.error(`Failed to sync item ${item.id}:`, error)
          
          // 增加重试次数
          const newRetries = item.retries + 1
          
          if (newRetries >= MAX_RETRIES) {
            // 达到最大重试次数，删除该记录并记录错误
            console.error(`Max retries reached for item ${item.id}, removing from queue`)
            await db.removePendingSync(item.id!)
            this.onSyncStatusChange?.('error', `同步失败: ${error}`)
          } else {
            // 更新重试次数
            await db.updatePendingSyncRetries(item.id!, newRetries)
          }
        }
      }

      this.onSyncStatusChange?.('idle', '同步完成')
    } catch (error) {
      console.error('Sync error:', error)
      this.onSyncStatusChange?.('error', `同步错误: ${error}`)
    } finally {
      this.isSyncing = false
    }
  }

  /**
   * 同步单个数据项
   */
  private async syncSingleItem(item: PendingSyncData): Promise<void> {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://100.74.143.98:4001'
    
    const response = await fetch(`${API_BASE_URL}/api/matches/${item.matchId}/score`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(item.data),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
  }

  /**
   * 手动触发同步
   */
  async triggerSync() {
    await this.syncPendingData()
  }
}

// 网络状态监听Hook
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = React.useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

// 导出React依赖
import React from 'react'
