// Ensure NEXTAUTH_URL has protocol
if (process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.startsWith('http')) {
  process.env.NEXTAUTH_URL = `https://${process.env.NEXTAUTH_URL}`
}
