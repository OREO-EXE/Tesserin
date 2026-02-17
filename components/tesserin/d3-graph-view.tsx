"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
import * as d3 from "d3"
import { FiZoomIn, FiZoomOut, FiMaximize, FiChevronDown } from "react-icons/fi"
import { useNotes, type GraphNode, type GraphLink } from "@/lib/notes-store"

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

/**
 * Available graph layout modes.
 *
 * - `force`  -- D3 force-directed simulation (Zettelkasten style)
 * - `radial` -- D3 cluster arranged in a radial arc
 * - `mind`   -- D3 tree layout branching from the most-connected node
 */
type GraphMode = "force" | "radial" | "mind"

/** Internal node type used by D3 simulations */
interface SimNode extends d3.SimulationNodeDatum {
  id: string
  title: string
  linkCount: number
}

/** Internal link type used by D3 simulations */
interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  source: string | SimNode
  target: string | SimNode
}

/* ------------------------------------------------------------------ */
/*  Mode metadata                                                       */
/* ------------------------------------------------------------------ */

const MODES: { id: GraphMode; label: string }[] = [
  { id: "force", label: "Force Graph" },
  { id: "mind", label: "Mind Map" },
  { id: "radial", label: "Radial" },
]

/* ------------------------------------------------------------------ */
/*  Utility: build hierarchy for tree / radial layouts                  */
/* ------------------------------------------------------------------ */

interface HierarchyDatum {
  id: string
  title: string
  linkCount: number
  children: HierarchyDatum[]
}

/**
 * Build a pseudo-hierarchy from a flat graph. The root is the node with
 * the highest link count. BFS assigns parent-child relationships.
 */
function buildHierarchy(nodes: GraphNode[], links: GraphLink[]): HierarchyDatum {
  if (nodes.length === 0) {
    return { id: "empty", title: "No Notes", linkCount: 0, children: [] }
  }

  // Pick root = most connected node
  const sorted = [...nodes].sort((a, b) => b.linkCount - a.linkCount)
  const rootId = sorted[0].id

  // Adjacency list (undirected)
  const adj = new Map<string, Set<string>>()
  nodes.forEach((n) => adj.set(n.id, new Set()))
  links.forEach((l) => {
    adj.get(l.source)?.add(l.target)
    adj.get(l.target)?.add(l.source)
  })

  // BFS to build tree
  const visited = new Set<string>([rootId])
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  function buildNode(id: string): HierarchyDatum {
    const n = nodeMap.get(id)!
    const children: HierarchyDatum[] = []
    const neighbors = adj.get(id) ?? new Set()

    neighbors.forEach((nid) => {
      if (!visited.has(nid)) {
        visited.add(nid)
        children.push(buildNode(nid))
      }
    })

    return {
      id: n.id,
      title: n.title,
      linkCount: n.linkCount,
      children,
    }
  }

  const root = buildNode(rootId)

  // Add orphan nodes as children of root
  nodes.forEach((n) => {
    if (!visited.has(n.id)) {
      root.children.push({
        id: n.id,
        title: n.title,
        linkCount: n.linkCount,
        children: [],
      })
    }
  })

  return root
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

/**
 * D3GraphView
 *
 * A D3.js-powered interactive knowledge graph visualization that renders
 * note connections as an Obsidian-style Zettelkasten graph. Supports three
 * layout modes: Force-Directed, Mind Map (tree), and Radial (cluster).
 *
 * Features:
 * - Pan and zoom via D3 zoom behavior
 * - Node dragging (force mode)
 * - Click-to-navigate: clicking a node selects that note in the editor
 * - Hover highlighting with dimming of unrelated nodes/edges
 * - Graph mode switching with animated transitions
 * - HUD showing node/link count and active mode
 *
 * @example
 * ```tsx
 * <D3GraphView />
 * ```
 */
export function D3GraphView() {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<GraphMode>("force")
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const { graph, selectNote, selectedNoteId } = useNotes()

  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)

  /* ---- Main D3 render effect ---- */
  const renderGraph = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return

    const svg = d3.select(svgRef.current)
    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Clean up previous
    svg.selectAll("*").remove()
    if (simulationRef.current) {
      simulationRef.current.stop()
      simulationRef.current = null
    }

    // Prepare data copies
    const simNodes: SimNode[] = graph.nodes.map((n) => ({
      ...n,
      x: undefined,
      y: undefined,
    }))
    const simLinks: SimLink[] = graph.links.map((l) => ({
      source: l.source,
      target: l.target,
    }))

    // Zoom layer
    const g = svg.append("g")

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 6])
      .on("zoom", (event) => {
        g.attr("transform", event.transform)
      })

    svg.call(zoom)
    zoomRef.current = zoom

    // Initial transform: center
    const initialTransform = d3.zoomIdentity.translate(width / 2, height / 2).scale(0.85)
    svg.call(zoom.transform, initialTransform)

    /* ---- Shared rendering helpers ---- */

    function renderLinks(links: { sx: number; sy: number; tx: number; ty: number; sourceId: string; targetId: string }[]) {
      g.selectAll(".graph-link")
        .data(links)
        .enter()
        .append("line")
        .attr("class", "graph-link")
        .attr("x1", (d) => d.sx)
        .attr("y1", (d) => d.sy)
        .attr("x2", (d) => d.tx)
        .attr("y2", (d) => d.ty)
        .attr("stroke", "var(--text-tertiary)")
        .attr("stroke-width", 1.5)
        .attr("stroke-opacity", 0.3)
    }

    function renderNodes(
      positions: { id: string; title: string; linkCount: number; x: number; y: number }[],
      draggable: boolean,
    ) {
      const nodeGroup = g
        .selectAll(".graph-node")
        .data(positions, (d: any) => d.id)
        .enter()
        .append("g")
        .attr("class", "graph-node")
        .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
        .style("cursor", "pointer")
        .on("click", (_event, d) => {
          selectNote(d.id)
        })
        .on("mouseenter", (_event, d) => {
          setHoveredNode(d.id)
        })
        .on("mouseleave", () => {
          setHoveredNode(null)
        })

      // Node circle
      nodeGroup
        .append("circle")
        .attr("r", (d) => Math.max(6, Math.min(18, 6 + d.linkCount * 2.5)))
        .attr("fill", (d) =>
          d.id === selectedNoteId ? "var(--accent-primary)" : "var(--graph-node)",
        )
        .attr("stroke", (d) =>
          d.id === selectedNoteId ? "var(--accent-pressed)" : "var(--text-secondary)",
        )
        .attr("stroke-width", (d) => (d.id === selectedNoteId ? 3 : 1.5))
        .style("filter", (d) =>
          d.id === selectedNoteId ? "drop-shadow(0 0 8px var(--accent-primary))" : "none",
        )
        .style("transition", "fill 0.2s, stroke 0.2s, filter 0.2s")

      // Label
      nodeGroup
        .append("text")
        .text((d) => d.title)
        .attr("y", (d) => -(Math.max(6, Math.min(18, 6 + d.linkCount * 2.5)) + 8))
        .attr("text-anchor", "middle")
        .attr("fill", "var(--text-primary)")
        .attr("font-size", 11)
        .attr("font-weight", 600)
        .attr("font-family", "var(--font-sans)")
        .style("pointer-events", "none")
        .style("filter", "drop-shadow(0 1px 2px rgba(0,0,0,0.5))")
        .style("opacity", 0)
        .style("transition", "opacity 0.2s")

      // Show labels on hover and for selected
      nodeGroup.on("mouseenter.label", function () {
        d3.select(this).select("text").style("opacity", 1)
      })
      nodeGroup.on("mouseleave.label", function (_event, d: any) {
        if (d.id !== selectedNoteId) {
          d3.select(this).select("text").style("opacity", 0)
        }
      })

      // Always show selected node label
      nodeGroup.each(function (d: any) {
        if (d.id === selectedNoteId) {
          d3.select(this).select("text").style("opacity", 1)
        }
      })

      if (draggable && simulationRef.current) {
        const sim = simulationRef.current
        nodeGroup.call(
          d3
            .drag<SVGGElement, any>()
            .on("start", (event, d) => {
              if (!event.active) sim.alphaTarget(0.3).restart()
              d.fx = d.x
              d.fy = d.y
            })
            .on("drag", (event, d) => {
              d.fx = event.x
              d.fy = event.y
            })
            .on("end", (event, d) => {
              if (!event.active) sim.alphaTarget(0)
              d.fx = null
              d.fy = null
            }),
        )
      }

      return nodeGroup
    }

    /* ---- FORCE MODE ---- */
    if (mode === "force") {
      const simulation = d3
        .forceSimulation<SimNode>(simNodes)
        .force(
          "link",
          d3
            .forceLink<SimNode, SimLink>(simLinks)
            .id((d) => d.id)
            .distance(120),
        )
        .force("charge", d3.forceManyBody().strength(-300).distanceMax(500))
        .force("center", d3.forceCenter(0, 0))
        .force("collision", d3.forceCollide().radius(25))
        .alphaDecay(0.02)

      simulationRef.current = simulation

      // Links
      const linkSelection = g
        .selectAll(".graph-link")
        .data(simLinks)
        .enter()
        .append("line")
        .attr("class", "graph-link")
        .attr("stroke", "var(--text-tertiary)")
        .attr("stroke-width", 1.5)
        .attr("stroke-opacity", 0.25)

      // Nodes
      const nodeGroup = g
        .selectAll(".graph-node")
        .data(simNodes, (d: any) => d.id)
        .enter()
        .append("g")
        .attr("class", "graph-node")
        .style("cursor", "pointer")
        .on("click", (_event, d) => selectNote(d.id))
        .on("mouseenter", (_event, d) => setHoveredNode(d.id))
        .on("mouseleave", () => setHoveredNode(null))

      nodeGroup
        .append("circle")
        .attr("r", (d) => Math.max(6, Math.min(18, 6 + d.linkCount * 2.5)))
        .attr("fill", (d) =>
          d.id === selectedNoteId ? "var(--accent-primary)" : "var(--graph-node)",
        )
        .attr("stroke", (d) =>
          d.id === selectedNoteId ? "var(--accent-pressed)" : "var(--text-secondary)",
        )
        .attr("stroke-width", (d) => (d.id === selectedNoteId ? 3 : 1.5))
        .style("filter", (d) =>
          d.id === selectedNoteId ? "drop-shadow(0 0 8px var(--accent-primary))" : "none",
        )

      nodeGroup
        .append("text")
        .text((d) => d.title)
        .attr("y", (d) => -(Math.max(6, Math.min(18, 6 + d.linkCount * 2.5)) + 8))
        .attr("text-anchor", "middle")
        .attr("fill", "var(--text-primary)")
        .attr("font-size", 11)
        .attr("font-weight", 600)
        .attr("font-family", "var(--font-sans)")
        .style("pointer-events", "none")
        .style("filter", "drop-shadow(0 1px 2px rgba(0,0,0,0.5))")
        .style("opacity", (d) => (d.id === selectedNoteId ? 1 : 0))

      nodeGroup.on("mouseenter.label", function () {
        d3.select(this).select("text").style("opacity", 1)
      })
      nodeGroup.on("mouseleave.label", function (_event, d: any) {
        if (d.id !== selectedNoteId) {
          d3.select(this).select("text").style("opacity", 0)
        }
      })

      // Drag behaviour
      nodeGroup.call(
        d3
          .drag<SVGGElement, SimNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x
            d.fy = d.y
          })
          .on("drag", (event, d) => {
            d.fx = event.x
            d.fy = event.y
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null
            d.fy = null
          }),
      )

      // Tick handler
      simulation.on("tick", () => {
        linkSelection
          .attr("x1", (d) => (d.source as SimNode).x ?? 0)
          .attr("y1", (d) => (d.source as SimNode).y ?? 0)
          .attr("x2", (d) => (d.target as SimNode).x ?? 0)
          .attr("y2", (d) => (d.target as SimNode).y ?? 0)

        nodeGroup.attr(
          "transform",
          (d) => `translate(${d.x ?? 0}, ${d.y ?? 0})`,
        )
      })
    }

    /* ---- MIND MAP (Tree) MODE ---- */
    if (mode === "mind") {
      const hierarchy = buildHierarchy(graph.nodes, graph.links)
      const root = d3.hierarchy(hierarchy)
      const treeLayout = d3
        .tree<HierarchyDatum>()
        .size([height * 0.8, width * 0.7])
        .separation((a, b) => (a.parent === b.parent ? 1.2 : 2))

      treeLayout(root)

      // Offset to center
      const offsetX = -(width * 0.35)
      const offsetY = -(height * 0.4)

      // Links as curved paths
      g.selectAll(".graph-link")
        .data(root.links())
        .enter()
        .append("path")
        .attr("class", "graph-link")
        .attr("d", (d) => {
          const sx = (d.source as any).y + offsetX
          const sy = (d.source as any).x + offsetY
          const tx = (d.target as any).y + offsetX
          const ty = (d.target as any).x + offsetY
          return `M${sx},${sy} C${(sx + tx) / 2},${sy} ${(sx + tx) / 2},${ty} ${tx},${ty}`
        })
        .attr("fill", "none")
        .attr("stroke", "var(--text-tertiary)")
        .attr("stroke-width", 1.5)
        .attr("stroke-opacity", 0.35)

      // Nodes
      const positions = root.descendants().map((d) => ({
        id: d.data.id,
        title: d.data.title,
        linkCount: d.data.linkCount,
        x: (d as any).y + offsetX,
        y: (d as any).x + offsetY,
      }))

      renderNodes(positions, false)
    }

    /* ---- RADIAL MODE ---- */
    if (mode === "radial") {
      const hierarchy = buildHierarchy(graph.nodes, graph.links)
      const root = d3.hierarchy(hierarchy)
      const radius = Math.min(width, height) * 0.38

      const clusterLayout = d3
        .cluster<HierarchyDatum>()
        .size([2 * Math.PI, radius])
        .separation((a, b) => (a.parent === b.parent ? 1 : 2))

      clusterLayout(root)

      // Radial link generator
      const radialLink = d3
        .linkRadial<d3.HierarchyPointLink<HierarchyDatum>, d3.HierarchyPointNode<HierarchyDatum>>()
        .angle((d) => (d as any).x)
        .radius((d) => (d as any).y)

      g.selectAll(".graph-link")
        .data(root.links())
        .enter()
        .append("path")
        .attr("class", "graph-link")
        .attr("d", radialLink as any)
        .attr("fill", "none")
        .attr("stroke", "var(--text-tertiary)")
        .attr("stroke-width", 1.5)
        .attr("stroke-opacity", 0.35)

      // Nodes at radial positions
      const positions = root.descendants().map((d) => {
        const angle = (d as any).x - Math.PI / 2
        const r = (d as any).y
        return {
          id: d.data.id,
          title: d.data.title,
          linkCount: d.data.linkCount,
          x: r * Math.cos(angle),
          y: r * Math.sin(angle),
        }
      })

      renderNodes(positions, false)
    }
  }, [graph, mode, selectNote, selectedNoteId])

  /* ---- Re-render when graph, mode, or selection changes ---- */
  useEffect(() => {
    renderGraph()
    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop()
      }
    }
  }, [renderGraph])

  /* ---- Resize handler ---- */
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(() => renderGraph())
    observer.observe(container)
    return () => observer.disconnect()
  }, [renderGraph])

  /* ---- Zoom controls ---- */
  const handleZoom = useCallback(
    (factor: number) => {
      if (!svgRef.current || !zoomRef.current) return
      const svg = d3.select(svgRef.current)
      svg.transition().duration(300).call(zoomRef.current.scaleBy, factor)
    },
    [],
  )

  const resetView = useCallback(() => {
    if (!svgRef.current || !zoomRef.current || !containerRef.current) return
    const svg = d3.select(svgRef.current)
    const { width, height } = containerRef.current.getBoundingClientRect()
    const t = d3.zoomIdentity.translate(width / 2, height / 2).scale(0.85)
    svg.transition().duration(500).call(zoomRef.current.transform, t)
  }, [])

  /* ---- Render ---- */
  return (
    <div className="flex flex-col h-full w-full">
      {/* Toolbar */}
      <div
        className="h-12 border-b flex items-center px-4 justify-between shrink-0"
        style={{ borderColor: "var(--border-dark)", background: "var(--bg-panel)" }}
      >
        <div className="flex items-center gap-3">
          {/* Graph mode dropdown */}
          <div className="relative">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as GraphMode)}
              className="appearance-none skeuo-btn pl-3 pr-8 py-1.5 rounded-lg text-xs font-semibold focus:outline-none cursor-pointer"
              style={{ color: "var(--text-primary)", minWidth: "130px" }}
              aria-label="Graph layout mode"
            >
              {MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <FiChevronDown
              size={12}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--text-tertiary)" }}
            />
          </div>

          {/* Node count badge */}
          <span
            className="text-[10px] font-mono px-2 py-0.5 rounded-md"
            style={{ color: "var(--text-tertiary)", background: "var(--bg-panel-inset)" }}
          >
            {graph.nodes.length} nodes &middot; {graph.links.length} links
          </span>
        </div>
      </div>

      {/* Graph canvas */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
        style={{ backgroundColor: "var(--bg-app)" }}
      >
        <svg
          ref={svgRef}
          className="w-full h-full"
          role="application"
          aria-label={`Knowledge graph - ${mode} layout with ${graph.nodes.length} notes`}
        />

        {/* Zoom controls */}
        <div className="absolute bottom-6 right-6 flex flex-col gap-2">
          <button
            onClick={() => handleZoom(1.3)}
            className="skeuo-btn w-10 h-10 flex items-center justify-center rounded-lg"
            aria-label="Zoom in"
          >
            <FiZoomIn size={18} />
          </button>
          <button
            onClick={() => handleZoom(0.7)}
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

        {/* Active mode badge */}
        <div
          className="absolute top-4 left-4 skeuo-panel px-4 py-2 text-xs font-mono opacity-70 pointer-events-none select-none"
          style={{ color: "var(--text-secondary)" }}
        >
          MODE: {mode.toUpperCase()} | PHYSICS: {mode === "force" ? "ACTIVE" : "STATIC"}
        </div>
      </div>
    </div>
  )
}
