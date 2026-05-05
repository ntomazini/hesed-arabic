'use client'

import { useRef, useEffect } from 'react'
import SegmentItem from './SegmentItem'
import type { Segment } from '@/types'

interface SegmentListProps {
  segments: Segment[]
  activeSegmentId: string | null
  onSegmentClick: (id: string) => void
  onSegmentConfirm: (id: string, text: string) => void
  onSegmentFlag: (id: string) => void
  onSegmentReject?: (id: string, comment: string) => void
  role: 'editor' | 'revisor'
}

export default function SegmentList({
  segments,
  activeSegmentId,
  onSegmentClick,
  onSegmentConfirm,
  onSegmentFlag,
  onSegmentReject,
  role,
}: SegmentListProps) {
  const activeRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to active segment
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    }
  }, [activeSegmentId])

  if (segments.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
        Nenhum segmento encontrado.
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {segments.map((segment) => {
        const isActive = segment.id === activeSegmentId

        return (
          <div
            key={segment.id}
            ref={isActive ? activeRef : null}
            onClick={() => onSegmentClick(segment.id)}
            className="cursor-pointer"
          >
            <SegmentItem
              segment={segment}
              isActive={isActive}
              onConfirm={(text) => onSegmentConfirm(segment.id, text)}
              onFlag={() => onSegmentFlag(segment.id)}
              onReject={onSegmentReject ? (comment) => onSegmentReject(segment.id, comment) : undefined}
              role={role}
            />
          </div>
        )
      })}
    </div>
  )
}
