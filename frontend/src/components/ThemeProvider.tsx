import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeName = "midnight" | "emerald" | "nature";

interface ThemeCtx {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
}

const ThemeContext = createContext<ThemeCtx>({ theme: "midnight", setTheme: () => {} });

export const useTheme = () => useContext(ThemeContext);

export const themes: { id: ThemeName; name: string; preview: string; description: string }[] = [
  { id: "midnight", name: "Midnight", preview: "#3EBB9E", description: "Dark mode — teal accents" },
  { id: "emerald", name: "Emerald", preview: "#10b981", description: "Light green — clean & fresh" },
  { id: "nature", name: "Nature", preview: "#2E7D32", description: "Earthy green — warm & organic" },
];

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {    const stored = localStorage.getItem("evora-theme");
    if (stored === "sunset") return "nature"; // migrate old value
    if (stored === "midnight" || stored === "emerald" || stored === "nature") return stored;
    return "midnight";
  });

  const setTheme = (t: ThemeName) => {
    setThemeState(t);
    localStorage.setItem("evora-theme", t);
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
