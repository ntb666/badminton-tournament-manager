export default function TestComponent() {
  return (
    <div style={{
      background: 'linear-gradient(to right, #3B82F6, #8B5CF6)',
      padding: '2rem',
      borderRadius: '1rem',
      color: 'white',
      textAlign: 'center' as const,
      fontSize: '1.5rem',
      fontWeight: 'bold'
    }}>
      🎨 测试样式组件 - 如果你能看到蓝紫渐变背景，说明样式正常工作！
    </div>
  )
}