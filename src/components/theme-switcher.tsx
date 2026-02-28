"use client"

import * as React from "react"
import { Sun, Briefcase, Zap } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

const themes = ["light", "railway", "consignado"] as const
const themeIcons: Record<string, React.ElementType> = {
  light: Sun,
  consignado: Briefcase,
  railway: Zap,
}

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()

  const cycleTheme = () => {
    const currentIndex = themes.indexOf(theme as typeof themes[number])
    const nextIndex = (currentIndex + 1) % themes.length
    setTheme(themes[nextIndex])
  }

  const Icon = themeIcons[theme ?? "light"] ?? Sun

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={cycleTheme}
      title={theme ?? "light"}
    >
      <Icon className="h-4 w-4" />
    </Button>
  )
}
