"use client";

import { useEffect, useState } from "react";
import { Check, Desktop, Moon, Sun } from "@phosphor-icons/react/dist/ssr";
import { parseTheme, persistTheme, themeLabels, themes, type Theme } from "../lib/theme";

function useTheme(initialTheme: Theme) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  useEffect(() => {
    function sync(event: Event) { setTheme(parseTheme((event as CustomEvent<string>).detail)); }
    window.addEventListener("devcontext-theme-change", sync);
    return () => window.removeEventListener("devcontext-theme-change", sync);
  }, []);
  function choose(next: Theme) {
    setTheme(next);
    persistTheme(next);
    window.dispatchEvent(new CustomEvent("devcontext-theme-change", { detail: next }));
  }
  return { theme, choose };
}

/** Header control: the icon shows the current choice, the native select keeps it accessible. */
export function ThemeToggle({ initialTheme }: { initialTheme: Theme; compact?: boolean }) {
  const { theme, choose } = useTheme(initialTheme);
  return (
    <label className="theme-select" title="Tema">
      {theme === "dark" ? <Moon aria-hidden size={22} /> : theme === "light" ? <Sun aria-hidden size={24} /> : <Desktop aria-hidden size={22} />}
      <span className="visually-hidden">Tema</span>
      <select aria-label="Tema" onChange={(event) => choose(parseTheme(event.target.value))} value={theme}>
        {themes.map((item) => <option key={item} value={item}>{themeLabels[item]}</option>)}
      </select>
    </label>
  );
}

function Preview({ theme }: { theme: Theme }) {
  return (
    <span aria-hidden="true" className={`theme-preview ${theme}`}>
      <span className="pv-bar"><i /></span>
      <span className="pv-body"><span><i /><i /><i /></span><span><i /><i /><i /></span></span>
    </span>
  );
}

/** Settings control: three equal cards with a small preview; the choice applies immediately (no save button). */
export function ThemeCards({ initialTheme }: { initialTheme: Theme }) {
  const { theme, choose } = useTheme(initialTheme);
  const order: Theme[] = ["light", "dark", "system"];
  return (
    <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
      <legend className="visually-hidden">Tema</legend>
      <div className="theme-cards">
        {order.map((item) => (
          <label className={`theme-card${theme === item ? " selected" : ""}`} key={item}>
            <input checked={theme === item} name="theme" onChange={() => choose(item)} type="radio" value={item} />
            {theme === item && <span className="check"><Check aria-hidden size={14} weight="bold" /></span>}
            <Preview theme={item} />
            <span>{themeLabels[item]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
