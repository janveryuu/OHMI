"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { MotionConfig } from "motion/react";
import { starterMessages } from "@/lib/content";

export type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  attachment?: string;
};
export type Conversation = { id: string; title: string; messages: Message[] };
export type LocalFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
};
type State = {
  theme: string;
  setTheme: (value: string) => void;
  reduceMotion: boolean;
  setReduceMotion: (value: boolean) => void;
  largeText: boolean;
  setLargeText: (value: boolean) => void;
  language: string;
  setLanguage: (value: string) => void;
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  activeChat: string;
  setActiveChat: (id: string) => void;
  files: LocalFile[];
  setFiles: React.Dispatch<React.SetStateAction<LocalFile[]>>;
  completed: boolean[];
  setCompleted: React.Dispatch<React.SetStateAction<boolean[]>>;
  name: string;
  setName: (value: string) => void;
  toast: (message: string) => void;
};
const Context = createContext<State | null>(null);
export function useApp() {
  const state = useContext(Context);
  if (!state) throw new Error("Missing OHMI context");
  return state;
}
export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState("system"),
    [reduceMotion, setReduceMotion] = useState(false),
    [largeText, setLargeText] = useState(false);
  const [language, setLanguage] = useState("English"),
    [name, setName] = useState("Alex");
  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: "first",
      title: "Your first conversation",
      messages: starterMessages,
    },
  ]);
  const [activeChat, setActiveChat] = useState("first"),
    [files, setFiles] = useState<LocalFile[]>([]),
    [completed, setCompleted] = useState<boolean[]>(Array(5).fill(false));
  const [notice, setNotice] = useState(""),
    [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("ohmi-preferences") || "{}",
      );
      if (["system", "light", "dark"].includes(saved.theme))
        setTheme(saved.theme);
      setReduceMotion(saved.reduceMotion === true);
      setLargeText(saved.largeText === true);
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reduceMotion);
    document.documentElement.dataset.largeText = String(largeText);
    if (ready)
      try {
        localStorage.setItem(
          "ohmi-preferences",
          JSON.stringify({ theme, reduceMotion, largeText }),
        );
      } catch {}
  }, [theme, reduceMotion, largeText, ready]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  return (
    <Context.Provider
      value={{
        theme,
        setTheme,
        reduceMotion,
        setReduceMotion,
        largeText,
        setLargeText,
        language,
        setLanguage,
        conversations,
        setConversations,
        activeChat,
        setActiveChat,
        files,
        setFiles,
        completed,
        setCompleted,
        name,
        setName,
        toast: setNotice,
      }}
    >
      <MotionConfig
        reducedMotion={reduceMotion ? "always" : "user"}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
      >
        {children}
        <div className="toast" role="status" aria-live="polite">
          {notice && <span>{notice}</span>}
        </div>
      </MotionConfig>
    </Context.Provider>
  );
}
