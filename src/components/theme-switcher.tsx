"use client"

import * as React from "react"
import { Sun, Briefcase, Moon } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

const themes = ["light", "railway", "consignado"] as const
const themeIcons: Record<string, React.ElementType> = {
  light: Sun,
  consignado: Briefcase,
  railway: Moon,
}
const themeLabels: Record<string, string> = {
  light: "Claro",
  railway: "Escuro",
  consignado: "Consignado",
}

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()

  const cycleTheme = () => {
    const currentIndex = themes.indexOf(theme as typeof themes[number])
    const nextIndex = (currentIndex + 1) % themes.length
    setTheme(themes[nextIndex])
  }

  const Icon = themeIcons[theme ?? "light"] ?? Sun
  const label = themeLabels[theme ?? "light"] ?? "Claro"

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={cycleTheme}
      title={label}
    >
      <Icon className="h-4 w-4" />
    </Button>
  )
}
