'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Users, Trophy, Clock, CheckCircle, Play } from 'lucide-react'
import io from 'socket.io-client'
import styles from './TournamentBracket.module.css'

interface Team {
  id: number
  name: string
  players: string
  type: string
  seedNumber?: number  // 种子选手序号，可选字段
}

interface Court {
  id: number
  name: string
}

interface Match {
  id: number
  matchType: string
  round: number
  teamAId: number
  teamBId: number
  courtId: number
  parentId?: number
  scoreA: number
  scoreB: number
  status: 'pending' | 'scheduled' | 'playing' | 'completed'
  winnerId?: number
  scoreHistory: string
  gameSettings: string
  teamA: Team
  teamB: Team
  court: Court
  children: any[]
  isBronzeMatch?: boolean  // 是否为铜牌赛
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <CheckCircle size={16} />
    case 'playing':
      return <Play size={16} />
    case 'scheduled':
      return <Clock size={16} />
    default:
      return <Clock size={16} />
  }
}

// 获取队员名字组合显示
const getTeamDisplayName = (team: Team | null | undefined): string => {
  if (!team) return '待定'
  
  let displayName = ''
  
  // 优先显示队员名字组合
  if (team.players) {
    const players = team.players.split(/[,，、]/).map(p => p.trim()).filter(p => p)
    if (players.length >= 2) {
      displayName = `${players[0]}/${players[1]}`
    } else if (players.length === 1) {
      displayName = players[0]
    }
  }
  
  // 如果没有队员信息，fallback到队伍名称
  if (!displayName) {
    displayName = team.name || '待定'
  }
  
  // 如果是种子选手，添加种子序号
  if (team.seedNumber) {
    displayName += `[${team.seedNumber}]`
  }
  
  return displayName
}

const getStatusText = (status: string) => {
  switch (status) {
    case 'completed':
      return '已完成'
    case 'playing':
      return '进行中'
    case 'scheduled':
      return '待开始'
    default:
      return '待开始'
  }
}

// 确定当前发球方（根据羽毛球规则：获得上一分的队伍发球）
const getCurrentServer = (match: Match) => {
  if (!match || !match.scoreHistory) return null;
  
  try {
    const scoreHistory = typeof match.scoreHistory === 'string' 
      ? JSON.parse(match.scoreHistory) 
      : match.scoreHistory;
    
    if (!scoreHistory || scoreHistory.length === 0) return null;
    
    // 获取当前进行的局
    const currentSet = scoreHistory[scoreHistory.length - 1];
    if (!currentSet || !currentSet.pointHistory || currentSet.pointHistory.length === 0) {
      // 如果没有得分记录，默认A队发球
      return 'A';
    }
    
    // 获取最后一分的得分者
    const lastPoint = currentSet.pointHistory[currentSet.pointHistory.length - 1];
    return lastPoint.scorer; // 'A' 或 'B'
  } catch (error) {
    console.error('Error parsing score history:', error);
    return null;
  }
};

// 格式化比分显示（显示每局详细比分）
const formatMatchScore = (match: Match) => {
  if (!match.scoreHistory) {
    // 如果没有比分历史，显示0-0
    return {
      setsWonA: 0,
      setsWonB: 0,
      displayScoreA: 0,
      displayScoreB: 0,
      sets: []
    };
  }

  try {
    const scoreHistory = typeof match.scoreHistory === 'string' 
      ? JSON.parse(match.scoreHistory) 
      : match.scoreHistory;
    
    if (!scoreHistory || scoreHistory.length === 0) {
      return {
        setsWonA: 0,
        setsWonB: 0,
        displayScoreA: 0,
        displayScoreB: 0,
        sets: []
      };
    }

    let setsWonA = 0;
    let setsWonB = 0;
    const sets: any[] = [];
    
    // 从 gameSettings 获取设置，或使用默认值
    let pointsPerSet = 21;
    let deuceDiff = 2;
    
    if (match.gameSettings) {
      try {
        const gameSettings = typeof match.gameSettings === 'string' 
          ? JSON.parse(match.gameSettings) 
          : match.gameSettings;
        pointsPerSet = gameSettings.pointsPerSet || 21;
        deuceDiff = gameSettings.deuceDiff || 2;
      } catch (e) {
        console.error('Error parsing game settings:', e);
      }
    }
    
    // 处理每局比分
    scoreHistory.forEach((set: any) => {
      const setData = {
        scoreA: set.scoreA,
        scoreB: set.scoreB,
        winnerA: false,
        winnerB: false
      };
      
      // 判断这一局的获胜者
      if (set.scoreA >= pointsPerSet && set.scoreA - set.scoreB >= deuceDiff) {
        setsWonA++;
        setData.winnerA = true;
      } else if (set.scoreB >= pointsPerSet && set.scoreB - set.scoreA >= deuceDiff) {
        setsWonB++;
        setData.winnerB = true;
      }
      
      sets.push(setData);
    });

    return {
      setsWonA,
      setsWonB,
      displayScoreA: setsWonA,
      displayScoreB: setsWonB,
      sets
    };
  } catch (error) {
    console.error('Error parsing score history:', error);
    return {
      setsWonA: 0,
      setsWonB: 0,
      displayScoreA: 0,
      displayScoreB: 0,
      sets: []
    };
  }
};

// 计算比赛位置的纯函数 - 移到组件外部避免重复定义
const calculatePositions = (groupedMatches: Match[][]) => {
  const positions: Record<string, [number, boolean]> = {} // key: round-{roundIndex}-match-{matchId}, value: [topPosition, isLong]
  const cardHeight = 140 // 增加卡片高度从120到140
  const uniformSpacing = 50 // 增加前两轮统一间距从30到50
  
  console.log('=== 开始计算对齐位置 ===')
  console.log('分组比赛数据:', groupedMatches.map((round, index) => ({
    roundIndex: index,
    matchCount: round.length,
    matches: round.map(m => ({ id: m.id, parentId: m.parentId, isBronzeMatch: m.isBronzeMatch }))
  })))
  
  // 先找出第二轮中待定的比赛
  const secondRoundOnePendingMatches: Match[] = []
  const secondRoundBothPendingMatches: Match[] = []

  if (groupedMatches[1]) {
    groupedMatches[1].forEach(match => {
      const teamADisplayName = getTeamDisplayName(match.teamA);
      const teamBDisplayName = getTeamDisplayName(match.teamB);
      if (teamADisplayName === '待定' && teamBDisplayName === '待定') {
        secondRoundBothPendingMatches.push(match);
      } else if (teamADisplayName === '待定' || teamBDisplayName === '待定') {
        secondRoundOnePendingMatches.push(match);
      }
    });
  }

  console.log('🔍 第二轮中有待定队伍的比赛:', secondRoundOnePendingMatches.map(m => ({
    id: m.id,
    teamA: getTeamDisplayName(m.teamA),
    teamB: getTeamDisplayName(m.teamB)
  })));
  
  // 获取第一轮中将要显示的比赛, 并区分对应第二轮待定比赛的类型
  const firstRoundVisibleMatches: Match[] = []
  if (groupedMatches[0]) {
    groupedMatches[0].forEach(match => {
      const teamADisplayName = getTeamDisplayName(match.teamA);
      const teamBDisplayName = getTeamDisplayName(match.teamB);
      if (teamADisplayName !== '待定' && teamBDisplayName !== '待定') {
        firstRoundVisibleMatches.push(match);
      }
    });
  }
  
  console.log('🔍 第一轮中将要显示的比赛:', firstRoundVisibleMatches.map(m => ({
    id: m.id,
    teamA: getTeamDisplayName(m.teamA),
    teamB: getTeamDisplayName(m.teamB)
  })));
  
  let isFirstShortFlag = true; // 用于第一轮短比赛的交替位置计算

  // 为每一轮计算位置
  groupedMatches.forEach((round, roundIndex) => {
    // 分离铜牌赛和常规比赛
    const regularMatches = round.filter(match => !match.isBronzeMatch)
    const bronzeMatches = round.filter(match => match.isBronzeMatch)
    
    // 先处理常规比赛
    regularMatches.forEach((match, matchIndex) => {
      if (roundIndex === 0) {
        // 第一轮：特殊处理，与第二轮中有待定队伍的比赛对齐
        const teamADisplayName = getTeamDisplayName(match.teamA);
        const teamBDisplayName = getTeamDisplayName(match.teamB);
        
        // 只为可见的比赛（双方都不是待定）计算位置
        if (teamADisplayName !== '待定' && teamBDisplayName !== '待定') {
          const visibleIndex = firstRoundVisibleMatches.findIndex(m => m.id === match.id);
          if (visibleIndex >= 0) { // 第一轮有可见比赛
            const parentMatch = groupedMatches[1]?.find(m => m.id === match.parentId);
            if (parentMatch) {
              if (secondRoundOnePendingMatches.some(m => m.id === parentMatch.id)) {
                // 父比赛在 secondRoundOnePendingMatches 中
                // 画图逻辑A：与第二轮有一方待定的比赛直接对齐
                const parentIndex = groupedMatches[1].findIndex(m => m.id === parentMatch.id);
                const parentPosition = parentIndex * (cardHeight + uniformSpacing);
                positions[`round-${roundIndex}-match-${match.id}`] = [parentPosition, true];
                console.log(`✓ 第一轮比赛 ${match.id} 与第二轮一方待定比赛 ${parentMatch.id} 对齐: ${parentPosition}px`);
              } else if (secondRoundBothPendingMatches.some(m => m.id === parentMatch.id)) {
                // 父比赛在 secondRoundBothPendingMatches 中
                // 画图逻辑B：与第二轮双方都待定的比赛对齐，这种比赛成对出现，需要将两成比赛都缩小一半高度，第一场放上半部分，第二场放下半部分
                const parentIndex = groupedMatches[1].findIndex(m => m.id === parentMatch.id);
                let offset = 0;
                if (isFirstShortFlag) {
                  isFirstShortFlag = false;
                }else {
                  offset = (cardHeight + uniformSpacing) / 2;
                  isFirstShortFlag = true;
                }
                const parentPosition = parentIndex * (cardHeight + uniformSpacing) + offset;
                positions[`round-${roundIndex}-match-${match.id}`] = [parentPosition, false];
                console.log(`✓ 第一轮比赛 ${match.id} 与第二轮双方待定比赛 ${parentMatch.id} 对齐: ${parentPosition}px`);
              } else {
                // 默认逻辑
                positions[`round-${roundIndex}-match-${match.id}`] = [visibleIndex * (cardHeight + uniformSpacing), true];
                console.log(`✓ 第一轮比赛 ${match.id} 使用常规间距: ${visibleIndex} -> ${positions[`round-${roundIndex}-match-${match.id}`]}px`);
              }
            } else {
              // 没有父比赛，使用常规间距
              positions[`round-${roundIndex}-match-${match.id}`] = [positions[`round-${roundIndex}-match-${0}`][0] + cardHeight + visibleIndex, false];
              console.log(`✓ 第一轮比赛 ${match.id} 无父比赛，使用常规间距: ${visibleIndex} -> ${positions[`round-${roundIndex}-match-${match.id}`]}px`);
            }
          }
        }
      } else if (roundIndex === 1) {
        // 第二轮：使用统一间距
        positions[`round-${roundIndex}-match-${match.id}`] = [matchIndex * (cardHeight + uniformSpacing), true]
        console.log(`✓ 第二轮比赛 ${match.id} 统一间距: ${matchIndex * (cardHeight + uniformSpacing)}px`)
      } else {
        // 第三轮及以后：基于前一轮相邻两场比赛对齐到中间位置
        const prevRound = groupedMatches[roundIndex - 1]
        const firstKidIndex = matchIndex * 2
        const secondKidIndex = matchIndex * 2 + 1
        
        if (firstKidIndex < prevRound.length && secondKidIndex < prevRound.length) {
          const firstKidMatch = prevRound[firstKidIndex]
          const secondKidMatch = prevRound[secondKidIndex]
          
          const firstKidPosition = positions[`round-${roundIndex - 1}-match-${firstKidMatch.id}`]
          const secondKidPosition = positions[`round-${roundIndex - 1}-match-${secondKidMatch.id}`]
          
          if (firstKidPosition && secondKidPosition) {
            const centerPosition = (firstKidPosition[0] + secondKidPosition[0] + cardHeight) / 2 - cardHeight / 2
            positions[`round-${roundIndex}-match-${match.id}`] = [centerPosition, true]
            console.log(`✓ 第${roundIndex + 1}轮比赛 ${match.id} 中间对齐: ${centerPosition}px`)
          } else {
            positions[`round-${roundIndex}-match-${match.id}`] = [matchIndex * (cardHeight + uniformSpacing * 2), true]
            console.log(`⚠ 第${roundIndex + 1}轮比赛 ${match.id} fallback位置: ${matchIndex * (cardHeight + uniformSpacing * 2)}px`)
          }
        } else {
          positions[`round-${roundIndex}-match-${match.id}`] = [matchIndex * (cardHeight + uniformSpacing * 2), true]
          console.log(`⚠ 第${roundIndex + 1}轮比赛 ${match.id} 默认位置: ${matchIndex * (cardHeight + uniformSpacing * 2)}px`)
        }
      }
    })
    
    // 处理铜牌赛：放在决赛正下方
    bronzeMatches.forEach((match, bronzeIndex) => {
      if (roundIndex === groupedMatches.length - 1) {
        // 找到决赛位置
        const finalMatch = regularMatches[0] // 决赛通常是该轮的第一场比赛
        if (finalMatch) {
          const finalPosition = positions[`round-${roundIndex}-match-${finalMatch.id}`]
          if (finalPosition) {
            // 铜牌赛放在决赛下方，增加额外间距
            const bronzePosition = finalPosition[0] + cardHeight + uniformSpacing + 30
            positions[`round-${roundIndex}-match-${match.id}`] = [bronzePosition, true]
            console.log(`🥉 铜牌赛 ${match.id} 位置: ${bronzePosition}px (决赛下方)`)
          }
        } else {
          // 如果没有决赛，使用默认位置
          positions[`round-${roundIndex}-match-${match.id}`] = [(bronzeIndex + 1) * (cardHeight + uniformSpacing * 2), true]
          console.log(`🥉 铜牌赛 ${match.id} 默认位置: ${(bronzeIndex + 1) * (cardHeight + uniformSpacing * 2)}px`)
        }
      }
    })
  })
  
  console.log('=== 最终位置映射 ===', positions)
  return positions
}

interface TournamentBracketProps {
  selectedType?: string
  onMatchSelect?: (match: Match) => void  // 新增：当比赛被选中时的回调函数
  clearSelection?: boolean  // 新增：用于清除选中状态
}

const TournamentBracket: React.FC<TournamentBracketProps> = ({ selectedType, onMatchSelect, clearSelection }) => {
  const [mounted, setMounted] = useState(false)
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)  // 新增：选中的比赛
  const [storedPositions, setStoredPositions] = useState<Record<string, [number, boolean]>>({}) // 存储位置信息

  // 处理比赛数据的函数
  const processMatchData = (matches: Match[], selectedType: string | undefined) => {
    // 根据selectedType过滤比赛并排序
    const filtered = matches
      .filter(match => {
        if (!selectedType) return true
        return match.matchType === selectedType
      })
      .sort((a, b) => {
        // 优先按轮次排序，然后按ID排序
        if (a.round !== b.round) {
          return a.round - b.round
        }
        return a.id - b.id
      })

    // 按轮次分组比赛
    const grouped = filtered.reduce((acc: Match[][], match) => {
      const roundIndex = match.round - 1
      if (!acc[roundIndex]) {
        acc[roundIndex] = []
      }
      acc[roundIndex].push(match)
      return acc
    }, [])

    // 确保每轮内的比赛也按ID排序
    grouped.forEach(round => {
      round.sort((a, b) => a.id - b.id)
    })

    return {
      filteredMatches: filtered,
      groupedMatches: grouped
    }
  }

  // 生成位置存储的键
  const getPositionStorageKey = (selectedType: string | undefined) => {
    return `tournament-positions-${selectedType || 'all'}`
  }

  // 计算并存储位置信息
  const calculateAndStorePositions = (groupedMatches: Match[][], selectedType: string | undefined) => {
    const storageKey = getPositionStorageKey(selectedType)
    
    // 首先检查是否已经有存储的位置
    const existingPositions = localStorage.getItem(storageKey)
    if (existingPositions) {
      try {
        const parsed = JSON.parse(existingPositions)
        setStoredPositions(parsed)
        console.log('✅ 从本地存储加载位置信息:', parsed)
        return parsed
      } catch (error) {
        console.error('解析存储位置信息失败:', error)
      }
    }

    // 如果没有存储的位置，计算新位置
    console.log('🔄 计算新的位置信息...')
    const newPositions = calculatePositions(groupedMatches)
    
    // 存储到 localStorage
    localStorage.setItem(storageKey, JSON.stringify(newPositions))
    setStoredPositions(newPositions)
    console.log('💾 位置信息已存储到本地:', newPositions)
    
    return newPositions
  }

  // 检查结构是否发生变化（只有结构变化才重新计算位置）
  const checkStructuralChanges = (matches: Match[], selectedType: string | undefined) => {
    const structuralKey = matches.map(m => `${m.id}-${m.round}-${m.parentId}-${m.matchType}`).join(',')
    const storageKey = `structural-${getPositionStorageKey(selectedType)}`
    const lastStructuralKey = localStorage.getItem(storageKey)
    
    if (lastStructuralKey !== structuralKey) {
      console.log('🔄 检测到结构变化，清除位置缓存')
      clearPositionCache()
      localStorage.setItem(storageKey, structuralKey)
    }
  }

  // 清除位置缓存的函数
  const clearPositionCache = () => {
    const storageKey = getPositionStorageKey(selectedType)
    localStorage.removeItem(storageKey)
    setStoredPositions({})
    console.log('🗑️ 位置缓存已清除')
  }

  // 使用 useMemo 缓存比赛数据处理，位置信息使用本地存储
  const { filteredMatches, groupedMatches } = useMemo(() => {
    if (matches.length === 0) {
      return {
        filteredMatches: [],
        groupedMatches: []
      }
    }

    console.log(`🔍 TournamentBracket 调试信息:`)
    console.log(`  - 总比赛数: ${matches.length}`)
    console.log(`  - 选择的类型: ${selectedType}`)

    const result = processMatchData(matches, selectedType)

    console.log(`  - 过滤后比赛数: ${result.filteredMatches.length}`)
    console.log(`  - 过滤后比赛详情:`, result.filteredMatches.map(m => ({
      id: m.id,
      round: m.round,
      matchType: m.matchType,
      parentId: m.parentId,
      teamA: m.teamA?.name,
      teamB: m.teamB?.name
    })))

    console.log(`📊 按轮次分组结果:`, result.groupedMatches.map((round, index) => ({
      roundIndex: index + 1,
      matchCount: round.length,
      matches: round.map(m => ({ id: m.id, parentId: m.parentId }))
    })))

    // 特别检查第一轮比赛
    if (result.groupedMatches[0]) {
      console.log(`🔍 第一轮比赛详细信息:`)
      result.groupedMatches[0].forEach((match, index) => {
        console.log(`  ${index + 1}. #${match.id}: ${match.teamA?.name || '待定'} vs ${match.teamB?.name || '待定'}`)
      })
    }

    // 如果没有存储的位置信息，计算并存储
    if (Object.keys(storedPositions).length === 0 && result.groupedMatches.length > 0) {
      calculateAndStorePositions(result.groupedMatches, selectedType)
    }

    return result
  }, [
    // 包含所有可能影响显示的数据，确保实时更新
    matches.map(m => 
      `${m.id}-${m.round}-${m.parentId}-${m.matchType}-${m.status}-${m.scoreA}-${m.scoreB}-${m.winnerId}-${m.teamA?.id}-${m.teamB?.id}-${m.teamA?.name}-${m.teamB?.name}`
    ).join(','),
    selectedType,
    storedPositions // 添加 storedPositions 依赖，确保位置变化时重新渲染
  ])

  // 获取比赛数据的函数
  const fetchMatches = async () => {
    try {
      const response = await fetch('http://localhost:4001/api/schedule/tree')
      const data = await response.json()
      
      // 处理API返回的数据结构
      if (data && typeof data === 'object') {
        let newMatches: Match[] = []
        if (Array.isArray(data)) {
          // 如果直接是数组，直接使用
          newMatches = data
          console.log('TournamentBracket: Fetched matches (array):', data.length)
        } else if (data.matches && Array.isArray(data.matches)) {
          // 如果是 {matches: [], teams: []} 结构，提取matches
          newMatches = data.matches
          console.log('TournamentBracket: Fetched matches (object):', data.matches.length)
        } else {
          console.warn('TournamentBracket: Unexpected data structure:', data)
          newMatches = []
        }
        
        // 检查结构变化
        checkStructuralChanges(newMatches, selectedType)
        setMatches(newMatches)
      } else {
        setMatches([])
      }
    } catch (error) {
      console.error('Error fetching matches:', error)
      setMatches([])
    }
  }

  useEffect(() => {
    setMounted(true)
    
    // 初始数据获取
    const initData = async () => {
      await fetchMatches()
      setLoading(false)
    }
    initData()
    
    // 设置Socket.IO连接
    const socket = io('http://localhost:4001')
    socket.emit('join-room', 'tournament-bracket')
    
    // 监听分数更新事件
    socket.on('score-updated', () => {
      console.log('Tournament bracket: Score updated, refreshing matches...')
      fetchMatches()
    })
    
    // 监听比赛分配事件
    socket.on('match-assigned', () => {
      console.log('Tournament bracket: Match assigned, refreshing matches...')
      setSelectedMatch(null)  // 清除选中状态
      fetchMatches()
    })
    
    // 监听赛程更新事件
    socket.on('scheduleUpdate', (data) => {
      console.log('Tournament bracket: Schedule updated:', data)
      fetchMatches()
    })
    
    // 监听批量比赛分配事件
    socket.on('bulk-matches-assigned', (data) => {
      console.log('Tournament bracket: Bulk matches assigned:', data)
      setSelectedMatch(null)  // 清除选中状态
      fetchMatches()
    })

    // 监听新比赛创建事件（晋级时）
    socket.on('match-created', (data) => {
      console.log('Tournament bracket: New match created:', data)
      fetchMatches()  // 刷新比赛数据，结构检查会自动处理位置缓存
    })

    // 监听比赛更新事件（晋级时更新现有比赛）
    socket.on('match-updated', (data) => {
      console.log('Tournament bracket: Match updated:', data)
      fetchMatches()  // 刷新比赛数据以显示更新的比赛
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  // 单独的 useEffect 监听 selectedType 变化，加载对应赛项的位置信息
  useEffect(() => {
    console.log(`🔄 赛项切换到: ${selectedType}，加载对应的位置信息...`)
    
    // 从 localStorage 加载当前赛项的位置信息
    const loadPositionsForCurrentType = () => {
      const storageKey = getPositionStorageKey(selectedType)
      const existingPositions = localStorage.getItem(storageKey)
      
      if (existingPositions) {
        try {
          const parsed = JSON.parse(existingPositions)
          setStoredPositions(parsed)
          console.log(`✅ 成功加载 ${selectedType} 的位置信息:`, Object.keys(parsed).length, '个位置')
        } catch (error) {
          console.error('解析存储位置信息失败:', error)
          setStoredPositions({})
        }
      } else {
        console.log(`📭 ${selectedType} 暂无位置缓存，等待计算...`)
        setStoredPositions({})
      }
    }
    
    loadPositionsForCurrentType()
  }, [selectedType]) // 当 selectedType 变化时重新加载位置信息

  // 处理比赛卡片点击
  const handleMatchClick = (match: Match) => {
    console.log('点击比赛:', {
      id: match.id,
      status: match.status,
      courtId: match.courtId,
      teamA: match.teamA,
      teamB: match.teamB
    });
    
    // 获取队伍显示名称（与界面显示保持一致）
    const teamADisplayName = getTeamDisplayName(match.teamA);
    const teamBDisplayName = getTeamDisplayName(match.teamB);
    
    // 检查比赛是否可以分配场地的条件：
    // 1. 比赛状态为pending或scheduled（待开始或已安排）
    // 2. 未分配场地（courtId为null或0）
    // 3. 双方选手都已确定（使用与显示一致的逻辑判断）
    const canAssign = (match.status === 'pending' || match.status === 'scheduled') && 
                     (!match.courtId || match.courtId === 0) &&
                     match.teamA && match.teamB && 
                     teamADisplayName !== '待定' && 
                     teamBDisplayName !== '待定' &&
                     teamADisplayName.trim() !== '' &&
                     teamBDisplayName.trim() !== '';
    
    console.log('是否可分配:', canAssign, {
      teamADisplayName,
      teamBDisplayName,
      teamAName: match.teamA?.name,
      teamBName: match.teamB?.name,
      teamAPlayers: match.teamA?.players,
      teamBPlayers: match.teamB?.players,
      status: match.status,
      courtId: match.courtId
    });
    
    if (canAssign) {
      setSelectedMatch(match)
      onMatchSelect && onMatchSelect(match)
      console.log('选中比赛:', match.id, '队伍:', teamADisplayName, 'vs', teamBDisplayName)
    } else {
      console.log('比赛不可分配:', {
        id: match.id,
        status: match.status,
        courtId: match.courtId,
        teamADisplayName,
        teamBDisplayName,
        reason: '选手未确定或已分配场地'
      })
    }
  }

  // 防止水合不匹配
  if (!mounted) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner}></div>
          <p>加载赛程数据中...</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner}></div>
          <p>加载赛程数据中...</p>
        </div>
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <Trophy className={styles.headerIcon} />
          <h2 className={styles.title}>锦标赛赛程</h2>
          <p className={styles.subtitle}>羽毛球双打比赛 - {selectedType || '未选择'}</p>
        </div>

        <div className={styles.noData}>
          <Trophy className={styles.noDataIcon} />
          <h3 className={styles.noDataText}>暂无比赛数据</h3>
          <p className={styles.noDataSubtext}>请先添加队伍和安排比赛</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Trophy className={styles.headerIcon} />
        <h2 className={styles.title}>锦标赛赛程</h2>
        <p className={styles.subtitle}>羽毛球双打比赛 - {selectedType || '未选择'}</p>
      </div>

      {selectedMatch && (
        <div className={styles.selectedMatchInfo}>
          <div className={styles.selectedMatchTitle}>
            ✅ 已选中比赛 #{selectedMatch.id}
          </div>
          <div className={styles.selectedMatchTeams}>
            {getTeamDisplayName(selectedMatch.teamA)} vs {getTeamDisplayName(selectedMatch.teamB)}
          </div>
          <div className={styles.selectedMatchInstruction}>
            点击场地卡片将此比赛分配到对应场地
          </div>
        </div>
      )}

      <div className={styles.bracketContainer}>
        {groupedMatches.map((round, roundIndex) => (
          <React.Fragment key={`round-${roundIndex}`}>
            <div className={styles.round}>
                <h3 className={styles.roundTitle}>
                {(() => {
                  const totalRounds = groupedMatches.length;
                  if (roundIndex === totalRounds - 1) {
                  return '决赛';
                  } else if (roundIndex === totalRounds - 2) {
                  return '半决赛';
                  } else {
                  return `第${roundIndex + 1}轮`;
                  }
                })()}
                </h3>
              <div className={styles.matchList} style={{ position: 'relative', minHeight: '2500px' }}>
                {round
                  .filter((match) => {
                    // 对于第一轮的比赛，如果某一方为待定，则不显示比赛卡片
                    if (roundIndex === 0) {
                      const teamADisplayName = getTeamDisplayName(match.teamA);
                      const teamBDisplayName = getTeamDisplayName(match.teamB);
                      return teamADisplayName !== '待定' && teamBDisplayName !== '待定';
                    }
                    return true;
                  })
                  .map((match, matchIndex) => {
                  const positionData = storedPositions[`round-${roundIndex}-match-${match.id}`]
                  const [position, isLong] = positionData || [undefined, true]
                  
                  // 检查比赛是否可以分配场地（与handleMatchClick中的逻辑保持一致）
                  const teamADisplayName = getTeamDisplayName(match.teamA);
                  const teamBDisplayName = getTeamDisplayName(match.teamB);
                  const canAssign = (match.status === 'pending' || match.status === 'scheduled') && 
                                   (!match.courtId || match.courtId === 0) &&
                                   match.teamA && match.teamB && 
                                   teamADisplayName !== '待定' && 
                                   teamBDisplayName !== '待定' &&
                                   teamADisplayName.trim() !== '' &&
                                   teamBDisplayName.trim() !== '';
                  
                  // 动态样式：根据isLong决定卡片高度
                  const wrapperStyles: React.CSSProperties = {
                    position: position !== undefined ? 'absolute' : 'relative',
                    top: position !== undefined ? `${position}px` : 'auto',
                    width: '100%',
                    marginBottom: position !== undefined ? '0' : '16px'
                  };
                  
                  const cardStyles: React.CSSProperties = {
                    cursor: canAssign ? 'pointer' : 'default',
                    height: !isLong ? '70px' : 'auto',
                    minHeight: !isLong ? '70px' : '140px',
                    fontSize: !isLong ? '12px' : '14px',
                    padding: !isLong ? '6px' : '12px'
                  };
                  
                  // 判断是否为决赛（最后一轮且不是铜牌赛）
                  const isFinalMatch = roundIndex === groupedMatches.length - 1 && !match.isBronzeMatch;
                  
                  return (
                    <div 
                      key={`match-${String(match.id)}-${roundIndex}-${matchIndex}`} 
                      className={styles.matchWrapper}
                      style={wrapperStyles}
                    >
                      <div 
                        className={`${styles.matchCard} ${styles[match.status]} ${selectedMatch?.id === match.id ? styles.selected : ''} ${canAssign ? styles.clickable : ''} ${!isLong ? 'compactMatch' : ''} ${match.isBronzeMatch ? styles.bronzeMatch : ''} ${isFinalMatch ? styles.finalMatch : ''}`}
                        onClick={() => handleMatchClick(match)}
                        style={cardStyles}
                        title={canAssign ? '点击选择此比赛进行场地分配' : '此比赛暂不可分配场地'}
                      >
                      {/* 只在长卡片时显示头部信息 */}
                      {isLong && (
                        <div className={styles.matchHeader}>
                          {/* 决赛标识 */}
                          {isFinalMatch && (
                            <div className={styles.finalLabel}>
                              🏆 决赛
                            </div>
                          )}
                          {/* 铜牌赛标识 */}
                          {match.isBronzeMatch && (
                            <div className={styles.bronzeLabel}>
                              🥉 铜牌赛
                            </div>
                          )}
                          <div className={styles.statusContainer}>
                            {getStatusIcon(match.status)}
                            <span 
                              className={`${styles.status} ${styles[match.status]}`}
                              style={{ fontSize: '12px' }}
                            >
                              {getStatusText(match.status)}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {/* 短卡片也需要决赛标识 */}
                      {!isLong && isFinalMatch && (
                        <div className={styles.finalLabelCompact}>
                          🏆
                        </div>
                      )}
                      
                      {/* 短卡片也需要铜牌赛标识 */}
                      {!isLong && match.isBronzeMatch && (
                        <div className={styles.bronzeLabelCompact}>
                          🥉
                        </div>
                      )}
                      
                      <div 
                        className={styles.teamsContainer}
                        style={{ 
                          padding: !isLong ? '2px 0' : '8px 0',
                          fontSize: !isLong ? '11px' : '14px'
                        }}
                      >
                        {(() => {
                          const scoreInfo = formatMatchScore(match);
                          
                          // 窄卡片使用超紧凑布局
                          if (!isLong) {
                            return (
                              <div style={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                height: '100%', 
                                justifyContent: 'center',
                                fontSize: '12px',
                                lineHeight: '1.7',
                                padding: '2px 4px'
                              }}>
                                {scoreInfo.sets.length > 0 ? (
                                  <>
                                    {/* 紧凑的队伍和比分显示 */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '4px' }}>
                                        {getTeamDisplayName(match.teamA)}
                                      </span>
                                      <div style={{ display: 'flex', gap: '3px', minWidth: 'fit-content' }}>
                                        {scoreInfo.sets.map((set: any, setIndex: number) => (
                                          <span 
                                            key={setIndex}
                                            style={{ 
                                              fontSize: '9px',
                                              fontWeight: set.winnerA ? 'bold' : 'normal',
                                              color: set.winnerA ? '#10b981' : 'inherit'
                                            }}
                                          >
                                            {set.scoreA}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '4px' }}>
                                        {getTeamDisplayName(match.teamB)}
                                      </span>
                                      <div style={{ display: 'flex', gap: '3px', minWidth: 'fit-content' }}>
                                        {scoreInfo.sets.map((set: any, setIndex: number) => (
                                          <span 
                                            key={setIndex}
                                            style={{ 
                                              fontSize: '9px',
                                              fontWeight: set.winnerB ? 'bold' : 'normal',
                                              color: set.winnerB ? '#10b981' : 'inherit'
                                            }}
                                          >
                                            {set.scoreB}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div style={{ marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {getTeamDisplayName(match.teamA)}
                                    </div>
                                    <div style={{ marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {getTeamDisplayName(match.teamB)}
                                    </div>
                                  </>
                                )}
                                {/* 场地信息紧凑显示 */}
                                {match.court && (
                                  <div
                                    style={{
                                      fontSize: '10px',
                                      color: '#666',
                                      textAlign: 'center',
                                      marginTop: '2px',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      borderRadius: '8px',
                                      background: '#f3f4f6',
                                      padding: '2px 8px',
                                      display: 'inline-block',
                                      marginLeft: 'auto',
                                      marginRight: 'auto',
                                    }}
                                  >
                                    {match.court.name}
                                  </div>
                                )}
                              </div>
                            );
                          }
                          
                          // 长卡片保持原有布局
                          return (
                            <div className={styles.matchLayout}>
                              {/* 简洁比分显示 */}
                              {scoreInfo.sets.length > 0 ? (
                                <div className={styles.compactScoreDisplay}>
                                  {/* 队伍A */}
                                  <div className={styles.teamScoreLine}>
                                    <div className={styles.teamInfo}>
                                      <Users 
                                        className={styles.teamIcon} 
                                        size={!isLong ? 12 : 16}
                                      />
                                      <span 
                                        className={styles.teamName}
                                        style={{ fontSize: !isLong ? '10px' : '14px' }}
                                      >
                                        {getTeamDisplayName(match.teamA)}
                                        {match.status === 'playing' && getCurrentServer(match) === 'A' && (
                                          <span style={{ 
                                            display: 'inline-block',
                                            width: !isLong ? '4px' : '6px',
                                            height: !isLong ? '4px' : '6px',
                                            backgroundColor: '#10b981',
                                            borderRadius: '50%',
                                            marginLeft: '4px',
                                            verticalAlign: 'middle'
                                          }}></span>
                                        )}
                                      </span>
                                    </div>
                                    <div className={styles.setScores}>
                                      {scoreInfo.sets.map((set: any, setIndex: number) => (
                                        <span 
                                          key={setIndex} 
                                          className={`${styles.setScore} ${set.winnerA ? styles.winningScore : ''}`}
                                          style={{ fontSize: !isLong ? '9px' : '12px' }}
                                        >
                                          {set.scoreA}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  
                                  {/* 队伍B */}
                                  <div className={styles.teamScoreLine}>
                                    <div className={styles.teamInfo}>
                                      <Users 
                                        className={styles.teamIcon} 
                                        size={!isLong ? 12 : 16}
                                      />
                                      <span 
                                        className={styles.teamName}
                                        style={{ fontSize: !isLong ? '10px' : '14px' }}
                                      >
                                        {getTeamDisplayName(match.teamB)}
                                        {match.status === 'playing' && getCurrentServer(match) === 'B' && (
                                          <span style={{ 
                                            display: 'inline-block',
                                            width: !isLong ? '4px' : '6px',
                                            height: !isLong ? '4px' : '6px',
                                            backgroundColor: '#10b981',
                                            borderRadius: '50%',
                                            marginLeft: '4px',
                                            verticalAlign: 'middle'
                                          }}></span>
                                        )}
                                      </span>
                                    </div>
                                    <div className={styles.setScores}>
                                      {scoreInfo.sets.map((set: any, setIndex: number) => (
                                        <span 
                                          key={setIndex} 
                                          className={`${styles.setScore} ${set.winnerB ? styles.winningScore : ''}`}
                                          style={{ fontSize: !isLong ? '9px' : '12px' }}
                                        >
                                          {set.scoreB}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className={styles.noScores}>
                                  <div className={styles.teamInfo}>
                                    <Users 
                                      className={styles.teamIcon} 
                                      size={!isLong ? 12 : 16}
                                    />
                                    <span 
                                      className={styles.teamName}
                                      style={{ fontSize: !isLong ? '10px' : '14px' }}
                                    >
                                      {getTeamDisplayName(match.teamA)}
                                    </span>
                                  </div>
                                  <div className={styles.teamInfo}>
                                    <Users 
                                      className={styles.teamIcon} 
                                      size={!isLong ? 12 : 16}
                                    />
                                    <span 
                                      className={styles.teamName}
                                      style={{ fontSize: !isLong ? '10px' : '14px' }}
                                    >
                                      {getTeamDisplayName(match.teamB)}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {/* 场地信息只在长卡片时显示 */}
                      {isLong && match.court && (
                        <div 
                          className={styles.courtInfo}
                          style={{ 
                            fontSize: '12px',
                            padding: '4px 8px'
                          }}
                        >
                          <span>场地: {match.court.name}</span>
                        </div>
                      )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            
            {/* 添加连接线（除最后一轮外） */}
            {roundIndex < groupedMatches.length - 1 && (
              <div className={styles.connectionContainer}>
                <div className={styles.connectionLine}></div>
                {/* 根据比赛数量添加分支线 */}
                {round.length > 1 && (
                  <>
                    <div className={`${styles.branchLine} ${styles.left}`}></div>
                    <div className={`${styles.branchLine} ${styles.right}`}></div>
                  </>
                )}
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

export default TournamentBracket