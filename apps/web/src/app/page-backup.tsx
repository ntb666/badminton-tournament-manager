'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Trophy, Users, Clock, Activity, RefreshCw, Zap } from 'lucide-react';
import io from 'socket.io-client';
import TournamentBracket from '../components/TournamentBracket';

// 类型定义
interface Court {
  id: number;
  name: string;
  match?: {
    id: number;
    teamA: string;
    teamB: string;
    scoreA: number | null;
    scoreB: number | null;
    status: string;
    scoreHistory?: string;
    gameSettings?: string;
  } | null;
  status?: 'available' | 'occupied';
}

interface Match {
  id: string;
  teamA: string | null;
  teamB: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
  status: 'pending' | 'playing' | 'completed';
  scoreHistory?: string;
  gameSettings?: string;
}

interface PendingMatch {
  id: number;
  teamA: string;
  teamB: string;
  matchType: string;
  round: number;
}

interface Statistics {
  total: number;
  completed: number;
  active: number;
  waiting: number;
}

interface Round {
  round: number;
  roundName: string;
  matches: Match[];
}

interface Tournament {
  id: string;
  matchType: string;
  matchTypeName?: string;
  totalTeams: number;
  rounds: Round[];
}

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const [courts, setCourts] = useState<Court[]>([]);
  const [schedule, setSchedule] = useState<Tournament[]>([]);
  const [socket, setSocket] = useState<any>(null);
  const [activeTournament, setActiveTournament] = useState<number>(0);
  const [selectedTournamentType, setSelectedTournamentType] = useState<string>('MEN_DOUBLE');
  const [statistics, setStatistics] = useState<Statistics>({
    total: 0,
    completed: 0,
    active: 0,
    waiting: 0
  });
  const [pendingMatches, setPendingMatches] = useState<PendingMatch[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);

  // 格式化比分显示
  const formatScore = (match: any) => {
    if (!match.scoreHistory) {
      return {
        scoreA: match.scoreA ?? '-',
        scoreB: match.scoreB ?? '-',
        sets: []
      };
    }

    try {
      const scoreHistory = JSON.parse(match.scoreHistory);
      const gameSettings = match.gameSettings ? JSON.parse(match.gameSettings) : { pointsPerSet: 21, deuceDiff: 2 };
      
      let setsWonA = 0;
      let setsWonB = 0;
      const sets = scoreHistory.map((set: any) => {
        const pointsPerSet = gameSettings.pointsPerSet || 21;
        const deuceDiff = gameSettings.deuceDiff || 2;
        
        const setWinnerA = set.scoreA >= pointsPerSet && set.scoreA - set.scoreB >= deuceDiff;
        const setWinnerB = set.scoreB >= pointsPerSet && set.scoreB - set.scoreA >= deuceDiff;
        
        if (setWinnerA) setsWonA++;
        if (setWinnerB) setsWonB++;
        
        return {
          scoreA: set.scoreA,
          scoreB: set.scoreB,
          winnerA: setWinnerA,
          winnerB: setWinnerB
        };
      });

      return {
        scoreA: setsWonA,
        scoreB: setsWonB,
        sets: sets
      };
    } catch (error) {
      return {
        scoreA: match.scoreA ?? '-',
        scoreB: match.scoreB ?? '-',
        sets: []
      };
    }
  };

  // 确保组件已挂载到客户端
  useEffect(() => {
    setMounted(true);
  }, []);

  const openCourtManager = (courtId: number) => {
    window.open(`http://localhost:3001?courtId=${courtId}`, '_blank', 'width=1200,height=800');
  };

  const fetchStatistics = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/statistics');
      const data = await response.json();
      setStatistics(data);
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    }
  };

  const fetchPendingMatches = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/matches/pending');
      const data = await response.json();
      setPendingMatches(data);
    } catch (error) {
      console.error('Failed to fetch pending matches:', error);
    }
  };

  const fetchCourts = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/courts/status');
      const data = await response.json();
      setCourts(data);
    } catch (error) {
      console.error('Failed to fetch courts:', error);
    }
  };

  const fetchSchedule = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/schedule/tree');
      const data = await response.json();
      setSchedule(data);
    } catch (error) {
      console.error('Failed to fetch schedule:', error);
    }
  };

  const assignMatchToCourt = async (matchId: number, courtId: number) => {
    try {
      const response = await fetch(`http://localhost:4000/api/matches/${matchId}/assign-court`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ courtId }),
      });
      
      if (response.ok) {
        fetchCourts();
        fetchPendingMatches();
        fetchStatistics();
        setShowAssignModal(false);
      }
    } catch (error) {
      console.error('Failed to assign match:', error);
    }
  };

  const assignNextMatch = async (courtId: number) => {
    try {
      const response = await fetch(`http://localhost:4000/api/courts/${courtId}/assign-next-match`, {
        method: 'POST',
      });
      
      if (response.ok) {
        fetchCourts();
        fetchPendingMatches();
        fetchStatistics();
      }
    } catch (error) {
      console.error('Failed to assign next match:', error);
    }
  };

  useEffect(() => {
    if (mounted) {
      fetchCourts();
      fetchSchedule();
      fetchStatistics();
      fetchPendingMatches();
    }
  }, [mounted]);

  useEffect(() => {
    // 连接到后端Socket.IO
    const newSocket = io('http://localhost:4000');
    setSocket(newSocket);

    // 监听Socket事件
    newSocket.on('score-updated', (data: any) => {
      console.log('Score updated via WebSocket:', data);
      fetchCourts();
      fetchSchedule();
      fetchStatistics();
    });

    newSocket.on('match-completed', (data: any) => {
      console.log('Match completed via WebSocket:', data);
      fetchCourts();
      fetchSchedule();
      fetchStatistics();
    });

    newSocket.on('match-assigned', (data: any) => {
      console.log('Match assigned via WebSocket:', data);
      fetchCourts();
      fetchPendingMatches();
      fetchStatistics();
    });

    newSocket.on('match-created', (data: any) => {
      console.log('New match created via WebSocket:', data);
      fetchSchedule();
      fetchPendingMatches();
      fetchStatistics();
    });

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server');
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800" suppressHydrationWarning>
      {/* 顶部导航栏 - 现代化卡片风格 */}
      <nav className="bg-white/10 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Trophy className="h-5 w-5 text-white" suppressHydrationWarning />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">羽毛球赛事管理</h1>
                <p className="text-sm text-gray-300">现代版</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 px-4 py-2 bg-green-500/20 rounded-xl border border-green-500/30">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-400 text-sm font-medium">系统运行中</span>
              </div>
              
              <button 
                onClick={() => { fetchCourts(); fetchSchedule(); fetchStatistics(); fetchPendingMatches(); }}
                className="p-3 bg-blue-600/20 hover:bg-blue-600/30 rounded-xl border border-blue-500/30 transition-all duration-200 hover:scale-105"
              >
                <RefreshCw className="h-4 w-4 text-blue-400" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* 主要内容区域 */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8 space-y-8">
        
        {/* 场地状态卡片组 */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg flex items-center justify-center">
                <Activity className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">场地状态</h2>
                <p className="text-sm text-gray-400">实时监控所有比赛场地</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-400">
                <span className="text-emerald-400 font-bold text-lg">{courts.filter(court => court.match).length}</span>
                <span className="mx-1">/</span>
                <span className="font-medium">{courts.length}</span>
                <span className="ml-1">场地使用中</span>
              </div>
            </div>
          </div>
          
          {/* 场地卡片网格 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {courts.map((court) => (
              <div 
                key={court.id}
                className="group relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:border-blue-400/50 transition-all duration-300 hover:shadow-xl hover:scale-[1.02] cursor-pointer"
                onClick={() => openCourtManager(court.id)}
              >
                {/* 场地状态指示器 */}
                <div className="absolute top-4 right-4">
                  <div className={`w-3 h-3 rounded-full ${
                    court.match ? 'bg-green-500 animate-pulse shadow-lg shadow-green-500/50' : 'bg-gray-400'
                  }`}></div>
                </div>

                {/* 场地标题 */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      court.match 
                        ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
                        : 'bg-gradient-to-br from-gray-500 to-gray-600'
                    }`}>
                      <span className="text-white font-bold">{court.id}</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{court.name}</h3>
                      <p className={`text-sm ${
                        court.match ? 'text-green-400' : 'text-gray-400'
                      }`}>
                        {court.match ? '比赛进行中' : '等待分配'}
                      </p>
                    </div>
                  </div>
                  
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                    court.match 
                      ? 'bg-green-500/20 text-green-400 border border-green-500/50' 
                      : 'bg-gray-500/20 text-gray-400 border border-gray-500/50'
                  }`}>
                    {court.match ? '使用中' : '空闲'}
                  </div>
                </div>

                {/* 比赛信息 */}
                {court.match ? (
                  <div className="space-y-4">
                    {(() => {
                      const formattedScore = formatScore(court.match);
                      return (
                        <div className="bg-black/20 rounded-xl p-4 border border-white/10">
                          {/* 比赛队伍展示 */}
                          <div className="space-y-4">
                            {/* 表头 */}
                            <div className="grid grid-cols-6 gap-2 text-xs text-gray-400 font-semibold">
                              <div>队伍</div>
                              <div>队员</div>
                              <div className="text-center">第一局</div>
                              <div className="text-center">第二局</div>
                              <div className="text-center">第三局</div>
                              <div className="text-center">总局分</div>
                            </div>
                              <div>队员</div>
                              <div className="text-center">第一局</div>
                              <div className="text-center">第二局</div>
                              <div className="text-center">第三局</div>
                              <div className="text-center">总局分</div>
                            </div>
            
                            {/* Team A 行 */}
                            <div className="grid grid-cols-6 gap-2 items-center py-3 border-b border-white/10">
                              <div className="text-blue-400 font-bold text-sm">{court.match.teamA}</div>
                              <div className="text-gray-300 text-xs">队员A</div>
                              {[0, 1, 2].map((setIndex) => (
                                <div key={setIndex} className="text-center">
                                  {formattedScore.sets[setIndex] ? (
                                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                                      formattedScore.sets[setIndex].winnerA 
                                        ? 'bg-blue-500/30 text-blue-300 border border-blue-400/50' 
                                        : 'bg-gray-600/30 text-gray-400 border border-gray-500/50'
                                    }`}>
                                      {formattedScore.sets[setIndex].scoreA}
                                    </span>
                                  ) : (
                                    <span className="text-gray-500 text-xs">-</span>
                                  )}
                                </div>
                              ))}
                              <div className="text-center">
                                <span className="text-xl font-bold text-blue-400 bg-blue-500/20 px-3 py-1 rounded-lg">
                                  {formattedScore.scoreA}
                                </span>
                              </div>
                            </div>
                            
                            {/* Team B 行 */}
                            <div className="grid grid-cols-6 gap-2 items-center py-3">
                              <div className="text-red-400 font-bold text-sm">{court.match.teamB}</div>
                              <div className="text-gray-300 text-xs">队员B</div>
                              {[0, 1, 2].map((setIndex) => (
                                <div key={setIndex} className="text-center">
                                  {formattedScore.sets[setIndex] ? (
                                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                                      formattedScore.sets[setIndex].winnerB 
                                        ? 'bg-red-500/30 text-red-300 border border-red-400/50' 
                                        : 'bg-gray-600/30 text-gray-400 border border-gray-500/50'
                                    }`}>
                                      {formattedScore.sets[setIndex].scoreB}
                                    </span>
                                  ) : (
                                    <span className="text-gray-500 text-xs">-</span>
                                  )}
                                </div>
                              ))}
                              <div className="text-center">
                                <span className="text-xl font-bold text-red-400 bg-red-500/20 px-3 py-1 rounded-lg">
                                  {formattedScore.scoreB}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {/* 比赛状态 */}
                          <div className="mt-4 flex items-center justify-between">
                            <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                              court.match.status === 'completed' 
                                ? 'bg-green-500/20 text-green-400' 
                                : 'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {court.match.status === 'completed' ? '✓ 已完成' : '⚡ 进行中'}
                            </div>
                            <div className="text-xs text-gray-400">
                              点击进入场地管理
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <div className="text-gray-500 text-sm mb-3">场地空闲</div>
                      <button 
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          assignNextMatch(court.id);
                        }}
                      >
                        分配下一场比赛
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 下方：赛程树和侧边栏 */}
        <div className="grid grid-cols-4 gap-6">
          {/* 左侧：赛程树 (3/4宽度) */}
          <div className="col-span-3">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-white">比赛赛程树</h3>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setSelectedTournamentType('MEN_DOUBLE')}
                  className={`px-6 py-3 rounded-lg text-sm font-semibold transition-all hover:transform hover:scale-105 ${
                    selectedTournamentType === 'MEN_DOUBLE'
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  🏸 男子双打
                </button>
                
                <button
                  onClick={() => setSelectedTournamentType('WOMEN_DOUBLE')}
                  className={`px-6 py-3 rounded-lg text-sm font-semibold transition-all hover:transform hover:scale-105 ${
                    selectedTournamentType === 'WOMEN_DOUBLE'
                      ? 'bg-pink-600 text-white shadow-lg'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  💃 女子双打
                </button>
                
                <button
                  onClick={() => setSelectedTournamentType('MIX_DOUBLE')}
                  className={`px-6 py-3 rounded-lg text-sm font-semibold transition-all hover:transform hover:scale-105 ${
                    selectedTournamentType === 'MIX_DOUBLE'
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  👫 混合双打
                </button>
              </div>
            </div>

            <TournamentBracket selectedType={selectedTournamentType} />
          </div>

          {/* 右侧：侧边栏信息 (1/4宽度) */}
          <div className="space-y-6">
            {/* 统计信息 */}
            <div className="bg-gray-800/40 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
              <h4 className="text-lg font-semibold text-white mb-4">实时统计</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">总比赛数</span>
                  <span className="text-white font-medium">{statistics.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">已完成</span>
                  <span className="text-emerald-400 font-medium">{statistics.completed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">进行中</span>
                  <span className="text-blue-400 font-medium">{statistics.active}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">等待中</span>
                  <span className="text-yellow-400 font-medium">{statistics.waiting}</span>
                </div>
              </div>
            </div>

            {/* 等待队列 */}
            <div className="bg-gray-800/40 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
              <h4 className="text-lg font-semibold text-white mb-4">等待队列</h4>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {pendingMatches.slice(0, 5).map((match) => (
                  <div key={match.id} className="bg-gray-700/30 rounded-lg p-3 border border-gray-600/30">
                    <div className="text-sm font-medium text-white mb-1">
                      {match.teamA} vs {match.teamB}
                    </div>
                    <div className="text-xs text-gray-400">
                      {match.matchType} • 第{match.round}轮
                    </div>
                  </div>
                ))}
                {pendingMatches.length === 0 && (
                  <div className="text-gray-500 text-sm text-center py-4">
                    暂无等待比赛
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}