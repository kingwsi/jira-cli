export type UpdateStatus = {
  summary: string; current: string; latest: string; available: boolean; auto: boolean
  supported: boolean; reason: string; busy: boolean; checkedAt: string; error: string
}

export async function requestUpdates(path = '', method = 'GET', body?: unknown): Promise<UpdateStatus> {
  const response = await fetch(`/api/v1/updates${path}`, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.message || '更新请求失败')
  return result.data
}

