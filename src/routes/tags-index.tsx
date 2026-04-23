import { redirect } from 'react-router'

export async function loader() {
  throw redirect('/')
}

export default function TagsIndexRoute() {
  return null
}
