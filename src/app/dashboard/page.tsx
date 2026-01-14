import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const session = await auth()
  
  if (!session?.user) {
    redirect("/login")
  }

  // Redirecionar baseado no role
  if (session.user.role === "ADMIN") {
    redirect("/admin/dashboard")
  } else if (session.user.role === "MANAGER") {
    redirect("/cliente/dashboard")
  } else {
    redirect("/login")
  }
}
