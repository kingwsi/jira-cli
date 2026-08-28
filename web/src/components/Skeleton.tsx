import React from 'react'

export interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: string | number
  circle?: boolean
  className?: string
  style?: React.CSSProperties
}

/** 骨架屏基础原子组件 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '16px',
  borderRadius,
  circle = false,
  className = '',
  style,
}) => {
  const customStyle: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius: circle ? '50%' : borderRadius !== undefined ? (typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius) : 'var(--radius-sm, 4px)',
    ...style,
  }

  return <span data-ui="skeleton" className={className} style={customStyle} />
}

export interface TableSkeletonProps {
  rows?: number
  showHeader?: boolean
}

/** 表格骨架屏组件 */
export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 6,
  showHeader = true,
}) => {
  const rowList = Array.from({ length: rows }, (_, i) => i)

  return (
    <div data-ui="table-container" style={{ width: '100%' }}>
      <table data-ui="table">
        {showHeader && (
          <thead>
            <tr>
              <th style={{ width: '110px' }}>
                <Skeleton width={60} height={14} />
              </th>
              <th>
                <Skeleton width={140} height={14} />
              </th>
              <th style={{ width: '110px' }}>
                <Skeleton width={50} height={14} />
              </th>
              <th style={{ width: '100px' }}>
                <Skeleton width={50} height={14} />
              </th>
              <th style={{ width: '110px' }}>
                <Skeleton width={60} height={14} />
              </th>
              <th style={{ width: '115px' }}>
                <Skeleton width={70} height={14} />
              </th>
              <th style={{ width: '115px' }}>
                <Skeleton width={70} height={14} />
              </th>
              <th style={{ width: '95px' }}>
                <Skeleton width={50} height={14} />
              </th>
              <th style={{ width: '90px', textAlign: 'center' }}>
                <Skeleton width={50} height={14} style={{ margin: '0 auto' }} />
              </th>
            </tr>
          </thead>
        )}
        <tbody>
          {rowList.map((idx) => {
            // 产生不同宽度的自然占位条
            const summaryWidths = ['65%', '85%', '50%', '75%', '60%', '80%', '90%', '70%']
            const sw = summaryWidths[idx % summaryWidths.length]

            return (
              <tr key={idx}>
                <td>
                  <Skeleton width={75} height={15} />
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <Skeleton width={sw} height={15} />
                    {idx % 3 === 0 && <Skeleton width="40%" height={11} />}
                  </div>
                </td>
                <td>
                  <Skeleton width={55} height={20} borderRadius={12} />
                </td>
                <td>
                  <Skeleton width={60} height={20} borderRadius={12} />
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Skeleton width={20} height={20} circle />
                    <Skeleton width={50} height={13} />
                  </div>
                </td>
                <td>
                  <Skeleton width={80} height={14} />
                </td>
                <td>
                  <Skeleton width={80} height={14} />
                </td>
                <td>
                  <Skeleton width={40} height={14} />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <Skeleton width={56} height={24} borderRadius={4} style={{ margin: '0 auto' }} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** 详情抽屉骨架屏 */
export const DrawerSkeleton: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '16px' }}>
      {/* 头部 Key 与 类型 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Skeleton width={90} height={22} />
          <Skeleton width={60} height={20} borderRadius={12} />
        </div>
        <Skeleton width={80} height={20} borderRadius={12} />
      </div>

      {/* 标题 */}
      <Skeleton width="90%" height={24} />

      {/* 状态流转按钮占位 */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <Skeleton width={110} height={32} />
        <Skeleton width={110} height={32} />
      </div>

      {/* 字段网格 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '10px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Skeleton width={70} height={14} />
          <Skeleton width="100%" height={36} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Skeleton width={70} height={14} />
          <Skeleton width="100%" height={36} />
        </div>
      </div>

      {/* 描述框 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
        <Skeleton width={60} height={14} />
        <Skeleton width="100%" height={90} />
      </div>

      {/* 子任务 / 工时区域 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
        <Skeleton width={100} height={18} />
        <Skeleton width="100%" height={40} />
        <Skeleton width="100%" height={40} />
      </div>
    </div>
  )
}

/** 规划与排期甘特图骨架屏 */
export const PlanningSkeleton: React.FC = () => {
  const rows = Array.from({ length: 9 }, (_, i) => i)

  return (
    <div
      style={{
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-surface)',
      }}
    >
      {/* 顶部表头 */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-default)',
          backgroundColor: '#fafbfc',
          padding: '10px 16px',
        }}
      >
        <div style={{ width: '420px' }}>
          <Skeleton width={120} height={16} />
        </div>
        <div style={{ flex: 1, display: 'flex', gap: '8px' }}>
          {Array.from({ length: 14 }).map((_, i) => (
            <Skeleton key={i} width={36} height={16} />
          ))}
        </div>
      </div>

      {/* 树形行与时间轴条占位 */}
      {rows.map((r) => {
        const isParent = r % 3 === 0
        const barLefts = [20, 150, 240, 80, 190, 320, 50, 180, 260]
        const barWidths = [180, 240, 140, 280, 160, 210, 190, 150, 220]

        return (
          <div
            key={r}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: isParent ? '12px 16px' : '8px 16px',
              borderBottom: '1px solid var(--border-subtle, rgba(9, 30, 66, 0.06))',
              backgroundColor: isParent ? 'rgba(9, 30, 66, 0.02)' : 'transparent',
            }}
          >
            {/* 左侧树节点 */}
            <div
              style={{
                width: '420px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                paddingLeft: isParent ? '0px' : '24px',
              }}
            >
              <Skeleton width={isParent ? 85 : 75} height={15} />
              <Skeleton width={isParent ? '60%' : '50%'} height={15} />
              <Skeleton width={50} height={18} borderRadius={10} />
            </div>

            {/* 右侧时间轴条 */}
            <div style={{ flex: 1, position: 'relative', height: '24px', display: 'flex', alignItems: 'center' }}>
              <Skeleton
                width={barWidths[r % barWidths.length]}
                height={isParent ? 16 : 14}
                borderRadius={isParent ? 3 : 10}
                style={{
                  position: 'absolute',
                  left: `${barLefts[r % barLefts.length]}px`,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** 工时日历矩阵骨架屏 (用于工时日历主页面) */
export const WorklogsSkeleton: React.FC = () => {
  const rows = Array.from({ length: 8 }, (_, i) => i)

  return (
    <div
      style={{
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-surface)',
      }}
    >
      {/* 矩阵表头 */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-default)',
          backgroundColor: '#fafbfc',
          padding: '10px 16px',
        }}
      >
        <div style={{ width: '380px' }}>
          <Skeleton width={140} height={16} />
        </div>
        <div style={{ flex: 1, display: 'flex', gap: '8px' }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} width={38} height={16} />
          ))}
        </div>
      </div>

      {/* 矩阵数据行占位 */}
      {rows.map((r) => {
        const swList = ['70%', '85%', '55%', '90%', '65%', '80%', '75%', '60%']
        return (
          <div
            key={r}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '10px 16px',
              borderBottom: '1px solid var(--border-subtle, rgba(9, 30, 66, 0.06))',
            }}
          >
            {/* 左侧任务名称与经办人 */}
            <div style={{ width: '380px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Skeleton width={75} height={15} />
                <Skeleton width={swList[r % swList.length]} height={15} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Skeleton width={50} height={12} />
                <Skeleton width={40} height={12} />
              </div>
            </div>

            {/* 右侧每日工时填报小块 */}
            <div style={{ flex: 1, display: 'flex', gap: '8px', alignItems: 'center' }}>
              {Array.from({ length: 12 }).map((_, i) => {
                const hasHours = (r + i) % 3 === 0
                return (
                  <div
                    key={i}
                    style={{
                      width: '38px',
                      display: 'flex',
                      justifyContent: 'center',
                    }}
                  >
                    {hasHours ? (
                      <Skeleton width={32} height={20} borderRadius={4} />
                    ) : (
                      <Skeleton width={16} height={10} borderRadius={2} style={{ opacity: 0.3 }} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** 抽屉顶部 7 天微日历骨架屏 */
export const WeekCalendarSkeleton: React.FC = () => {
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      {/* 顶栏周区间与统计 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Skeleton width={14} height={14} circle />
          <Skeleton width={110} height={16} />
        </div>
        <Skeleton width={90} height={20} borderRadius={10} />
      </div>

      {/* 7 天网格 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px 2px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-input)',
              gap: '4px',
            }}
          >
            <Skeleton width={18} height={11} />
            <Skeleton width={18} height={14} />
            <Skeleton width={26} height={16} borderRadius={4} />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Skeleton width="60%" height={13} />
      </div>
    </div>
  )
}

