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
import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon, PlusIcon, Trash2Icon } from 'lucide-react'

import type { FooterNavItem, NavigationSettings, SocialItem } from '@/shared/config/blog'
import type { SocialNetwork } from '@/shared/config/socials'

import { SOCIAL_NETWORK_META, SOCIAL_NETWORKS } from '@/shared/config/socials'
import { SettingsFormBar } from '@/ui/admin/settings/SettingsFormBar'
import { SettingsSection } from '@/ui/admin/settings/SettingsSection'
import { useSettingsForm } from '@/ui/admin/settings/useSettingsForm'
import { Button } from '@/ui/components/button'
import { Checkbox } from '@/ui/components/checkbox'
import { Field, FieldLabel } from '@/ui/components/field'
import { Input } from '@/ui/components/input'
import { Label } from '@/ui/components/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/select'

interface NavigationEditorProps {
  navigation: NavigationSettings
  socials: SocialItem[]
}

// ---------------------------------------------------------------------------
// Side-nav row shape
// ---------------------------------------------------------------------------

interface SideNavRow {
  clientId: string
  text: string
  link: string
  newTab: boolean
}

interface FormState {
  sideNavRows: SideNavRow[]
  footerNavItems: FooterNavItemRowState[]
}

// ---------------------------------------------------------------------------
// Footer-nav row shape (lifted from FooterForm)
// ---------------------------------------------------------------------------

interface FooterNavItemRowState extends FooterNavItem {
  clientId: string
}

const TYPE_LABELS: Record<FooterNavItem['type'], string> = {
  social: '社交链接',
  themeToggle: '主题切换',
  search: '搜索',
}

const TYPE_ITEMS: { value: FooterNavItem['type']; label: string }[] = [
  { value: 'social', label: TYPE_LABELS.social },
  { value: 'themeToggle', label: TYPE_LABELS.themeToggle },
  { value: 'search', label: TYPE_LABELS.search },
]

const NETWORK_ITEMS = SOCIAL_NETWORKS.map((network) => ({
  value: network,
  label: SOCIAL_NETWORK_META[network].label,
}))

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
            items={TYPE_ITEMS}
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
              items={NETWORK_ITEMS}
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

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

export function NavigationEditor({ navigation, socials }: NavigationEditorProps) {
  const { draft, setDraft, isDirty, onSubmit, isPending, status, errorMessage, revert } = useSettingsForm<
    NavigationSettings,
    FormState
  >({
    section: 'navigation',
    source: navigation,
    toState: (source) => ({
      sideNavRows: source.navigation.sideNav.map((item) => ({
        clientId: crypto.randomUUID(),
        text: item.text,
        link: item.link,
        newTab: item.target === '_blank',
      })),
      footerNavItems: source.navigation.footerNav.map((item) => ({ ...item, clientId: crypto.randomUUID() })),
    }),
    fromState: (state) => ({
      navigation: {
        sideNav: state.sideNavRows.map((row) => ({
          text: row.text.trim(),
          link: row.link.trim(),
          ...(row.newTab ? { target: '_blank' } : {}),
        })),
        footerNav: state.footerNavItems.map((item) => ({
          type: item.type,
          network: item.network,
        })),
      },
    }),
  })

  // --- Side-nav helpers ---
  const updateSideNav = (index: number, patch: Partial<SideNavRow>) =>
    setDraft((prev) => ({
      ...prev,
      sideNavRows: prev.sideNavRows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }))
  const removeSideNav = (index: number) =>
    setDraft((prev) => ({ ...prev, sideNavRows: prev.sideNavRows.filter((_, i) => i !== index) }))
  const moveSideNav = (index: number, direction: -1 | 1) => {
    setDraft((prev) => {
      const target = index + direction
      if (target < 0 || target >= prev.sideNavRows.length) {
        return prev
      }
      const next = [...prev.sideNavRows]
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...prev, sideNavRows: next }
    })
  }
  const addSideNav = () =>
    setDraft((prev) => ({
      ...prev,
      sideNavRows: [...prev.sideNavRows, { clientId: crypto.randomUUID(), text: '', link: '/', newTab: false }],
    }))

  // --- Footer-nav helpers ---
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function handleFooterDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setDraft((prev) => {
        const oldIndex = prev.footerNavItems.findIndex((i) => i.clientId === active.id)
        const newIndex = prev.footerNavItems.findIndex((i) => i.clientId === over.id)
        return { ...prev, footerNavItems: arrayMove(prev.footerNavItems, oldIndex, newIndex) }
      })
    }
  }

  function updateFooterItem(index: number, patch: Partial<FooterNavItem>) {
    setDraft((prev) => {
      const next = [...prev.footerNavItems]
      next[index] = { ...next[index], ...patch }
      return { ...prev, footerNavItems: next }
    })
  }

  function removeFooterItem(index: number) {
    setDraft((prev) => ({ ...prev, footerNavItems: prev.footerNavItems.filter((_, i) => i !== index) }))
  }

  function addFooterItem() {
    setDraft((prev) => ({
      ...prev,
      footerNavItems: [
        ...prev.footerNavItems,
        { type: 'social' as const, network: 'github', clientId: crypto.randomUUID() },
      ],
    }))
  }

  const configuredNetworks = new Set(socials.map((s) => s.network))

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {/* Side Navigation */}
      <SettingsSection
        title="侧边导航菜单"
        description="侧边栏导航条目。顺序、标题、链接均可调整。最多 20 个，链接可以是站内绝对路径或完整外部 URL。"
        groupFields={false}
      >
        <div className="flex flex-col gap-3">
          {draft.sideNavRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">还没有任何菜单条目，点下方按钮新增一项。</p>
          ) : (
            draft.sideNavRows.map((row, index) => (
              <div
                key={row.clientId}
                className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3 sm:flex-row sm:items-end"
              >
                <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                  <div className="flex flex-col gap-1 sm:flex-1">
                    <Label htmlFor={`nav-text-${index}`}>显示文本</Label>
                    <Input
                      id={`nav-text-${index}`}
                      value={row.text}
                      onChange={(e) => updateSideNav(index, { text: e.target.value })}
                      maxLength={40}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1 sm:flex-1">
                    <Label htmlFor={`nav-link-${index}`}>链接</Label>
                    <Input
                      id={`nav-link-${index}`}
                      value={row.link}
                      onChange={(e) => updateSideNav(index, { link: e.target.value })}
                      maxLength={200}
                      required
                      placeholder="/about 或 https://example.com"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Field orientation="horizontal" className="w-fit">
                    <Checkbox
                      id={`nav-newtab-${index}`}
                      checked={row.newTab}
                      onCheckedChange={(value) => updateSideNav(index, { newTab: value === true })}
                    />
                    <FieldLabel htmlFor={`nav-newtab-${index}`} className="font-normal">
                      新窗口打开
                    </FieldLabel>
                  </Field>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="上移"
                      disabled={index === 0}
                      onClick={() => moveSideNav(index, -1)}
                    >
                      <ArrowUpIcon data-icon />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="下移"
                      disabled={index === draft.sideNavRows.length - 1}
                      onClick={() => moveSideNav(index, 1)}
                    >
                      <ArrowDownIcon data-icon />
                    </Button>
                    <Button
                      type="button"
                      variant="destructive-soft"
                      size="icon"
                      aria-label="删除条目"
                      onClick={() => removeSideNav(index)}
                    >
                      <Trash2Icon data-icon />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addSideNav}
            disabled={draft.sideNavRows.length >= 20}
          >
            <PlusIcon data-icon />
            添加菜单项
          </Button>
        </div>
      </SettingsSection>

      {/* Footer Navigation */}
      <SettingsSection
        title="底部导航菜单"
        description="页脚中显示的快捷按钮。可选择社交链接、主题切换或搜索。最多 5 项，拖拽可调整顺序。社交链接需在「社交链接」页面先配置好。"
        groupFields={false}
      >
        <div className="flex flex-col gap-3">
          {draft.footerNavItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">还没有任何导航条目，点下方按钮新增一项。</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleFooterDragEnd}
              modifiers={[restrictToVerticalAxis]}
            >
              <SortableContext
                items={draft.footerNavItems.map((i) => i.clientId)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-3">
                  {draft.footerNavItems.map((item, index) => (
                    <SortableFooterNavRow
                      key={item.clientId}
                      item={item}
                      index={index}
                      onUpdate={updateFooterItem}
                      onRemove={removeFooterItem}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addFooterItem}
              disabled={draft.footerNavItems.length >= 5}
            >
              <PlusIcon data-icon />
              添加导航项
            </Button>
            {draft.footerNavItems.some(
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
