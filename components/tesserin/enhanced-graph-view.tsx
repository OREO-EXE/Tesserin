"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { FiZoomIn, FiZoomOut, FiMaximize } from "react-icons/fi"

/**
 * EnhancedGraphView
 *
 * A fully interactive, force-directed graph visualisation built with
 * pure SVG and a custom physics simulation (no D3 dependency).
 *
 * Features:
 * - **Repulsion** – Coulomb-like repulsion between all node pairs.
 * - **Attraction** – Spring-force attraction along edges.
 * - **Center gravity** – Gentle pull toward the viewport centre.
 * - **Pan & zoom** – Mouse-wheel zoom and click-drag panning.
 * - **Node dragging** – Click-drag any node; physics resumes on release.
 * - **Hover highlighting** – Dims unrelated nodes/edges on hover.
 *
 * @example
 * ```tsx
 * <EnhancedGraphView />
 * ```
 */

/* ------------------------------------------------------------------ */
/*  Type definitions                                                    */
/* ------------------------------------------------------------------ */

interface GraphNode {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  label: string
  group: number
}

interface GraphLink {
  source: number
  target: number
}

interface Transform {
  x: number
  y: number
  k: number
}

interface DragState {
  id: number | "pan"
  startX: number
  startY: number
  initialTx?: number
  initialTy?: number
}

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const NODE_COUNT = 40
const REPULSION_STRENGTH = 200
const SPRING_REST_LENGTH = 100
const SPRING_K = 0.005
const CENTER_GRAVITY = 0.0005
const DAMPING = 0.9
const MAX_FORCE = 50
const MIN_DIST = 0.1

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export function EnhancedGraphView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [links, setLinks] = useState<GraphLink[]>([])
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 1 })
  const [dragging, setDragging] = useState<DragState | null>(null)
  const [hoveredNode, setHoveredNode] = useState<number | null>(null)

  /* ---- Initialise random cluster data ---- */
  useEffect(() => {
    const newNodes: GraphNode[] = Array.from({ length: NODE_COUNT }).map((_, i) => ({
      id: i,
      x: Math.random() * 800 - 400,
      y: Math.random() * 600 - 300,
      vx: 0,
      vy: 0,
      radius: i === 0 ? 12 : Math.random() * 4 + 4,
      label: i === 0 ? "Core" : `Node ${i}`,
      group: Math.floor(Math.random() * 5),
    }))

    const newLinks: GraphLink[] = []
    for (let i = 1; i < NODE_COUNT; i++) {
      newLinks.push({ source: i, target: Math.floor(Math.random() * i) })
      if (Math.random() > 0.8) {
        newLinks.push({ source: i, target: Math.floor(Math.random() * NODE_COUNT) })
      }
    }

    setNodes(newNodes)
    setLinks(newLinks)

    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect()
      setTransform({ x: width / 2, y: height / 2, k: 0.8 })
    }
  }, [])

  /* ---- Physics simulation loop ---- */
  useEffect(() => {
    let frame: number

    const tick = () => {
      setNodes((prev) => {
        if (prev.length === 0) return prev
        const next = prev.map((n) => ({ ...n }))

        // 1. Repulsion
        for (let i = 0; i < next.length; i++) {
          for (let j = i + 1; j < next.length; j++) {
            const dx = next[i].x - next[j].x
            const dy = next[i].y - next[j].y
            let dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < MIN_DIST) dist = MIN_DIST

            const force = REPULSION_STRENGTH / (dist * dist)
            const fx = (dx / dist) * Math.min(force, MAX_FORCE)
            const fy = (dy / dist) * Math.min(force, MAX_FORCE)

            if (dragging?.id !== next[i].id) {
              next[i].vx += fx
              next[i].vy += fy
            }
            if (dragging?.id !== next[j].id) {
              next[j].vx -= fx
              next[j].vy -= fy
            }
          }
        }

        // 2. Spring attraction along edges
        links.forEach((link) => {
          const src = next.find((n) => n.id === link.source)
          const tgt = next.find((n) => n.id === link.target)
          if (!src || !tgt) return

          const dx = tgt.x - src.x
          const dy = tgt.y - src.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const force = (dist - SPRING_REST_LENGTH) * SPRING_K

          if (dragging?.id !== src.id) {
            src.vx += dx * force
            src.vy += dy * force
          }
          if (dragging?.id !== tgt.id) {
            tgt.vx -= dx * force
            tgt.vy -= dy * force
          }
        })

        // 3. Center gravity, damping, position update
        next.forEach((node) => {
          if (dragging?.id === node.id) return
          node.vx -= node.x * CENTER_GRAVITY
          node.vy -= node.y * CENTER_GRAVITY
          node.vx *= DAMPING
          node.vy *= DAMPING
          if (!isNaN(node.vx)) node.x += node.vx
          if (!isNaN(node.vy)) node.y += node.vy
        })

        return next
      })

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [links, dragging])

  /* ---- Interaction handlers ---- */

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const factor = 1.1
    const dir = e.deltaY > 0 ? 1 / factor : factor
    setTransform((t) => ({ ...t, k: Math.min(Math.max(0.1, t.k * dir), 4) }))
  }, [])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, nodeId?: number) => {
      if (nodeId !== undefined) {
        e.stopPropagation()
        setDragging({ id: nodeId, startX: e.clientX, startY: e.clientY })
      } else {
        setDragging({
          id: "pan",
          startX: e.clientX,
          startY: e.clientY,
          initialTx: transform.x,
          initialTy: transform.y,
        })
      }
    },
    [transform],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return

      if (dragging.id === "pan") {
        const dx = e.clientX - dragging.startX
        const dy = e.clientY - dragging.startY
        setTransform((prev) => ({
          ...prev,
          x: (dragging.initialTx ?? 0) + dx,
          y: (dragging.initialTy ?? 0) + dy,
        }))
      } else {
        const dx = (e.clientX - dragging.startX) / transform.k
        const dy = (e.clientY - dragging.startY) / transform.k

        setNodes((prev) =>
          prev.map((n) => {
            if (n.id === dragging.id) {
              return { ...n, x: n.x + dx, y: n.y + dy, vx: 0, vy: 0 }
            }
            return n
          }),
        )
        setDragging((prev) => (prev ? { ...prev, startX: e.clientX, startY: e.clientY } : null))
      }
    },
    [dragging, transform.k],
  )

  const handleMouseUp = useCallback(() => setDragging(null), [])

  /** Returns `true` if the link connects to the hovered node */
  const isRelated = (link: GraphLink) =>
    hoveredNode !== null && (link.source === hoveredNode || link.target === hoveredNode)

  /* ---- Zoom controls ---- */

  const zoomIn = () => setTransform((t) => ({ ...t, k: t.k * 1.2 }))
  const zoomOut = () => setTransform((t) => ({ ...t, k: t.k * 0.8 }))
  const resetView = () => {
    if (!containerRef.current) return
    const { width, height } = containerRef.current.getBoundingClientRect()
    setTransform({ x: width / 2, y: height / 2, k: 0.8 })
  }

  /* ---- Render ---- */

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden"
      style={{
        backgroundColor: "var(--bg-app)",
        cursor: dragging?.id === "pan" ? "grabbing" : "grab",
      }}
      onWheel={handleWheel}
      onMouseDown={(e) => handleMouseDown(e)}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      role="application"
      aria-label="Interactive force-directed graph"
    >
      <svg className="w-full h-full pointer-events-none">
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
          {/* Edges */}
          {links.map((link, i) => {
            const source = nodes.find((n) => n.id === link.source)
            const target = nodes.find((n) => n.id === link.target)

            if (
              !source ||
              !target ||
              isNaN(source.x) ||
              isNaN(target.x) ||
              isNaN(source.y) ||
              isNaN(target.y)
            )
              return null

            const highlight = isRelated(link)
            return (
              <line
                key={`link-${i}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={highlight ? "var(--accent-primary)" : "var(--text-tertiary)"}
                strokeWidth={highlight ? 2 : 1}
                strokeOpacity={highlight ? 1 : 0.2}
                className="transition-colors duration-200"
              />
            )
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const isActive =
              hoveredNode !== null &&
              hoveredNode !== node.id &&
              !links.some(
                (l) =>
                  (l.source === node.id && l.target === hoveredNode) ||
                  (l.target === node.id && l.source === hoveredNode),
              )

            return (
              <g
                key={`node-${node.id}`}
                transform={`translate(${!isNaN(node.x) ? node.x : 0}, ${!isNaN(node.y) ? node.y : 0})`}
                className="pointer-events-auto cursor-pointer transition-opacity duration-300"
                style={{ opacity: isActive ? 0.3 : 1 }}
                onMouseDown={(e) => handleMouseDown(e, node.id)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                <circle
                  r={node.radius}
                  fill={node.id === 0 ? "var(--accent-primary)" : "var(--bg-panel)"}
                  stroke={node.id === 0 ? "var(--accent-primary)" : "var(--text-secondary)"}
                  strokeWidth={2}
                />
                {(hoveredNode === node.id || node.id === 0) && (
                  <text
                    y={-node.radius - 8}
                    textAnchor="middle"
                    fill="var(--text-primary)"
                    fontSize={12}
                    fontWeight="bold"
                    className="pointer-events-none select-none"
                    style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" }}
                  >
                    {node.label}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {/* Zoom controls */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2">
        <button
          onClick={zoomIn}
          className="skeuo-btn w-10 h-10 flex items-center justify-center rounded-lg"
          aria-label="Zoom in"
        >
          <FiZoomIn size={18} />
        </button>
        <button
          onClick={zoomOut}
          className="skeuo-btn w-10 h-10 flex items-center justify-center rounded-lg"
          aria-label="Zoom out"
        >
          <FiZoomOut size={18} />
        </button>
        <button
          onClick={resetView}
          className="skeuo-btn w-10 h-10 flex items-center justify-center rounded-lg"
          aria-label="Reset view"
        >
          <FiMaximize size={18} />
        </button>
      </div>

      {/* HUD badge */}
      <div className="absolute top-6 left-6 skeuo-panel px-4 py-2 text-xs font-mono opacity-80 pointer-events-none">
        {"NODES: "}{nodes.length}{" | PHYSICS: ACTIVE"}
      </div>
    </div>
  )
}
