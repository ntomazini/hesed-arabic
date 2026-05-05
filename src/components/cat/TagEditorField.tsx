'use client'
import React, {
  useRef, useEffect, useCallback, useImperativeHandle, forwardRef,
} from 'react'

export interface TagEditorHandle {
  focus: () => void
  insertToken: (token: string) => void
}

interface Props {
  value: string
  onChange: (v: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void
  placeholder?: string
  rows?: number
  className?: string
}

// ── Chip style (inline — sobrevive ao execCommand insertHTML) ─────────────────
const CHIP_STYLE =
  'display:inline-flex;align-items:center;background:#fef3c7;color:#92400e;' +
  'border:1px solid #fcd34d;border-radius:4px;padding:0 5px;margin:0 2px;' +
  'font-size:10px;font-family:monospace;font-weight:700;line-height:1.6;' +
  'cursor:grab;user-select:none;vertical-align:middle;white-space:nowrap;'

export function chipHTML(token: string): string {
  const openM  = /^\{(\d+)\}$/.exec(token)
  const closeM = /^\{\/(\d+)\}$/.exec(token)
  if (openM)
    return `<span class="cat-tag-chip" contenteditable="false" draggable="true" data-tag="${token}" style="${CHIP_STYLE}" title="Tag ${openM[1]} — arraste para reposicionar">${openM[1]}&#9658;</span>`
  if (closeM)
    return `<span class="cat-tag-chip" contenteditable="false" draggable="true" data-tag="${token}" style="${CHIP_STYLE}" title="Tag fechamento ${closeM[1]} — arraste para reposicionar">&#9668;${closeM[1]}</span>`
  return ''
}

function buildHTML(str: string): string {
  if (!str) return ''
  return str
    .split(/(\{\/?\d+\})/g)
    .map(p => /^\{\/?\d+\}$/.test(p)
      ? chipHTML(p)
      : p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
    .join('')
}

function readDOM(el: HTMLElement): string {
  let out = ''
  el.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? ''
    } else if (node instanceof HTMLElement) {
      if (node.dataset.dropIndicator) { /* skip — visual-only element */ }
      else if (node.dataset.tag)      out += node.dataset.tag
      else if (node.tagName === 'BR') out += '\n'
      else                            out += readDOM(node)
    }
  })
  return out
}

// ── Componente ────────────────────────────────────────────────────────────────

const TagEditorField = forwardRef<TagEditorHandle, Props>(function TagEditorField(
  { value, onChange, onKeyDown, placeholder, rows = 3, className = '' },
  ref,
) {
  const divRef      = useRef<HTMLDivElement>(null)
  const lastEmitted = useRef<string>('')
  const dragging    = useRef<HTMLElement | null>(null)
  const ownUpdate   = useRef(false)
  // Ref estável para syncToParent — usado nos listeners nativos sem criar closure stale
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  function syncToParent() {
    const el = divRef.current
    if (!el) return
    if (dragging.current) return  // don't sync while drag is in progress
    const v = readDOM(el)
    lastEmitted.current = v
    ownUpdate.current = true
    onChangeRef.current(v)
    requestAnimationFrame(() => { ownUpdate.current = false })
  }

  // ── Expõe métodos ao pai ──────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    focus: () => divRef.current?.focus(),
    insertToken: (token: string) => {
      const el = divRef.current
      if (!el) return
      el.focus()
      document.execCommand('insertHTML', false, chipHTML(token))
      syncToParent()
    },
  }))

  // ── Inicialização no mount (CRÍTICO) ──────────────────────────────────────
  useEffect(() => {
    const el = divRef.current
    if (!el) return
    el.innerHTML = buildHTML(value)
    lastEmitted.current = value

    // ── Listeners nativos de drag (MAIS CONFIÁVEIS que React synthetic events
    //    para elementos criados via innerHTML dentro de contenteditable) ──────
    //
    // POR QUE NATIVOS? React's onDragStart via evento sintético falha em
    // alguns browsers quando o elemento arrastável está dentro de
    // contenteditable — o browser inicia "text-selection drag" antes de
    // disparar dragstart no elemento filho.
    //
    // POR QUE NÃO onMouseDown preventDefault? Prevenir o mousedown bloqueia
    // a inicialização do drag pelo browser. Remover isso e usar os listeners
    // nativos de dragstart diretamente resolve o problema.

    function onNativeDragStart(e: DragEvent) {
      const chip = (e.target as HTMLElement).closest?.('[data-tag]') as HTMLElement | null
      if (!chip) return  // deixa browser gerenciar drag de texto normal
      dragging.current = chip
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', chip.dataset.tag ?? '')
      }
      setTimeout(() => {
        if (dragging.current) dragging.current.style.opacity = '0.35'
      }, 0)
    }

    // ── Drop indicator — visual yellow bar showing insertion point ──────────
    let dropIndicator: HTMLSpanElement | null = null

    function getDropIndicator(): HTMLSpanElement {
      if (!dropIndicator) {
        dropIndicator = document.createElement('span')
        dropIndicator.dataset.dropIndicator = 'true'
        dropIndicator.contentEditable = 'false'
        dropIndicator.style.cssText =
          'display:inline-block;width:3px;height:1.6em;background:#f59e0b;' +
          'vertical-align:middle;margin:0 3px;pointer-events:none;border-radius:2px;' +
          'box-shadow:0 0 8px 2px #fbbf24;'
      }
      return dropIndicator
    }

    function removeDropIndicator() {
      dropIndicator?.remove()
      // keep the variable — same element reused
    }

    function onNativeDragEnd() {
      if (dragging.current) {
        dragging.current.style.opacity = '1'
        dragging.current = null
      }
      removeDropIndicator()
    }

    function onNativeDragOver(e: DragEvent) {
      if (!dragging.current) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'

      // ── Show / move the drop indicator ─────────────────────────────────
      let range: Range | null = null
      if (document.caretRangeFromPoint) {
        range = document.caretRangeFromPoint(e.clientX, e.clientY)
      } else {
        const pos = (document as unknown as {
          caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
        }).caretPositionFromPoint?.(e.clientX, e.clientY)
        if (pos) {
          range = document.createRange()
          range.setStart(pos.offsetNode, pos.offset)
        }
      }
      if (!range) return
      const anchor = range.startContainer
      // Don't insert inside the dragged chip itself
      if (dragging.current.contains(anchor as Node) || anchor === dragging.current) return
      const indicator = getDropIndicator()
      indicator.remove()          // detach from previous position
      range.collapse(true)
      range.insertNode(indicator) // re-attach at new position
    }

    function onNativeDrop(e: DragEvent) {
      if (!dragging.current) return
      e.preventDefault()
      e.stopPropagation()
      removeDropIndicator()
      const chip = dragging.current

      // Posição do caret no ponto de drop (cross-browser)
      let range: Range | null = null
      if (document.caretRangeFromPoint) {
        range = document.caretRangeFromPoint(e.clientX, e.clientY)
      } else {
        const pos = (document as unknown as {
          caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
        }).caretPositionFromPoint?.(e.clientX, e.clientY)
        if (pos) {
          range = document.createRange()
          range.setStart(pos.offsetNode, pos.offset)
        }
      }

      chip.style.opacity = '1'
      chip.remove()

      if (range) {
        range.collapse(true)
        range.insertNode(chip)
        range.setStartAfter(chip)
        range.collapse(true)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        divRef.current!.appendChild(chip)
      }

      dragging.current = null
      syncToParent()
    }

    el.addEventListener('dragstart', onNativeDragStart)
    el.addEventListener('dragend',   onNativeDragEnd)
    el.addEventListener('dragover',  onNativeDragOver)
    el.addEventListener('drop',      onNativeDrop)

    return () => {
      el.removeEventListener('dragstart', onNativeDragStart)
      el.removeEventListener('dragend',   onNativeDragEnd)
      el.removeEventListener('dragover',  onNativeDragOver)
      el.removeEventListener('drop',      onNativeDrop)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sincroniza quando pai atualiza o valor externamente (IA, TM match) ────
  useEffect(() => {
    const el = divRef.current
    if (!el || ownUpdate.current) return
    if (value === lastEmitted.current) return
    lastEmitted.current = value
    const hadFocus = document.activeElement === el
    el.innerHTML = buildHTML(value)
    if (hadFocus) {
      el.focus()
      const range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  }, [value])

  const handleInput = useCallback(() => { syncToParent() }, []) // eslint-disable-line

  // Paste: só texto puro
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
  }, [])

  return (
    <div
      ref={divRef}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={onKeyDown}
      onPaste={handlePaste}
      data-placeholder={placeholder}
      spellCheck
      className={[
        'w-full text-sm text-slate-800 leading-relaxed',
        'border border-[#1e3a5f]/30 rounded-lg px-3 py-2',
        'focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f]',
        'bg-white',
        'empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300 empty:before:pointer-events-none',
        className,
      ].join(' ')}
      style={{ minHeight: `${Math.max(2, rows) * 1.75}rem` }}
    />
  )
})

export default TagEditorField
