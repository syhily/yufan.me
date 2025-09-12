import type { APIRoute } from 'astro'
import defer * as pool from '@/helpers/db/pool'

export const POST: APIRoute = async ({ request }) => {
  const formData = await request.formData()
  const file = formData.get('file') as File

  if (!file) {
    return new Response(JSON.stringify({ message: 'No file uploaded.' }), { status: 400 })
  }

  console.warn('Receive file name:', file.name)
  console.warn('Receive file type:', file.type)
  console.warn('Receive file size:', file.size)

  const dump = await file.text()
  await pool.importDatabase(dump)

  return new Response(JSON.stringify({ message: 'Import success.' }), { status: 200 })
}
