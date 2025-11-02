/**
 * IndexedDB 工具库 - 用于离线存储比分数据
 */

const DB_NAME = 'CourtManagerDB'
const DB_VERSION = 1
const SCORE_STORE = 'scores'
const PENDING_SYNC_STORE = 'pendingSync'

export interface ScoreData {
  id?: number
  matchId: number
  courtId: number
  scoreA: number
  scoreB: number
  scoreHistory: any[]
  gameSettings: any
  timestamp: number
  synced: boolean
}

export interface PendingSyncData {
  id?: number
  matchId: number
  data: any
  timestamp: number
  retries: number
}

class CourtDB {
  private db: IDBDatabase | null = null

  /**
   * 初始化数据库
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('IndexedDB is not available in this environment'))
        return
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // 创建比分存储表
        if (!db.objectStoreNames.contains(SCORE_STORE)) {
          const scoreStore = db.createObjectStore(SCORE_STORE, {
            keyPath: 'id',
            autoIncrement: true
          })
          scoreStore.createIndex('matchId', 'matchId', { unique: false })
          scoreStore.createIndex('synced', 'synced', { unique: false })
          scoreStore.createIndex('timestamp', 'timestamp', { unique: false })
        }

        // 创建待同步队列表
        if (!db.objectStoreNames.contains(PENDING_SYNC_STORE)) {
          const syncStore = db.createObjectStore(PENDING_SYNC_STORE, {
            keyPath: 'id',
            autoIncrement: true
          })
          syncStore.createIndex('matchId', 'matchId', { unique: false })
          syncStore.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
    })
  }

  /**
   * 保存比分到本地
   */
  async saveScore(scoreData: ScoreData): Promise<number> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([SCORE_STORE], 'readwrite')
      const store = transaction.objectStore(SCORE_STORE)
      
      const request = store.add(scoreData)

      request.onsuccess = () => {
        resolve(request.result as number)
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  /**
   * 更新比分
   */
  async updateScore(id: number, scoreData: Partial<ScoreData>): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([SCORE_STORE], 'readwrite')
      const store = transaction.objectStore(SCORE_STORE)
      
      const getRequest = store.get(id)

      getRequest.onsuccess = () => {
        const data = getRequest.result
        if (data) {
          const updatedData = { ...data, ...scoreData }
          const updateRequest = store.put(updatedData)
          
          updateRequest.onsuccess = () => resolve()
          updateRequest.onerror = () => reject(updateRequest.error)
        } else {
          reject(new Error('Score data not found'))
        }
      }

      getRequest.onerror = () => {
        reject(getRequest.error)
      }
    })
  }

  /**
   * 获取最新的比分数据
   */
  async getLatestScore(matchId: number): Promise<ScoreData | null> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([SCORE_STORE], 'readonly')
      const store = transaction.objectStore(SCORE_STORE)
      const index = store.index('matchId')
      
      const request = index.getAll(IDBKeyRange.only(matchId))

      request.onsuccess = () => {
        const results = request.result as ScoreData[]
        if (results.length > 0) {
          // 返回最新的数据
          const latest = results.reduce((prev, current) => 
            current.timestamp > prev.timestamp ? current : prev
          )
          resolve(latest)
        } else {
          resolve(null)
        }
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  /**
   * 添加到待同步队列
   */
  async addToPendingSync(syncData: PendingSyncData): Promise<number> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PENDING_SYNC_STORE], 'readwrite')
      const store = transaction.objectStore(PENDING_SYNC_STORE)
      
      const request = store.add(syncData)

      request.onsuccess = () => {
        resolve(request.result as number)
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  /**
   * 获取所有待同步的数据
   */
  async getAllPendingSync(): Promise<PendingSyncData[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PENDING_SYNC_STORE], 'readonly')
      const store = transaction.objectStore(PENDING_SYNC_STORE)
      
      const request = store.getAll()

      request.onsuccess = () => {
        resolve(request.result as PendingSyncData[])
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  /**
   * 删除待同步数据
   */
  async removePendingSync(id: number): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PENDING_SYNC_STORE], 'readwrite')
      const store = transaction.objectStore(PENDING_SYNC_STORE)
      
      const request = store.delete(id)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  /**
   * 更新待同步数据的重试次数
   */
  async updatePendingSyncRetries(id: number, retries: number): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PENDING_SYNC_STORE], 'readwrite')
      const store = transaction.objectStore(PENDING_SYNC_STORE)
      
      const getRequest = store.get(id)

      getRequest.onsuccess = () => {
        const data = getRequest.result
        if (data) {
          data.retries = retries
          const updateRequest = store.put(data)
          
          updateRequest.onsuccess = () => resolve()
          updateRequest.onerror = () => reject(updateRequest.error)
        } else {
          reject(new Error('Pending sync data not found'))
        }
      }

      getRequest.onerror = () => {
        reject(getRequest.error)
      }
    })
  }

  /**
   * 清空所有未同步的比分数据
   */
  async clearUnsyncedScores(): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([SCORE_STORE], 'readwrite')
      const store = transaction.objectStore(SCORE_STORE)
      const index = store.index('synced')
      
      const request = index.openCursor(IDBKeyRange.only(false))

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          resolve()
        }
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }
}

// 单例模式
let dbInstance: CourtDB | null = null

export const getDB = (): CourtDB => {
  if (!dbInstance) {
    dbInstance = new CourtDB()
  }
  return dbInstance
}

export default CourtDB
