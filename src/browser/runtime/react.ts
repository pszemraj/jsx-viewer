import React from "react";
import * as ReactNamespace from "react";

const ReactInterop = ReactNamespace as typeof ReactNamespace & {
  readonly __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?: unknown;
  readonly unstable_act?: unknown;
};

export default React;
const ReactModuleExports = React;
export const {
  Children,
  Component,
  Fragment,
  Profiler,
  PureComponent,
  StrictMode,
  Suspense,
  act,
  cloneElement,
  createContext,
  createElement,
  createFactory,
  createRef,
  forwardRef,
  isValidElement,
  lazy,
  memo,
  startTransition,
  useCallback,
  useContext,
  useDebugValue,
  useDeferredValue,
  useEffect,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  version,
} = ReactNamespace;
export { ReactModuleExports as "module.exports" };
export const unstable_act = ReactInterop.unstable_act;
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED =
  ReactInterop.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
