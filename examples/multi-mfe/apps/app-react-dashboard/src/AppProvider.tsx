import { createContext, useContext, type ReactNode } from 'react';

/** App context value */
interface AppContextValue {
  /** App name */
  readonly appName: string;
}

/** React Context — passes MFE app information to child components */
const AppContext = createContext<AppContextValue>({ appName: 'react-dashboard' });

/** Hook to read AppContext value */
export function useAppContext(): AppContextValue {
  return useContext(AppContext);
}

/** Provider wrapper — passed to createReactMfeApp's wrapWith */
export function AppProvider({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <AppContext.Provider value={{ appName: 'react-dashboard' }}>{children}</AppContext.Provider>
  );
}
