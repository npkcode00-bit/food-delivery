// pages/api/me.js
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  // const user = await getLoggedInUser()
  // return res.status(200).json({ admin: !!user?.admin })
  return res.status(200).json({ admin: true }) // demo
}
