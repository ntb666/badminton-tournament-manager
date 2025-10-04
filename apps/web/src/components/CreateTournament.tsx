// CreateTournament.tsx - 创建新赛程的组件
import React, { useState, useEffect } from 'react'
import styles from './CreateTournament.module.css'

interface Team {
  id: number
  name: string
  players: string
  type: string
}

interface CreateTournamentProps {
  onTournamentCreated: (tournament: any) => void
  onCancel: () => void
}

export default function CreateTournament({ onTournamentCreated, onCancel }: CreateTournamentProps) {
  const [name, setName] = useState('')
  const [matchType, setMatchType] = useState('MEN_DOUBLE')
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeams, setSelectedTeams] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 获取可用队伍
  useEffect(() => {
    fetchTeams()
  }, [matchType])

  const fetchTeams = async () => {
    try {
      const response = await fetch('http://localhost:4001/api/teams')
      const allTeams = await response.json()
      const filteredTeams = allTeams.filter((team: Team) => team.type === matchType)
      setTeams(filteredTeams)
      setSelectedTeams([])
    } catch (error) {
      setError('获取队伍列表失败')
    }
  }

  const handleTeamToggle = (teamId: number) => {
    setSelectedTeams(prev => 
      prev.includes(teamId)
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    )
  }

  const handleSelectAll = () => {
    setSelectedTeams(teams.map(team => team.id))
  }

  const handleClearAll = () => {
    setSelectedTeams([])
  }

  const handleCreateTournament = async () => {
    if (!name.trim()) {
      setError('请输入赛程名称')
      return
    }

    if (selectedTeams.length < 2) {
      setError('至少需要选择2支队伍')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('http://localhost:4001/api/tournaments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name.trim(),
          matchType,
          teamIds: selectedTeams,
          seedingMethod: 'random'
        })
      })

      if (!response.ok) {
        throw new Error('创建赛程失败')
      }

      const result = await response.json()
      onTournamentCreated(result.tournament)
    } catch (error) {
      setError(error instanceof Error ? error.message : '创建赛程失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>创建新赛程</h2>
          <button className={styles.closeButton} onClick={onCancel}>×</button>
        </div>

        <div className={styles.form}>
          <div className={styles.field}>
            <label>赛程名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入赛程名称..."
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label>比赛类型</label>
            <select
              value={matchType}
              onChange={(e) => setMatchType(e.target.value)}
              className={styles.select}
            >
              <option value="MEN_DOUBLE">男子双打</option>
              <option value="WOMEN_DOUBLE">女子双打</option>
              <option value="MIX_DOUBLE">混合双打</option>
            </select>
          </div>

          <div className={styles.field}>
            <div className={styles.teamHeader}>
              <label>选择参赛队伍 ({selectedTeams.length}/{teams.length})</label>
              <div className={styles.teamActions}>
                <button onClick={handleSelectAll} className={styles.actionButton}>全选</button>
                <button onClick={handleClearAll} className={styles.actionButton}>清空</button>
              </div>
            </div>

            <div className={styles.teamList}>
              {teams.length === 0 ? (
                <div className={styles.emptyState}>
                  该比赛类型暂无队伍
                </div>
              ) : (
                teams.map(team => (
                  <div
                    key={team.id}
                    className={`${styles.teamItem} ${
                      selectedTeams.includes(team.id) ? styles.selected : ''
                    }`}
                    onClick={() => handleTeamToggle(team.id)}
                  >
                    <div className={styles.teamInfo}>
                      <span className={styles.teamName}>{team.name}</span>
                      <span className={styles.teamPlayers}>{team.players}</span>
                    </div>
                    <div className={styles.checkbox}>
                      {selectedTeams.includes(team.id) && '✓'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          <div className={styles.footer}>
            <button onClick={onCancel} className={styles.cancelButton}>
              取消
            </button>
            <button
              onClick={handleCreateTournament}
              disabled={loading || selectedTeams.length < 2}
              className={styles.createButton}
            >
              {loading ? '创建中...' : `创建赛程 (${selectedTeams.length}支队伍)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}