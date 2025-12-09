import { createContext, useContext, createSignal, onMount, ParentComponent } from "solid-js";

interface OrientationContextValue {
  isLandscape: () => boolean;
}

const OrientationContext = createContext<OrientationContextValue>();

export const OrientationProvider: ParentComponent = (props) => {
  const [isLandscape, setIsLandscape] = createSignal(window.innerWidth > window.innerHeight);

  const updateOrientation = () => {
    setIsLandscape(window.innerWidth > window.innerHeight);
  };

  onMount(() => {
    window.addEventListener("resize", updateOrientation);
    return () => window.removeEventListener("resize", updateOrientation);
  });

  return (
    <OrientationContext.Provider value={{ isLandscape }}>
      {props.children}
    </OrientationContext.Provider>
  );
};

export function useOrientation() {
  const ctx = useContext(OrientationContext);
  if (!ctx) {
    throw new Error("useOrientation must be used inside <OrientationProvider>");
  }
  return ctx;
}
