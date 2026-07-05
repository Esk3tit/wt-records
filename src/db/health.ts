import postgres from 'postgres'

if (typeof window !== 'undefined') {
  throw new Error('#/db/health must not be imported in the browser')
}

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

// Isolated single-connection client for health pings: a stalled or abandoned
// ping can only ever occupy THIS connection, never the app pool, and the
// connection closes itself when idle.
const healthClient = postgres(url, {
  prepare: false,
  max: 1,
  connect_timeout: 5,
  idle_timeout: 30,
})

export const healthPing = () => healthClient`select 1`
