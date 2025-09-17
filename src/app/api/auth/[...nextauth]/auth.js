import { getServerSession } from 'next-auth'
import { authOptions } from './route' // you already export this

export async function isAdmin() {
  const session = await getServerSession(authOptions)
  return !!session?.user?.admin
}
