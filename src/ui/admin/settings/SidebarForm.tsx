import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVerticalIcon } from 'lucide-react'

import type { SidebarSettings, SidebarWidget, SidebarWidgetType } from '@/shared/config/blog'

import { SettingsFormBar } from '@/ui/admin/settings/SettingsFormBar'
import { SettingsRow, SettingsSection } from '@/ui/admin/settings/SettingsSection'
import { useSettingsForm } from '@/ui/admin/settings/useSettingsForm'
import { FieldLabel } from '@/ui/components/field'
import { Input } from '@/ui/components/input'
import { Switch } from '@/ui/components/switch'

interface SidebarFormProps {
  sidebar: SidebarSettings
}

const WIDGET_LABELS: Record<SidebarWidgetType, string> = {
  search: '搜索框',
  recentPosts: '推荐文章',
  recentComments: '最近评论',
  randomTags: '标签云',
  todayCalendar: '日历组件',
}

const WIDGET_HINTS: Record<SidebarWidgetType, string> = {
  search: '文章标题关键字快速搜索。',
  recentPosts: '从全部文章中随机抽取展示。',
  recentComments: '展示最近的评论摘要。',
  randomTags: '从全部标签里随机抽取展示。',
  todayCalendar: '文章按月份归档的小日历。',
}

function SortableWidgetRow({
  widget,
  index,
  onToggle,
  onCountChange,
}: {
  widget: SidebarWidget
  index: number
  onToggle: (idx: number, enabled: boolean) => void
  onCountChange: (idx: number, count: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.type,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const hasCount = widget.type === 'recentPosts' || widget.type === 'recentComments' || widget.type === 'randomTags'

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-3 rounded-md border border-line bg-canvas p-3">
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="mt-0.5 shrink-0 cursor-grab text-ink-4 active:cursor-grabbing"
        aria-label="拖拽排序"
      >
        <GripVerticalIcon className="size-4" />
      </button>
      <div className="flex-1">
        <SettingsRow label={WIDGET_LABELS[widget.type]} hint={WIDGET_HINTS[widget.type]}>
          <div className="flex items-center gap-3">
            <Switch
              id={`sidebar-${widget.type}`}
              checked={widget.enabled}
              onCheckedChange={(value) => onToggle(index, value === true)}
            />
            <FieldLabel htmlFor={`sidebar-${widget.type}`} className="font-normal">
              启用
            </FieldLabel>
          </div>
        </SettingsRow>
        {hasCount && (
          <div className="mt-2 pl-0">
            <SettingsRow label="显示数量" htmlFor={`sidebar-${widget.type}-count`}>
              <Input
                id={`sidebar-${widget.type}-count`}
                type="number"
                min={0}
                max={100}
                value={widget.count ?? 0}
                onChange={(e) => onCountChange(index, Number.parseInt(e.target.value, 10) || 0)}
              />
            </SettingsRow>
          </div>
        )}
      </div>
    </div>
  )
}

export function SidebarForm({ sidebar }: SidebarFormProps) {
  const { draft, setDraft, isDirty, onSubmit, isPending, status, errorMessage, revert } = useSettingsForm<
    SidebarSettings,
    { widgets: SidebarWidget[] }
  >({
    section: 'sidebar',
    source: sidebar,
    toState: (source) => ({ widgets: [...source.sidebar.widgets] }),
    fromState: (state) => ({ sidebar: { widgets: state.widgets } }),
  })

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setDraft((prev) => {
        const oldIndex = prev.widgets.findIndex((w) => w.type === active.id)
        const newIndex = prev.widgets.findIndex((w) => w.type === over.id)
        return { widgets: arrayMove(prev.widgets, oldIndex, newIndex) }
      })
    }
  }

  function toggleWidget(index: number, enabled: boolean) {
    setDraft((prev) => {
      const next = [...prev.widgets]
      next[index] = { ...next[index], enabled }
      return { widgets: next }
    })
  }

  function setCount(index: number, count: number) {
    setDraft((prev) => {
      const next = [...prev.widgets]
      next[index] = { ...next[index], count }
      return { widgets: next }
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <SettingsSection title="侧边栏组件" description="控制侧边栏的功能模块。拖拽可调整顺序，取消勾选则隐藏对应模块。">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          <SortableContext items={draft.widgets.map((w) => w.type)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3">
              {draft.widgets.map((widget, index) => (
                <SortableWidgetRow
                  key={widget.type}
                  widget={widget}
                  index={index}
                  onToggle={toggleWidget}
                  onCountChange={setCount}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </SettingsSection>

      <SettingsFormBar
        isPending={isPending}
        isDirty={isDirty}
        status={status}
        errorMessage={errorMessage}
        onRevert={revert}
      />
    </form>
  )
}
