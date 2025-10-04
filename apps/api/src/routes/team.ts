import { Router } from "express";
import { prisma } from "../prismaClient";

const router = Router();

// 获取所有队伍
router.get("/", async (req, res) => {
  try {
    const teams = await prisma.team.findMany({
      orderBy: { id: 'asc' }
    });
    res.json(teams);
  } catch (error) {
    console.error('获取队伍列表失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取队伍列表失败',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

// 创建队伍
router.post("/", async (req, res) => {
  try {
    const { name, players, type } = req.body;
    const team = await prisma.team.create({
      data: { name, players, type },
    });
    res.json(team);
  } catch (error) {
    console.error('创建队伍失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '创建队伍失败',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

// 更新队伍信息
router.put("/:id", async (req, res) => {
  try {
    const teamId = parseInt(req.params.id);
    const { name, players, type } = req.body;
    
    const updatedTeam = await prisma.team.update({
      where: { id: teamId },
      data: { 
        ...(name && { name }),
        ...(players && { players }),
        ...(type && { type })
      }
    });
    
    res.json({
      success: true,
      message: '队伍信息更新成功',
      data: updatedTeam
    });
  } catch (error) {
    console.error('更新队伍失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '更新队伍失败',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

// 删除队伍
router.delete("/:id", async (req, res) => {
  try {
    const teamId = parseInt(req.params.id);
    
    // 检查队伍是否参与了比赛
    const matchCount = await prisma.match.count({
      where: {
        OR: [
          { teamAId: teamId },
          { teamBId: teamId }
        ]
      }
    });
    
    if (matchCount > 0) {
      return res.status(400).json({
        success: false,
        message: '无法删除已参与比赛的队伍'
      });
    }
    
    await prisma.team.delete({
      where: { id: teamId }
    });
    
    res.json({
      success: true,
      message: '队伍删除成功'
    });
  } catch (error) {
    console.error('删除队伍失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '删除队伍失败',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

export default router;
