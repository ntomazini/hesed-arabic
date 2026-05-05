'use client'

import { useParams } from 'next/navigation'
import CATEditor from '@/components/cat/CATEditor'

export default function RevisorCATPage() {
  const { projectId, fileId } = useParams<{ projectId: string; fileId: string }>()
  return <CATEditor projectId={projectId} fileId={fileId} mode="revisor" />
}
