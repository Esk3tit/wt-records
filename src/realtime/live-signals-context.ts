import { createContext } from 'react'

// True while the mode's Realtime subscription is actually joined — surfaces
// let the UI claim "live" only when it is (the feed dot, nothing else yet).
export const LiveSignalsContext = createContext(false)
