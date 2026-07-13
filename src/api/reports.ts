import { api } from './client'
import type { Report, ReportReason, ReportStatus } from '@/shared/types'

export interface CreateReportInput {
  targetType: 'video' | 'comment' | 'channel'
  targetId: string
  reason: ReportReason
  details?: string
}

export function createReport(input: CreateReportInput): Promise<Report> {
  return api<Report>('/api/reports', { method: 'POST', body: input })
}

export function fetchReports(status?: ReportStatus): Promise<Report[]> {
  return api<Report[]>('/api/admin/reports', { query: { status } })
}

export function resolveReport(
  id: string,
  status: 'reviewing' | 'resolved' | 'dismissed',
  resolution = '',
): Promise<void> {
  return api(`/api/admin/reports/${id}/resolve`, {
    method: 'POST',
    body: { status, resolution },
  })
}
