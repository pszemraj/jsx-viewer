import * as ReactDom from "react-dom";
import {
  createRoot as createRootClient,
  hydrateRoot as hydrateRootClient,
} from "react-dom/client";

const ReactDomDefault = ReactDom;
const ReactDomInterop = ReactDom as typeof ReactDom & Record<string, unknown>;

export default ReactDomDefault;
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED =
  ReactDomInterop.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
export const { createPortal, findDOMNode, flushSync, hydrate, render, unmountComponentAtNode, unstable_batchedUpdates, unstable_renderSubtreeIntoContainer, version } =
  ReactDom;
export const createRoot = createRootClient;
export const hydrateRoot = hydrateRootClient;
