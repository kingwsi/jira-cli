import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { api } from '../api/client'
import { Project } from '../types'
import { DatePicker } from './DatePicker'

interface QuickCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (createdKey: string) => void
}

export const QuickCreateModal: React.FC<QuickCreateModalProps> = ({ isOpen, onClose, onCreated }) => {
  const [projects, setProjects] = useState<Project[]>([])
  const [project, setProject] = useState('DSYFB')
  const [issueType, setIssueType] = useState('Task')
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [parentKey, setParentKey] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      api.getProjects()
        .then((list) => {
          setProjects(list)
          if (list.length > 0 && !project) {
            setProject(list[0].key)
          }
        })
        .catch(() => {})
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!summary.trim()) {
      alert('请填写任务概要')
      return
    }

    setLoading(true)
    try {
      const created = await api.createIssue({
        project,
        issueType,
        summary: summary.trim(),
        description: description.trim(),
        parentKey: parentKey.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      })
      alert(`创建成功: ${created.key}`)
      onCreated(created.key)
      onClose()
    } catch (err: any) {
      alert('创建失败: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div data-ui="modal-backdrop" onClick={onClose} />
      <div data-ui="modal-content">
        <div data-ui="modal-header">
          <div data-ui="card-title">新建任务 / 缺陷</div>
          <button data-ui="button" data-variant="ghost" onClick={onClose} style={{ padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div data-ui="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div data-ui="form-group">
                <label data-ui="form-label">所属项目</label>
                <select
                  data-ui="select"
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                >
                  {projects.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.name} ({p.key})
                    </option>
                  ))}
                  {projects.length === 0 && <option value="DSYFB">DSYFB</option>}
                </select>
              </div>

              <div data-ui="form-group">
                <label data-ui="form-label">类型</label>
                <select
                  data-ui="select"
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                >
                  <option value="Task">任务 (Task)</option>
                  <option value="Bug">缺陷 (Bug)</option>
                  <option value="Story">故事 (Story)</option>
                  <option value="Sub-task">子任务 (Sub-task)</option>
                </select>
              </div>
            </div>

            <div data-ui="form-group">
              <label data-ui="form-label">概要 (Summary) *</label>
              <input
                data-ui="input"
                placeholder="简明扼要描述该任务..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                required
              />
            </div>

            <div data-ui="form-group">
              <label data-ui="form-label">父任务 Key (可选，如 DSYFB-100)</label>
              <input
                data-ui="input"
                placeholder="例如: DSYFB-100"
                value={parentKey}
                onChange={(e) => setParentKey(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div data-ui="form-group">
                <label data-ui="form-label">预计开始日期</label>
                <DatePicker
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="选择预计开始日期"
                  isClearable
                />
              </div>

              <div data-ui="form-group">
                <label data-ui="form-label">预计完成日期</label>
                <DatePicker
                  value={endDate}
                  onChange={setEndDate}
                  placeholder="选择预计完成日期"
                  isClearable
                />
              </div>
            </div>

            <div data-ui="form-group">
              <label data-ui="form-label">描述</label>
              <textarea
                data-ui="textarea"
                placeholder="详细说明或验收标准..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div data-ui="modal-footer">
            <button type="button" data-ui="button" onClick={onClose}>
              取消
            </button>
            <button
              type="submit"
              data-ui="button"
              data-variant="primary"
              disabled={loading}
            >
              {loading ? '创建中...' : '立即创建'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
