import { type ComponentType, type ExoticComponent } from "react";

type SlotProps = Record<string, never>;

export type SlotComponent = (ComponentType<SlotProps> | ExoticComponent<SlotProps>) & {
  __isPlaceholder?: boolean;
};

const REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref");
const REACT_LAZY_TYPE = Symbol.for("react.lazy");
const REACT_MEMO_TYPE = Symbol.for("react.memo");

function hasSupportedWrapperType(
  value: object,
): value is { readonly $$typeof: symbol } {
  const marker = (value as { readonly $$typeof?: symbol }).$$typeof;
  return (
    marker === REACT_FORWARD_REF_TYPE ||
    marker === REACT_LAZY_TYPE ||
    marker === REACT_MEMO_TYPE
  );
}

export function isSlotComponent(value: unknown): value is SlotComponent {
  return (
    typeof value === "function" ||
    (typeof value === "object" &&
      value !== null &&
      // React wrappers like memo/forwardRef/lazy are objects at runtime.
      hasSupportedWrapperType(value))
  );
}
