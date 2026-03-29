import { createContext, useContext, type ReactNode } from 'react';

/** 앱 컨텍스트 값 */
interface AppContextValue {
  /** 앱 이름 */
  readonly appName: string;
}

/** React Context — MFE 앱 정보를 하위 컴포넌트에 전달한다 */
const AppContext = createContext<AppContextValue>({ appName: 'react-dashboard' });

/** AppContext 값을 읽는 훅 */
export function useAppContext(): AppContextValue {
  return useContext(AppContext);
}

/** Provider 래퍼 — createReactMfeApp의 wrapWith에 전달한다 */
export function AppProvider({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <AppContext.Provider value={{ appName: 'react-dashboard' }}>{children}</AppContext.Provider>
  );
}
