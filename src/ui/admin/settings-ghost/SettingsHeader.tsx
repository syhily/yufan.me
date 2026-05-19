import { useNavigate } from 'react-router'

export function SettingsCloseButton() {
  const navigate = useNavigate()

  return (
    <div className="fixed top-2 right-0 z-50 m-8 hidden justify-end lg:flex">
      <button
        type="button"
        title="关闭 (ESC)"
        onClick={() => {
          void navigate(-1)
        }}
        className="inline-flex items-center rounded-md p-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-6"
        >
          <line x1="0.75" y1="23.249" x2="23.25" y2="0.749" />
          <line x1="23.25" y1="23.249" x2="0.75" y2="0.749" />
        </svg>
        <span className="sr-only">关闭</span>
      </button>
    </div>
  )
}
