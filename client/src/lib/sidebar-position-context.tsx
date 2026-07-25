import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type SidebarPosition = "left" | "right";

interface SidebarPositionContextType {
  position: SidebarPosition;
  setPosition: (position: SidebarPosition) => void;
  togglePosition: () => void;
}

const SidebarPositionContext = createContext<SidebarPositionContextType | undefined>(undefined);

export function SidebarPositionProvider({ children }: { children: ReactNode }) {
  const [position, setPositionState] = useState<SidebarPosition>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebar-position");
      return (saved as SidebarPosition) || "left";
    }
    return "left";
  });

  useEffect(() => {
    localStorage.setItem("sidebar-position", position);
  }, [position]);

  const setPosition = (newPosition: SidebarPosition) => {
    setPositionState(newPosition);
  };

  const togglePosition = () => {
    setPositionState(prev => prev === "left" ? "right" : "left");
  };

  return (
    <SidebarPositionContext.Provider value={{ position, setPosition, togglePosition }}>
      {children}
    </SidebarPositionContext.Provider>
  );
}

export function useSidebarPosition() {
  const context = useContext(SidebarPositionContext);
  if (context === undefined) {
    throw new Error("useSidebarPosition must be used within a SidebarPositionProvider");
  }
  return context;
}
