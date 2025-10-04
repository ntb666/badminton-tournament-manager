import React, { useState, useRef } from 'react';
import styles from './ImportPage.module.css';

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
}

interface UploadResponse {
  success: boolean;
  fileName: string;
  totalRows: number;
  validRows: number;
  validation: ValidationResult;
  preview: TeamData[];
  data?: TeamData[];
}

interface ImportPageProps {
  onBack?: () => void;
}

const ImportPage: React.FC<ImportPageProps> = ({ onBack }) => {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [importing, setImporting] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理文件拖拽
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // 处理文件放置
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // 处理文件选择
  const handleFileSelect = (selectedFile: File) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    
    if (!allowedTypes.includes(selectedFile.type)) {
      alert('请选择Excel文件(.xlsx, .xls)或CSV文件');
      return;
    }
    
    if (selectedFile.size > 5 * 1024 * 1024) { // 5MB
      alert('文件大小不能超过5MB');
      return;
    }
    
    setFile(selectedFile);
    setUploadResult(null);
  };

  // 上传并预览文件
  const uploadFile = async () => {
    if (!file) return;
    
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('http://localhost:4001/api/import/upload-preview', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      if (result.success) {
        setUploadResult(result);
      } else {
        alert(result.error || '上传失败');
      }
    } catch (error) {
      console.error('上传错误:', error);
      alert('上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  // 确认导入
  const confirmImport = async () => {
    if (!uploadResult?.data) return;
    
    setImporting(true);
    try {
      const response = await fetch('http://localhost:4001/api/import/confirm-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teams: uploadResult.data,
          replaceExisting
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(`成功导入 ${result.teams.length} 支队伍！`);
        // 重置状态
        setFile(null);
        setUploadResult(null);
        setReplaceExisting(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        if (result.duplicates) {
          alert(`存在重复的队伍名称：${result.duplicates.join(', ')}\n请选择"替换现有数据"或修改文件中的队伍名称`);
        } else {
          alert(result.error || '导入失败');
        }
      }
    } catch (error) {
      console.error('导入错误:', error);
      alert('导入失败，请重试');
    } finally {
      setImporting(false);
    }
  };

  // 下载模板
  const downloadTemplate = async () => {
    try {
      const response = await fetch('http://localhost:4001/api/import/template');
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'badminton_registration_template.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('下载模板失败:', error);
      alert('下载模板失败');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          {onBack && (
            <button onClick={onBack} className={styles.backBtn}>
              ← 返回主控台
            </button>
          )}
        </div>
        <h1>报名表导入</h1>
        <p>支持Excel文件(.xlsx, .xls)和CSV文件，最大5MB</p>
        <button onClick={downloadTemplate} className={styles.downloadBtn}>
          下载导入模板
        </button>
      </div>

      {/* 文件上传区域 */}
      <div 
        className={`${styles.uploadArea} ${dragActive ? styles.dragActive : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          className={styles.hiddenInput}
        />
        
        <div className={styles.uploadContent}>
          <div className={styles.uploadIcon}>📁</div>
          {file ? (
            <div>
              <p className={styles.fileName}>{file.name}</p>
              <p className={styles.fileSize}>
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          ) : (
            <div>
              <p>点击选择文件或拖拽文件到这里</p>
              <p className={styles.supportedFormats}>
                支持 .xlsx, .xls, .csv 格式
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 上传按钮 */}
      {file && !uploadResult && (
        <div className={styles.actions}>
          <button 
            onClick={uploadFile} 
            disabled={uploading}
            className={styles.uploadBtn}
          >
            {uploading ? '解析中...' : '上传并预览'}
          </button>
        </div>
      )}

      {/* 预览结果 */}
      {uploadResult && (
        <div className={styles.previewSection}>
          <div className={styles.summary}>
            <h3>导入预览</h3>
            <div className={styles.stats}>
              <span className={styles.stat}>
                文件：{uploadResult.fileName}
              </span>
              <span className={styles.stat}>
                总行数：{uploadResult.totalRows}
              </span>
              <span className={styles.stat}>
                有效行数：{uploadResult.validRows}
              </span>
            </div>
          </div>

          {/* 验证结果 */}
          {(uploadResult.validation.errors.length > 0 || uploadResult.validation.warnings.length > 0) && (
            <div className={styles.validation}>
              {uploadResult.validation.errors.length > 0 && (
                <div className={styles.errors}>
                  <h4>❌ 错误信息</h4>
                  <ul>
                    {uploadResult.validation.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {uploadResult.validation.warnings.length > 0 && (
                <div className={styles.warnings}>
                  <h4>⚠️ 警告信息</h4>
                  <ul>
                    {uploadResult.validation.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* 数据预览 */}
          {uploadResult.preview.length > 0 && (
            <div className={styles.preview}>
              <h4>数据预览（前10行）</h4>
              <div className={styles.tableContainer}>
                <table className={styles.previewTable}>
                  <thead>
                    <tr>
                      <th>行号</th>
                      <th>队伍名称</th>
                      <th>队员</th>
                      <th>比赛类型</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadResult.preview.map((team, index) => (
                      <tr key={index}>
                        <td>{team.rowIndex}</td>
                        <td>{team.name}</td>
                        <td>{team.players}</td>
                        <td>{team.type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 导入选项和确认 */}
          {uploadResult.validation.valid && (
            <div className={styles.importSection}>
              <div className={styles.options}>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={replaceExisting}
                    onChange={(e) => setReplaceExisting(e.target.checked)}
                  />
                  替换现有数据（清空所有现有队伍和比赛）
                </label>
              </div>
              
              <div className={styles.finalActions}>
                <button 
                  onClick={confirmImport}
                  disabled={importing}
                  className={styles.confirmBtn}
                >
                  {importing ? '导入中...' : `确认导入 ${uploadResult.validRows} 支队伍`}
                </button>
                <button 
                  onClick={() => {
                    setFile(null);
                    setUploadResult(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className={styles.cancelBtn}
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ImportPage;