import { SceneBackdrop } from 'wt-records'

export function NightScene() {
  return (
    <div
      className="relative overflow-hidden rounded-[26px]"
      style={{ transform: 'translateZ(0)', height: '30rem', background: 'var(--base)' }}
    >
      <SceneBackdrop />
    </div>
  )
}
