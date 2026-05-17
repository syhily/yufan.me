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
import { GripVerticalIcon, PlusIcon, Trash2Icon } from 'lucide-react'

import type { FooterNavItem, FooterSettings, SocialItem } from '@/shared/config/blog'
import type { SocialNetwork } from '@/shared/config/socials'

import { SOCIAL_NETWORK_META, SOCIAL_NETWORKS } from '@/shared/config/socials'
import { SettingsFormBar } from '@/ui/admin/settings/SettingsFormBar'
import { SettingsSection } from '@/ui/admin/settings/SettingsSection'
import { useSettingsForm } from '@/ui/admin/settings/useSettingsForm'
import { Button } from '@/ui/components/button'
import { Input } from '@/ui/components/input'
import { Label } from '@/ui/components/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/select'

interface FooterFormProps {
  footer: FooterSettings['footer']
  socials: SocialItem[]
}

interface FormState {
  initialYear: number
  icpNo: string
  moeIcpNo: string
  items: FooterNavItemRowState[]
}

interface FooterNavItemRowState extends FooterNavItem {
  clientId: string
}

const TYPE_LABELS: Record<FooterNavItem['type'], string> = {
  social: '社交链接',
  themeToggle: '主题切换',
  search: '搜索',
}

function SortableFooterNavRow({
  item,
  index,
  onUpdate,
  onRemove,
}: {
  item: FooterNavItemRowState
  index: number
  onUpdate: (idx: number, patch: Partial<FooterNavItem>) => void
  onRemove: (idx: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.clientId,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 rounded-md border border-line bg-canvas p-3">
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab text-ink-4 active:cursor-grabbing"
        aria-label="拖拽排序"
      >
        <GripVerticalIcon className="size-4" />
      </button>
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor={`footer-item-type-${index}`}>类型</Label>
          <Select
            value={item.type}
            onValueChange={(value) =>
              onUpdate(index, {
                type: value as FooterNavItem['type'],
                network: value === 'social' ? 'github' : undefined,
              })
            }
          >
            <SelectTrigger id={`footer-item-type-${index}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="social">{TYPE_LABELS.social}</SelectItem>
              <SelectItem value="themeToggle">{TYPE_LABELS.themeToggle}</SelectItem>
              <SelectItem value="search">{TYPE_LABELS.search}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {item.type === 'social' && (
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor={`footer-item-network-${index}`}>平台</Label>
            <Select
              value={item.network}
              onValueChange={(value) => onUpdate(index, { network: value as SocialNetwork })}
            >
              <SelectTrigger id={`footer-item-network-${index}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOCIAL_NETWORKS.map((network) => (
                  <SelectItem key={network} value={network}>
                    {SOCIAL_NETWORK_META[network].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <Button
        type="button"
        variant="destructive-soft"
        size="icon"
        aria-label="删除条目"
        onClick={() => onRemove(index)}
      >
        <Trash2Icon data-icon />
      </Button>
    </div>
  )
}

export function FooterForm({ footer, socials }: FooterFormProps) {
  const { draft, setDraft, isDirty, onSubmit, isPending, status, errorMessage, revert } = useSettingsForm<
    FooterSettings['footer'],
    FormState
  >({
    section: 'footer',
    source: footer,
    toState: (source) => ({
      initialYear: source.initialYear,
      icpNo: source.icpNo ?? '',
      moeIcpNo: source.moeIcpNo ?? '',
      items: source.items.map((item) => ({ ...item, clientId: crypto.randomUUID() })),
    }),
    fromState: (state) => ({
      footer: {
        initialYear: state.initialYear,
        icpNo: state.icpNo,
        moeIcpNo: state.moeIcpNo,
        items: state.items.map((item) => ({
          type: item.type,
          network: item.network,
        })),
      },
    }),
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
        const oldIndex = prev.items.findIndex((i) => i.clientId === active.id)
        const newIndex = prev.items.findIndex((i) => i.clientId === over.id)
        return { ...prev, items: arrayMove(prev.items, oldIndex, newIndex) }
      })
    }
  }

  function updateItem(index: number, patch: Partial<FooterNavItem>) {
    setDraft((prev) => {
      const next = [...prev.items]
      next[index] = { ...next[index], ...patch }
      return { ...prev, items: next }
    })
  }

  function removeItem(index: number) {
    setDraft((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }))
  }

  function addItem() {
    setDraft((prev) => ({
      ...prev,
      items: [...prev.items, { type: 'social' as const, network: 'github', clientId: crypto.randomUUID() }],
    }))
  }

  const configuredNetworks = new Set(socials.map((s) => s.network))

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <SettingsSection title="页脚信息" description="网站页脚的版权年份与备案号。">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="footer-initial-year">起始年份</Label>
            <Input
              id="footer-initial-year"
              type="number"
              min={1970}
              max={9999}
              value={draft.initialYear}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  initialYear: Number.parseInt(e.target.value, 10) || 1970,
                }))
              }
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="footer-icp">ICP 备案号</Label>
            <Input
              id="footer-icp"
              value={draft.icpNo ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, icpNo: e.target.value }))}
              placeholder="例如：皖ICP备2021002315号-2"
              maxLength={60}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="footer-moe-icp">萌国备案号</Label>
            <Input
              id="footer-moe-icp"
              value={draft.moeIcpNo ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, moeIcpNo: e.target.value }))}
              maxLength={60}
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="底部导航菜单"
        description="页脚中显示的快捷按钮。可选择社交链接、主题切换或搜索。最多 5 项，拖拽可调整顺序。社交链接需在「社交链接」页面先配置好。"
      >
        <div className="flex flex-col gap-3">
          {draft.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">还没有任何导航条目，点下方按钮新增一项。</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToVerticalAxis]}
            >
              <SortableContext items={draft.items.map((i) => i.clientId)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-3">
                  {draft.items.map((item, index) => (
                    <SortableFooterNavRow
                      key={item.clientId}
                      item={item}
                      index={index}
                      onUpdate={updateItem}
                      onRemove={removeItem}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={draft.items.length >= 5}>
              <PlusIcon data-icon />
              添加导航项
            </Button>
            {draft.items.some(
              (item) => item.type === 'social' && item.network && !configuredNetworks.has(item.network),
            ) && <span className="text-sm text-destructive">部分社交链接尚未配置，保存后不会在页脚显示。</span>}
          </div>
        </div>
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
