"use client";

import React, { useState, useEffect } from "react";
import { Users, Save, RotateCcw, AlertTriangle, CheckCircle } from "lucide-react";
import styles from "./ManualBracketAssignment.module.css";

interface Team {
  id: number;
  name: string;
  players: string;
  type: string;
}

interface BracketPosition {
  round: number;
  matchIndex: number;
  position: 'A' | 'B';
  teamId: number | null;
}

interface ManualBracketAssignmentProps {
  matchType: string;
  onComplete: () => void;
  onCancel: () => void;
}

export default function ManualBracketAssignment({ 
  matchType, 
  onComplete, 
  onCancel 
}: ManualBracketAssignmentProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [totalTeams, setTotalTeams] = useState(0);
  const [bracketSize, setBracketSize] = useState(0); // M值，2的幂次
  const [round1Matches, setRound1Matches] = useState(0); // 第一轮比赛数
  const [round2Matches, setRound2Matches] = useState(0); // 第二轮比赛数
  const [assignments, setAssignments] = useState<{ [key: string]: number | null }>({});
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  useEffect(() => {
    fetchTeams();
  }, [matchType]);

  useEffect(() => {
    if (totalTeams > 0) {
      calculateBracketStructure();
    }
  }, [totalTeams]);

  const fetchTeams = async () => {
    try {
      const response = await fetch('http://localhost:4001/api/teams');
      const data = await response.json();
      const filteredTeams = data.filter((team: Team) => team.type === matchType);
      setTeams(filteredTeams);
      setTotalTeams(filteredTeams.length);
    } catch (error) {
      showNotification('error', '获取队伍数据失败');
    }
  };

  const calculateBracketStructure = () => {
    const P = totalTeams; // 实际队伍数
    const M = 2 ** Math.ceil(Math.log2(P)); // 下一个2的幂次
    const B = M - P; // 轮空数量
    
    setBracketSize(M);
    setRound1Matches(M / 2); // 第一轮位置数（包含轮空）
    setRound2Matches(M / 4); // 第二轮位置数
  };

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const getMatchTypeDisplayName = (type: string) => {
    switch (type) {
      case 'MEN_SINGLE': return '男子单打';
      case 'WOMEN_SINGLE': return '女子单打';
      case 'MEN_DOUBLE': return '男子双打';
      case 'WOMEN_DOUBLE': return '女子双打';
      case 'MIX_DOUBLE': return '混合双打';
      default: return type;
    }
  };

  const handleAssignment = (round: number, matchIndex: number, position: 'A' | 'B', teamId: number | null) => {
    const key = `R${round}-M${matchIndex}-${position}`;
    setAssignments(prev => ({
      ...prev,
      [key]: teamId
    }));
  };

  const getAssignment = (round: number, matchIndex: number, position: 'A' | 'B'): number | null => {
    const key = `R${round}-M${matchIndex}-${position}`;
    return assignments[key] || null;
  };

  const resetAssignments = () => {
    setAssignments({});
    showNotification('info', '已重置所有分配');
  };

  const validateAssignments = (): boolean => {
    const assignedTeamIds = new Set<number>();
    
    // 检查第一轮
    for (let i = 0; i < round1Matches; i++) {
      const teamA = getAssignment(1, i, 'A');
      const teamB = getAssignment(1, i, 'B');
      
      // 允许轮空（null），但如果有队伍则不能重复
      if (teamA !== null) {
        if (assignedTeamIds.has(teamA)) {
          showNotification('error', `队伍重复分配：第1轮第${i + 1}场位置A`);
          return false;
        }
        assignedTeamIds.add(teamA);
      }
      
      if (teamB !== null) {
        if (assignedTeamIds.has(teamB)) {
          showNotification('error', `队伍重复分配：第1轮第${i + 1}场位置B`);
          return false;
        }
        assignedTeamIds.add(teamB);
      }
    }
    
    // 检查第二轮（轮空的队伍会直接进入第二轮）
    for (let i = 0; i < round2Matches; i++) {
      const teamA = getAssignment(2, i, 'A');
      const teamB = getAssignment(2, i, 'B');
      
      // 第二轮可能有队伍直接晋级（轮空），这些队伍应该已经在第一轮被分配
      if (teamA !== null && !assignedTeamIds.has(teamA)) {
        // 这是一个轮空队伍，添加到已分配集合
        assignedTeamIds.add(teamA);
      }
      
      if (teamB !== null && !assignedTeamIds.has(teamB)) {
        assignedTeamIds.add(teamB);
      }
    }
    
    return true;
  };

  const submitAssignments = async () => {
    if (!validateAssignments()) {
      return;
    }

    // 构建提交数据
    const bracketData = {
      matchType,
      manualAssignment: true,
      round1: [] as any[],
      round2: [] as any[]
    };

    // 构建第一轮数据
    for (let i = 0; i < round1Matches; i++) {
      bracketData.round1.push({
        matchIndex: i,
        teamAId: getAssignment(1, i, 'A'),
        teamBId: getAssignment(1, i, 'B')
      });
    }

    // 构建第二轮数据
    for (let i = 0; i < round2Matches; i++) {
      bracketData.round2.push({
        matchIndex: i,
        teamAId: getAssignment(2, i, 'A'),
        teamBId: getAssignment(2, i, 'B')
      });
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:4001/api/schedule/generate-bracket-manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bracketData)
      });

      const result = await response.json();

      if (response.ok) {
        showNotification('success', '手动分配赛程成功！');
        setTimeout(() => {
          onComplete();
        }, 1500);
      } else {
        showNotification('error', result.error || '提交失败');
      }
    } catch (error) {
      console.error('提交失败:', error);
      showNotification('error', '提交失败：网络错误');
    } finally {
      setLoading(false);
    }
  };

  const getAvailableTeams = (): Team[] => {
    const assignedTeamIds = new Set(
      Object.values(assignments).filter(id => id !== null) as number[]
    );
    return teams.filter(team => !assignedTeamIds.has(team.id));
  };

  const getTeamName = (teamId: number | null): string => {
    if (teamId === null) return '轮空';
    const team = teams.find(t => t.id === teamId);
    return team ? `${team.name} (${team.players})` : '未知';
  };

  return (
    <div className={styles.container}>
      {/* 通知 */}
      {notification && (
        <div className={`${styles.notification} ${styles[notification.type]}`}>
          <div className={styles.notificationContent}>
            {notification.type === 'success' && <CheckCircle size={20} />}
            {notification.type === 'error' && <AlertTriangle size={20} />}
            {notification.type === 'info' && <Users size={20} />}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      <div className={styles.header}>
        <h2>手动分配赛程 - {getMatchTypeDisplayName(matchType)}</h2>
        <p>共有 {totalTeams} 支队伍，赛程将扩展到 {bracketSize} 个位置</p>
      </div>

      <div className={styles.info}>
        <div className={styles.infoItem}>
          <strong>第一轮：</strong>{round1Matches} 场对阵位置
        </div>
        <div className={styles.infoItem}>
          <strong>第二轮：</strong>{round2Matches} 场对阵位置
        </div>
        <div className={styles.infoItem}>
          <strong>剩余队伍：</strong>{getAvailableTeams().length} 支
        </div>
      </div>

      <div className={styles.rounds}>
        {/* 第一轮 */}
        <div className={styles.round}>
          <h3>第一轮对阵</h3>
          <div className={styles.matchesList}>
            {Array.from({ length: round1Matches }, (_, i) => (
              <div key={`r1-m${i}`} className={styles.matchCard}>
                <div className={styles.matchHeader}>
                  <strong>第 {i + 1} 场</strong>
                </div>
                
                {/* 位置 A */}
                <div className={styles.position}>
                  <label>位置 A:</label>
                  <select
                    value={getAssignment(1, i, 'A') || ''}
                    onChange={(e) => handleAssignment(1, i, 'A', e.target.value ? parseInt(e.target.value) : null)}
                    className={styles.teamSelect}
                  >
                    <option value="">-- 选择队伍或留空(轮空) --</option>
                    {teams.map(team => (
                      <option 
                        key={team.id} 
                        value={team.id}
                        disabled={
                          Object.values(assignments).includes(team.id) && 
                          getAssignment(1, i, 'A') !== team.id
                        }
                      >
                        {team.name} ({team.players})
                      </option>
                    ))}
                  </select>
                  {getAssignment(1, i, 'A') && (
                    <div className={styles.selectedTeam}>
                      ✓ {getTeamName(getAssignment(1, i, 'A'))}
                    </div>
                  )}
                </div>

                <div className={styles.vs}>VS</div>

                {/* 位置 B */}
                <div className={styles.position}>
                  <label>位置 B:</label>
                  <select
                    value={getAssignment(1, i, 'B') || ''}
                    onChange={(e) => handleAssignment(1, i, 'B', e.target.value ? parseInt(e.target.value) : null)}
                    className={styles.teamSelect}
                  >
                    <option value="">-- 选择队伍或留空(轮空) --</option>
                    {teams.map(team => (
                      <option 
                        key={team.id} 
                        value={team.id}
                        disabled={
                          Object.values(assignments).includes(team.id) && 
                          getAssignment(1, i, 'B') !== team.id
                        }
                      >
                        {team.name} ({team.players})
                      </option>
                    ))}
                  </select>
                  {getAssignment(1, i, 'B') && (
                    <div className={styles.selectedTeam}>
                      ✓ {getTeamName(getAssignment(1, i, 'B'))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 第二轮 */}
        <div className={styles.round}>
          <h3>第二轮对阵（可选填写轮空队伍）</h3>
          <p className={styles.roundNote}>
            💡 提示：如果某队在第一轮轮空，可以在这里直接分配到第二轮的位置
          </p>
          <div className={styles.matchesList}>
            {Array.from({ length: round2Matches }, (_, i) => (
              <div key={`r2-m${i}`} className={styles.matchCard}>
                <div className={styles.matchHeader}>
                  <strong>第 {i + 1} 场</strong>
                </div>
                
                {/* 位置 A */}
                <div className={styles.position}>
                  <label>位置 A:</label>
                  <select
                    value={getAssignment(2, i, 'A') || ''}
                    onChange={(e) => handleAssignment(2, i, 'A', e.target.value ? parseInt(e.target.value) : null)}
                    className={styles.teamSelect}
                  >
                    <option value="">-- 待定（第一轮晋级）或选择轮空队伍 --</option>
                    {teams.map(team => (
                      <option 
                        key={team.id} 
                        value={team.id}
                        disabled={
                          Object.values(assignments).includes(team.id) && 
                          getAssignment(2, i, 'A') !== team.id
                        }
                      >
                        {team.name} ({team.players})
                      </option>
                    ))}
                  </select>
                  {getAssignment(2, i, 'A') && (
                    <div className={styles.selectedTeam}>
                      ✓ {getTeamName(getAssignment(2, i, 'A'))}
                    </div>
                  )}
                </div>

                <div className={styles.vs}>VS</div>

                {/* 位置 B */}
                <div className={styles.position}>
                  <label>位置 B:</label>
                  <select
                    value={getAssignment(2, i, 'B') || ''}
                    onChange={(e) => handleAssignment(2, i, 'B', e.target.value ? parseInt(e.target.value) : null)}
                    className={styles.teamSelect}
                  >
                    <option value="">-- 待定（第一轮晋级）或选择轮空队伍 --</option>
                    {teams.map(team => (
                      <option 
                        key={team.id} 
                        value={team.id}
                        disabled={
                          Object.values(assignments).includes(team.id) && 
                          getAssignment(2, i, 'B') !== team.id
                        }
                      >
                        {team.name} ({team.players})
                      </option>
                    ))}
                  </select>
                  {getAssignment(2, i, 'B') && (
                    <div className={styles.selectedTeam}>
                      ✓ {getTeamName(getAssignment(2, i, 'B'))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <button 
          className={styles.resetButton}
          onClick={resetAssignments}
        >
          <RotateCcw size={18} />
          重置所有分配
        </button>
        <button 
          className={styles.cancelButton}
          onClick={onCancel}
        >
          取消
        </button>
        <button 
          className={styles.submitButton}
          onClick={submitAssignments}
          disabled={loading}
        >
          <Save size={18} />
          {loading ? '提交中...' : '确认提交'}
        </button>
      </div>
    </div>
  );
}
