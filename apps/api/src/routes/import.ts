import express, { Request, Response } from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import iconv from 'iconv-lite';
import { PrismaClient, MatchType } from '@prisma/client';
import path from 'path';
import fs from 'fs';

// 扩展Request类型以支持file属性
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

const router = express.Router();
const prisma = new PrismaClient();

// 配置文件上传
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv' // .csv
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 Excel (.xlsx, .xls) 和 CSV 文件'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB限制
  }
});

// 数据验证函数
interface TeamData {
  name: string;
  players: string;
  type: string;
  rowIndex: number;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  data: TeamData[];
}

// 乱码修复函数（作为兜底方案）
function fixGarbledText(text: string): string {
  if (!text) return text;
  
  // 常见的UTF-8误读GBK产生的乱码修复
  const garbledPatterns = [
    { pattern: 'ç·å', replacement: '男双' },
    { pattern: 'å¥³å', replacement: '女双' },
    { pattern: 'æ··å', replacement: '混双' },
    { pattern: 'Ç·Å', replacement: '男双' },
    { pattern: 'Å¥³Å', replacement: '女双' },
    { pattern: 'Æ··Å', replacement: '混双' },
  ];
  
  // 按优先级尝试修复
  for (const { pattern, replacement } of garbledPatterns) {
    if (text.includes(pattern)) {
      const repaired = text.replace(pattern, replacement);
      console.log(`兜底乱码修复: "${text}" → "${repaired}"`);
      return repaired;
    }
  }
  
  return text;
}

function validateTeamData(teams: any[]): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    data: []
  };

  const validTypes = ['MEN_SINGLE', 'WOMEN_SINGLE', 'MEN_DOUBLE', 'WOMEN_DOUBLE', 'MIX_DOUBLE'];
  const typeMap: { [key: string]: string } = {
    // 中文标识（完全匹配）
    '男双': 'MEN_DOUBLE',
    '女双': 'WOMEN_DOUBLE', 
    '混双': 'MIX_DOUBLE',
    '男单': 'MEN_SINGLE',
    '女单': 'WOMEN_SINGLE',
    // 全称
    '男子双打': 'MEN_DOUBLE',
    '女子双打': 'WOMEN_DOUBLE',
    '混合双打': 'MIX_DOUBLE',
    '男子单打': 'MEN_SINGLE',
    '女子单打': 'WOMEN_SINGLE',
    // 英文标识（直接匹配）
    'MEN_DOUBLE': 'MEN_DOUBLE',
    'WOMEN_DOUBLE': 'WOMEN_DOUBLE',
    'MIX_DOUBLE': 'MIX_DOUBLE',
    'MEN_SINGLE': 'MEN_SINGLE',
    'WOMEN_SINGLE': 'WOMEN_SINGLE',
    // 小写英文
    'men_double': 'MEN_DOUBLE',
    'women_double': 'WOMEN_DOUBLE',
    'mix_double': 'MIX_DOUBLE',
    'men_single': 'MEN_SINGLE',
    'women_single': 'WOMEN_SINGLE',
    // 可能的编码问题修复
    'ç·å': 'MEN_DOUBLE',    // 男双的乱码
    'å¥³å': 'WOMEN_DOUBLE', // 女双的乱码
    'æ··å': 'MIX_DOUBLE',   // 混双的乱码
    // 其他可能的变体
    '男双打': 'MEN_DOUBLE',
    '女双打': 'WOMEN_DOUBLE',
    '混双打': 'MIX_DOUBLE',
    '男子': 'MEN_DOUBLE',    // 简化版本
    '女子': 'WOMEN_DOUBLE',  // 简化版本
    '混合': 'MIX_DOUBLE',    // 简化版本
  };

  teams.forEach((team, index) => {
    const rowIndex = index + 2; // Excel行号（从2开始，因为第1行是标题）
    
    // 验证队伍名称
    if (!team.name || team.name.toString().trim() === '') {
      result.errors.push(`第${rowIndex}行：队伍名称不能为空`);
      result.valid = false;
      return;
    }

    // 验证队员信息
    if (!team.players || team.players.toString().trim() === '') {
      result.errors.push(`第${rowIndex}行：队员信息不能为空`);
      result.valid = false;
      return;
    }

    // 验证比赛类型 - 智能转换
    let originalType = team.type?.toString().trim();
    
    // 先尝试修复乱码
    if (originalType) {
      const fixedType = fixGarbledText(originalType);
      if (fixedType !== originalType) {
        originalType = fixedType;
        console.log(`第${rowIndex}行乱码修复完成: "${team.type}" → "${originalType}"`);
      }
    }
    
    let matchType = originalType?.toUpperCase();
    
    // 多重匹配策略
    if (typeMap[originalType]) {
      // 精确匹配
      matchType = typeMap[originalType];
    } else if (typeMap[originalType?.toLowerCase()]) {
      // 小写匹配
      matchType = typeMap[originalType.toLowerCase()];
    } else {
      // 模糊匹配 - 包含关键字
      const normalizedType = originalType?.toLowerCase();
      if (normalizedType?.includes('男') && (normalizedType?.includes('双') || normalizedType?.includes('double'))) {
        matchType = 'MEN_DOUBLE';
      } else if (normalizedType?.includes('女') && (normalizedType?.includes('双') || normalizedType?.includes('double'))) {
        matchType = 'WOMEN_DOUBLE';
      } else if (normalizedType?.includes('混') && (normalizedType?.includes('双') || normalizedType?.includes('double'))) {
        matchType = 'MIX_DOUBLE';
      } else if (normalizedType?.includes('男') && (normalizedType?.includes('单') || normalizedType?.includes('single'))) {
        matchType = 'MEN_SINGLE';
      } else if (normalizedType?.includes('女') && (normalizedType?.includes('单') || normalizedType?.includes('single'))) {
        matchType = 'WOMEN_SINGLE';
      }
    }
    
    // 调试信息
    console.log(`第${rowIndex}行类型解析: 原始="${team.type}", 修复后="${originalType}", 映射后="${matchType}"`);
    
    if (!validTypes.includes(matchType)) {
      result.errors.push(`第${rowIndex}行：比赛类型无效 "${originalType}"，支持的类型：男双、女双、混双、男单、女单 或 MEN_DOUBLE、WOMEN_DOUBLE、MIX_DOUBLE、MEN_SINGLE、WOMEN_SINGLE`);
      result.valid = false;
      return;
    }

    // 验证队员数量（双打应该有2名队员）
    const playersList = team.players.toString().split(/[,，、]/).filter((p: string) => p.trim());
    if (playersList.length !== 2) {
      result.warnings.push(`第${rowIndex}行：双打比赛应该有2名队员，当前有${playersList.length}名`);
    }

    result.data.push({
      name: team.name.toString().trim(),
      players: playersList.map((p: string) => p.trim()).join(', '),
      type: matchType,
      rowIndex
    });
  });

  return result;
}

// 解析Excel/CSV文件
function parseFile(filePath: string, mimetype: string): any[] {
  try {
    if (mimetype.includes('csv')) {
      // 处理CSV文件 - 使用 iconv-lite 正确处理编码
      const buffer = fs.readFileSync(filePath);

      // 尝试UTF-8与GBK两种编码
      const tryDecode = (encoding: string) => {
        console.log(`尝试使用 ${encoding} 编码解析 CSV`);
        let fileContent: string;
        
        if (encoding === 'utf8') {
          fileContent = buffer.toString('utf8');
          // 跳过BOM
          if (fileContent.charCodeAt(0) === 0xFEFF) {
            fileContent = fileContent.slice(1);
          }
        } else {
          // 使用 iconv-lite 解码 GBK
          fileContent = iconv.decode(buffer, encoding);
        }
        
        const workbook = XLSX.read(fileContent, { type: 'string' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error('CSV文件格式错误');
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) throw new Error('CSV文件内容错误');
        const data = XLSX.utils.sheet_to_json(worksheet);
        return { data, encoding };
      };

      let parsed;
      try {
        // 先尝试 UTF-8
        parsed = tryDecode('utf8');
        
        // 检查是否乱码
        const firstRow = parsed.data[0];
        if (firstRow) {
          const text = JSON.stringify(firstRow);
          // 检测常见的UTF-8误读GBK产生的乱码字符
          if (text.includes('ç·') || text.includes('å¥³') || text.includes('æ··') || 
              text.includes('Ç·') || text.includes('Å¥³') || text.includes('Æ··')) {
            console.log('UTF-8 解码结果有乱码，尝试 GBK...');
            parsed = tryDecode('gbk');
          }
        }
      } catch (e) {
        console.log('UTF-8 解析失败，尝试 GBK...');
        parsed = tryDecode('gbk');
      }

      console.log(`✅ 使用 ${parsed.encoding} 成功解析 ${parsed.data.length} 行`);
      return parsed.data;
    } else {
      // 处理Excel文件
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error('Excel文件格式错误');
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) throw new Error('Excel文件内容错误');
      return XLSX.utils.sheet_to_json(worksheet);
    }
  } catch (error: any) {
    throw new Error(`文件解析失败: ${error.message}`);
  }
}

// 上传和预览文件
router.post('/upload-preview', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const multerReq = req as MulterRequest;
    if (!multerReq.file) {
      return res.status(400).json({ error: '请选择文件' });
    }

    const filePath = multerReq.file.path;
    const mimetype = multerReq.file.mimetype;

    // 解析文件
    const rawData = parseFile(filePath, mimetype);
    
    if (rawData.length === 0) {
      return res.status(400).json({ error: '文件内容为空' });
    }

    // 验证数据
    const validation = validateTeamData(rawData);

    // 清理临时文件
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      fileName: multerReq.file.originalname,
      totalRows: rawData.length,
      validRows: validation.data.length,
      validation: {
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings
      },
      preview: validation.data.slice(0, 10), // 只返回前10行预览
      data: validation.valid ? validation.data : null
    });

  } catch (error: any) {
    // 清理临时文件
    const multerReq = req as MulterRequest;
    if (multerReq.file && fs.existsSync(multerReq.file.path)) {
      fs.unlinkSync(multerReq.file.path);
    }
    
    res.status(500).json({ 
      error: error.message || '文件处理失败' 
    });
  }
});

// 确认导入数据
router.post('/confirm-import', async (req, res) => {
  try {
    const { teams, replaceExisting } = req.body;

    if (!teams || !Array.isArray(teams)) {
      return res.status(400).json({ error: '无效的团队数据' });
    }

    // 如果选择替换现有数据，先清空
    if (replaceExisting) {
      await prisma.match.deleteMany();
      await prisma.team.deleteMany();
    }

    // 检查重复的队伍名称
    const existingTeams = await prisma.team.findMany({
      select: { name: true }
    });
    const existingNames = new Set(existingTeams.map(t => t.name));
    
    const duplicates = teams.filter(team => existingNames.has(team.name));
    if (duplicates.length > 0 && !replaceExisting) {
      return res.status(400).json({
        error: '存在重复的队伍名称',
        duplicates: duplicates.map(d => d.name)
      });
    }

    // 批量创建队伍
    const createdTeams = await prisma.$transaction(
      teams.map(team => 
        prisma.team.create({
          data: {
            name: team.name,
            players: team.players,
            type: team.type as MatchType
          }
        })
      )
    );

    res.json({
      success: true,
      message: `成功导入 ${createdTeams.length} 支队伍`,
      teams: createdTeams
    });

  } catch (error: any) {
    console.error('导入数据失败:', error);
    res.status(500).json({ 
      error: '导入数据失败: ' + error.message 
    });
  }
});

// 获取导入模板
router.get('/template', (req, res) => {
  try {
    // 创建示例数据
    const templateData = [
      { name: '示例队伍1', players: '张三, 李四', type: '男双' },
      { name: '示例队伍2', players: '王五, 赵六', type: '女双' },
      { name: '示例队伍3', players: '陈七, 周八', type: '混双' }
    ];

    // 创建工作簿
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);

    // 设置列宽
    ws['!cols'] = [
      { wch: 15 }, // name列
      { wch: 20 }, // players列
      { wch: 10 }  // type列
    ];

    XLSX.utils.book_append_sheet(wb, ws, '报名表模板');

    // 生成Excel文件
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="badminton_registration_template.xlsx"');
    res.send(buffer);

  } catch (error) {
    res.status(500).json({ error: '生成模板失败' });
  }
});

export default router;