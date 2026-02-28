"use client"

import * as React from "react"
import { Moon, Sun, Briefcase, Zap } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

const themes = ["light", "consignado", "railway", "dark"] as const
const themeLabels: Record<string, string> = {
  light: "White",
  consignado: "White Light",
  railway: "Dark",
  dark: "Dark Light",
}
const themeIcons: Record<string, React.ElementType> = {
  light: Sun,
  consignado: Briefcase,
  railway: Zap,
  dark: Moon,
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  const cycleTheme = () => {
    const currentIndex = themes.indexOf(theme as typeof themes[number])
    const nextIndex = (currentIndex + 1) % themes.length
    setTheme(themes[nextIndex])
  }

  const currentLabel = themeLabels[theme ?? "light"] ?? "White"
  const Icon = themeIcons[theme ?? "light"] ?? Sun

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={cycleTheme}
      className="gap-2"
    >
      <Icon className="h-[1.2rem] w-[1.2rem]" />
      <span className="text-xs font-medium">{currentLabel}</span>
    </Button>
  )
}
