import { FastResponse } from 'srvx'
import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'

globalThis.Response = FastResponse

export default {
  fetch: createStartHandler(defaultStreamHandler),
}
