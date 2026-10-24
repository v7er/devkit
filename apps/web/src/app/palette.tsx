import { createContext, useContext } from "react";

const SearchPaletteContext = createContext<() => void>(() => {});

export const SearchPaletteProvider = SearchPaletteContext.Provider;

export function useSearchPalette(): () => void {
  return useContext(SearchPaletteContext);
}
