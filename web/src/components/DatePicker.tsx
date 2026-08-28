import React, { forwardRef } from 'react'
import ReactDatePicker, { registerLocale } from 'react-datepicker'
import { zhCN } from 'date-fns/locale/zh-CN'
import { Calendar as CalendarIcon, X } from 'lucide-react'
import 'react-datepicker/dist/react-datepicker.css'

// 注册中文语言包
registerLocale('zh-CN', zhCN)

export interface DatePickerProps {
  value?: string // YYYY-MM-DD
  onChange: (val: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
  isClearable?: boolean
  minDate?: Date
  maxDate?: Date
}

/** 自定义输入框触发器 */
const CustomDateInput = forwardRef<
  HTMLButtonElement,
  { value?: string; onClick?: () => void; placeholder?: string; disabled?: boolean; isClearable?: boolean; onClear?: () => void }
>(({ value, onClick, placeholder, disabled, isClearable, onClear }, ref) => (
  <div
    style={{
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      width: '100%',
    }}
  >
    <button
      type="button"
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      data-ui="input"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        height: '36px',
        padding: '0 10px',
        textAlign: 'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: 'var(--bg-input, #fff)',
        fontSize: '13px',
        color: value ? 'var(--text-primary)' : 'var(--text-muted)',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <CalendarIcon size={14} color="var(--color-primary, #0052cc)" style={{ flexShrink: 0 }} />
        <span>{value || placeholder || '选择日期...'}</span>
      </span>
      {isClearable && value && (
        <span
          onClick={(e) => {
            e.stopPropagation()
            onClear?.()
          }}
          style={{
            cursor: 'pointer',
            padding: '2px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
          }}
        >
          <X size={12} />
        </span>
      )}
    </button>
  </div>
))

CustomDateInput.displayName = 'CustomDateInput'

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = '选择日期',
  disabled = false,
  isClearable = false,
  minDate,
  maxDate,
  style,
}) => {
  const selectedDate = value ? new Date(value + 'T00:00:00') : null

  const handleChange = (date: Date | null) => {
    if (!date) {
      onChange('')
      return
    }
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    onChange(`${y}-${m}-${d}`)
  }

  return (
    <div style={{ width: '100%', ...style }}>
      <ReactDatePicker
        selected={selectedDate}
        onChange={handleChange}
        locale="zh-CN"
        dateFormat="yyyy-MM-dd"
        disabled={disabled}
        minDate={minDate}
        maxDate={maxDate}
        customInput={
          <CustomDateInput
            placeholder={placeholder}
            disabled={disabled}
            isClearable={isClearable}
            onClear={() => onChange('')}
          />
        }
        popperPlacement="bottom-start"
        portalId="root"
      />
    </div>
  )
}

export interface MonthPickerProps {
  value: string // YYYY-MM
  onChange: (val: string) => void
  placeholder?: string
  disabled?: boolean
  style?: React.CSSProperties
}

/** 开源月份选择器组件 */
export const MonthPicker: React.FC<MonthPickerProps> = ({
  value,
  onChange,
  placeholder = '选择月份',
  disabled = false,
  style,
}) => {
  const selectedDate = value ? new Date(`${value}-01T00:00:00`) : new Date()

  const handleChange = (date: Date | null) => {
    if (!date) return
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    onChange(`${y}-${m}`)
  }

  return (
    <div style={{ display: 'inline-block', ...style }}>
      <ReactDatePicker
        selected={selectedDate}
        onChange={handleChange}
        locale="zh-CN"
        dateFormat="yyyy-MM"
        showMonthYearPicker
        disabled={disabled}
        customInput={<CustomDateInput placeholder={placeholder} disabled={disabled} />}
        popperPlacement="bottom-start"
        portalId="root"
      />
    </div>
  )
}
