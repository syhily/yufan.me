import { RouterContextProvider } from 'react-router'
import { createHonoServer } from 'react-router-hono-server/node'

export default await createHonoServer({
  getLoadContext() {
    return new RouterContextProvider()
  },
})
