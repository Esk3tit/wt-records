import { ThemeToggle } from 'wt-records'
import { Hall } from './hall'

export function InlineToggle() {
  return (
    <Hall>
      <div className="flex items-center gap-3">
        <span className="text-sm text-fg-muted">Switch theme</span>
        <ThemeToggle />
      </div>
    </Hall>
  )
}
