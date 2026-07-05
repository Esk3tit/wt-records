import { SceneBackdrop } from 'wt-records'

export function NightScene() {
  return (
    <div
      className="relative overflow-hidden rounded-[26px] bg-base"
      style={{ transform: 'translateZ(0)', height: '30rem' }}
    >
      <SceneBackdrop />
    </div>
  )
}
