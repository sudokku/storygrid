import { createContext, useContext } from 'react';

export const ExportModeContext = createContext(false);
export const useExportMode = () => useContext(ExportModeContext);
