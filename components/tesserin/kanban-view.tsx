import React, { useState, useCallback, useMemo } from "react"
import { FiPlus, FiMenu, FiTrash2, FiCalendar, FiFlag, FiMoreHorizontal, FiClipboard, FiList, FiTool, FiCheckCircle } from "react-icons/fi"
import { SkeuoPanel } from "./skeuo-panel"

/**
 * KanbanView
 *
 * A drag-and-drop Kanban board for task management.
 * Columns: Backlog, To Do, In Progress, Done
 * Tasks can be dragged between columns.
 */

interface Task {
    id: string
    title: string
    status: string
    priority: number // 0=none, 1=low, 2=medium, 3=high
    columnId: string
    dueDate?: string
}

const COLUMNS = [
    { id: "backlog", label: "Backlog", icon: FiClipboard, color: "#64748b" },
    { id: "todo", label: "To Do", icon: FiList, color: "#3b82f6" },
    { id: "in_progress", label: "In Progress", icon: FiTool, color: "#f59e0b" },
    { id: "done", label: "Done", icon: FiCheckCircle, color: "#22c55e" },
]

const PRIORITY_COLORS: Record<number, string> = {
    0: "transparent",
    1: "#3b82f6",
    2: "#f59e0b",
    3: "#ef4444",
}

const PRIORITY_LABELS: Record<number, string> = {
    0: "None",
    1: "Low",
    2: "Medium",
    3: "High",
}

let _taskCounter = 0
function taskId() {
    return `task_${Date.now()}_${++_taskCounter}`
}

const SEED_TASKS: Task[] = [
    { id: taskId(), title: "Set up project architecture", status: "done", priority: 3, columnId: "done" },
    { id: taskId(), title: "Design database schema", status: "done", priority: 2, columnId: "done" },
    { id: taskId(), title: "Implement AI chat integration", status: "in_progress", priority: 3, columnId: "in_progress" },
    { id: taskId(), title: "Build search palette (Cmd+K)", status: "in_progress", priority: 2, columnId: "in_progress" },
    { id: taskId(), title: "Create template system", status: "todo", priority: 1, columnId: "todo" },
    { id: taskId(), title: "Add export to PDF", status: "todo", priority: 1, columnId: "todo" },
    { id: taskId(), title: "Dark/light mode persistence", status: "todo", priority: 2, columnId: "todo" },
    { id: taskId(), title: "Mobile responsive layout", status: "backlog", priority: 0, columnId: "backlog" },
    { id: taskId(), title: "Plugin system architecture", status: "backlog", priority: 0, columnId: "backlog" },
]

export function KanbanView() {
    const [tasks, setTasks] = useState<Task[]>(SEED_TASKS)
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
    const [newTaskTitle, setNewTaskTitle] = useState("")
    const [addingToColumn, setAddingToColumn] = useState<string | null>(null)

    const tasksByColumn = useMemo(() => {
        const map: Record<string, Task[]> = {}
        for (const col of COLUMNS) {
            map[col.id] = tasks.filter(t => t.columnId === col.id)
        }
        return map
    }, [tasks])

    const handleDragStart = useCallback((taskId: string) => {
        setDraggedTaskId(taskId)
    }, [])

    const handleDrop = useCallback((columnId: string) => {
        if (!draggedTaskId) return
        setTasks(prev =>
            prev.map(t =>
                t.id === draggedTaskId ? { ...t, columnId, status: columnId } : t
            )
        )
        setDraggedTaskId(null)
    }, [draggedTaskId])

    const handleAddTask = useCallback((columnId: string) => {
        if (!newTaskTitle.trim()) return
        const task: Task = {
            id: taskId(),
            title: newTaskTitle.trim(),
            status: columnId,
            priority: 0,
            columnId,
        }
        setTasks(prev => [...prev, task])
        setNewTaskTitle("")
        setAddingToColumn(null)
    }, [newTaskTitle])

    const handleDeleteTask = useCallback((id: string) => {
        setTasks(prev => prev.filter(t => t.id !== id))
    }, [])

    const cyclePriority = useCallback((id: string) => {
        setTasks(prev =>
            prev.map(t =>
                t.id === id ? { ...t, priority: (t.priority + 1) % 4 } : t
            )
        )
    }, [])

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div
                className="px-6 py-4 border-b flex items-center justify-between"
                style={{ borderColor: "var(--border-dark)" }}
            >
                <div>
                    <h2
                        className="text-lg font-bold flex items-center gap-2"
                        style={{ color: "var(--text-primary)" }}
                    >
                        <FiClipboard className="text-[#3b82f6]" />
                        Task Board
                    </h2>
                    <p
                        className="text-xs mt-0.5"
                        style={{ color: "var(--text-tertiary)" }}
                    >
                        {tasks.length} tasks · {tasks.filter(t => t.columnId === "done").length} completed
                    </p>
                </div>
            </div>

            {/* Kanban Columns */}
            <div className="flex-1 flex gap-4 p-4 overflow-x-auto custom-scrollbar">
                {COLUMNS.map(column => (
                    <div
                        key={column.id}
                        className="flex-1 min-w-[260px] flex flex-col rounded-2xl"
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => handleDrop(column.id)}
                    >
                        <div
                            className="flex items-center justify-between px-4 py-3 rounded-t-2xl border-b"
                            style={{
                                background: `linear-gradient(to bottom, ${column.color}15, ${column.color}05)`,
                                borderColor: `${column.color}30`,
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <column.icon style={{ color: column.color }} />
                                <span
                                    className="text-sm font-bold"
                                    style={{ color: "var(--text-primary)" }}
                                >
                                    {column.label}
                                </span>
                            </div>
                            <span
                                className="text-xs font-mono px-2 py-0.5 rounded-full"
                                style={{
                                    backgroundColor: "var(--bg-panel-inset)",
                                    color: column.color,
                                    boxShadow: "var(--input-inner-shadow)",
                                }}
                            >
                                {tasksByColumn[column.id]?.length || 0}
                            </span>
                        </div>

                        {/* Tasks List */}
                        <div
                            className="flex-1 p-2 space-y-2 overflow-y-auto custom-scrollbar rounded-b-2xl"
                            style={{ backgroundColor: "var(--bg-panel-inset)" }}
                        >
                            {tasksByColumn[column.id]?.map(task => (
                                <div
                                    key={task.id}
                                    draggable
                                    onDragStart={() => handleDragStart(task.id)}
                                    className="group skeuo-panel rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all hover:scale-[1.02]"
                                    style={{ borderRadius: "12px" }}
                                >
                                    <div className="flex items-start gap-2">
                                        <FiMenu
                                            size={14}
                                            className="mt-0.5 opacity-30 group-hover:opacity-70 transition-opacity shrink-0"
                                            style={{ color: "var(--text-tertiary)" }}
                                        />
                                        <span
                                            className="flex-1 text-sm font-medium leading-snug"
                                            style={{ color: "var(--text-primary)" }}
                                        >
                                            {task.title}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2 ml-6">
                                        <button
                                            onClick={() => cyclePriority(task.id)}
                                            className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md transition-colors"
                                            style={{
                                                backgroundColor: `${PRIORITY_COLORS[task.priority]}20`,
                                                color: PRIORITY_COLORS[task.priority] === "transparent"
                                                    ? "var(--text-tertiary)"
                                                    : PRIORITY_COLORS[task.priority],
                                            }}
                                            title={`Priority: ${PRIORITY_LABELS[task.priority]}`}
                                        >
                                            <FiFlag size={10} />
                                            {PRIORITY_LABELS[task.priority]}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteTask(task.id)}
                                            className="opacity-0 group-hover:opacity-70 transition-opacity ml-auto"
                                            aria-label="Delete task"
                                        >
                                            <FiTrash2
                                                size={12}
                                                style={{ color: "var(--text-tertiary)" }}
                                            />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {/* Add Task Button */}
                            {addingToColumn === column.id ? (
                                <div className="p-2">
                                    <input
                                        autoFocus
                                        value={newTaskTitle}
                                        onChange={e => setNewTaskTitle(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === "Enter") handleAddTask(column.id)
                                            if (e.key === "Escape") setAddingToColumn(null)
                                        }}
                                        onBlur={() => {
                                            if (newTaskTitle.trim()) handleAddTask(column.id)
                                            else setAddingToColumn(null)
                                        }}
                                        className="w-full skeuo-inset px-3 py-2 text-sm rounded-lg focus:outline-none"
                                        style={{ color: "var(--text-primary)" }}
                                        placeholder="Task title..."
                                    />
                                </div>
                            ) : (
                                <button
                                    onClick={() => {
                                        setAddingToColumn(column.id)
                                        setNewTaskTitle("")
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors hover:bg-white/5"
                                    style={{ color: "var(--text-tertiary)" }}
                                >
                                    <FiPlus size={14} />
                                    Add task
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
