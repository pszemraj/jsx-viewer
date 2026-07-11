/**
 * PolyField.tsx — Complex TSX Demo
 *
 * Patterns demonstrated:
 *  - Polymorphic component    (Box<E extends ElementType> with `as` prop, fully typed)
 *  - forwardRef + generics    (FieldInner wrapped — the cast workaround explained)
 *  - Discriminated union props (FieldProps: InputFieldProps | TextareaFieldProps | SelectFieldProps)
 *  - ComponentPropsWithoutRef  (native element prop extension without ref leak)
 *  - useImperativeHandle       (custom FieldHandle API surface instead of raw DOM ref)
 *  - Template literal types    (HandlerKey = `on${Capitalize<EventName>}`)
 *  - Context + typed consumer  (FormContext with useFormContext guard)
 */

import React, {
  createContext,
  useContext,
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
  useCallback,
  memo,
  type ComponentPropsWithoutRef,
  type ComponentPropsWithRef,
  type ElementType,
  type ReactNode,
  type ForwardedRef,
  type CSSProperties,
} from 'react';

// ─── Tokens ──────────────────────────────────────────────────────────────────

const C = {
  bg:        '#0d0d0f',
  surface:   '#141418',
  border:    '#1e1e26',
  borderFoc: '#7c6af7',
  muted:     '#3a3a48',
  dim:       '#6b6b80',
  text:      '#e2e2ee',
  textSoft:  '#9898b0',
  accent:    '#7c6af7',
  accentDim: '#2a2250',
  success:   '#34d399',
  danger:    '#f87171',
  font:      "'Geist Mono', 'Fira Code', monospace",
} as const;

// ─── Polymorphic Box ──────────────────────────────────────────────────────────
//
// The core challenge: forwardRef can't be generic in TypeScript directly,
// so we define the full generic type separately and cast after forwardRef().
//
// PolymorphicComponentPropWithRef<E, OwnProps> merges:
//   • `as?: E`                             — element override
//   • OwnProps                             — component-specific props
//   • ComponentPropsWithoutRef<E>          — all native props for E, minus
//     keys already in OwnProps (avoid collisions)

type AsProp<E extends ElementType> = { as?: E };

type PolymorphicComponentProp<E extends ElementType, P = object> =
  React.PropsWithChildren<P & AsProp<E>> &
  Omit<ComponentPropsWithoutRef<E>, keyof (AsProp<E> & P)>;

// Extract the correct ref type for any element
type PolymorphicRef<E extends ElementType> =
  ComponentPropsWithRef<E>['ref'];

type PolymorphicComponentPropWithRef<E extends ElementType, P = object> =
  PolymorphicComponentProp<E, P> & { ref?: PolymorphicRef<E> };

// The public type we expose for Box (callable signature, not React.FC)
type BoxComponent = <E extends ElementType = 'div'>(
  props: PolymorphicComponentPropWithRef<E, { sx?: CSSProperties }>
) => React.ReactElement | null;

function polymorphicForwardRef<DefaultElement extends ElementType, P = object>(
  render: <E extends ElementType = DefaultElement>(
    props: PolymorphicComponentProp<E, P>,
    ref: PolymorphicRef<E>,
  ) => React.ReactElement | null,
) {
  return forwardRef(render as any) as unknown as <E extends ElementType = DefaultElement>(
    props: PolymorphicComponentPropWithRef<E, P>,
  ) => React.ReactElement | null;
}

// forwardRef loses the generic; hide the bridge behind a helper and expose the typed surface
const Box: BoxComponent = polymorphicForwardRef<'div', { sx?: CSSProperties }>(
  function Box<E extends ElementType = 'div'>(
    {
      as,
      sx,
      style,
      children,
      ...rest
    }: PolymorphicComponentProp<E, { sx?: CSSProperties }>,
    ref: PolymorphicRef<E>,
  ) {
    const Element = (as ?? 'div') as ElementType;
    return (
      <Element ref={ref} style={{ ...sx, ...style }} {...rest}>
        {children}
      </Element>
    );
  },
);

// ─── Discriminated union: Field variants ──────────────────────────────────────
//
// The `variant` discriminant lets TypeScript narrow the full prop type,
// so callers only see props relevant to their variant.

type BaseFieldProps = {
  label:   string;
  error?:  string;
  hint?:   string;
};

type InputFieldProps = BaseFieldProps & {
  variant: 'input';
  type?:   'text' | 'email' | 'password' | 'number' | 'tel';
} & Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'ref'>;

type TextareaFieldProps = BaseFieldProps & {
  variant: 'textarea';
  rows?:   number;
} & Omit<ComponentPropsWithoutRef<'textarea'>, 'ref'>;

type SelectFieldProps = BaseFieldProps & {
  variant:  'select';
  options:  { label: string; value: string }[];
} & Omit<ComponentPropsWithoutRef<'select'>, 'ref'>;

type FieldProps = InputFieldProps | TextareaFieldProps | SelectFieldProps;

// ─── useImperativeHandle: custom ref API ──────────────────────────────────────
//
// Instead of leaking the raw DOM node, we expose a stable, typed API surface.
// Callers never touch inputRef.current directly.

export type FieldHandle = {
  focus:    () => void;
  clear:    () => void;
  getValue: () => string;
  setValue: (v: string) => void;
};

// ─── Field (forwardRef + discriminated union) ─────────────────────────────────
//
// Because forwardRef can't be directly generic in TS, we use the
// named-inner-function pattern: define FieldInner, then wrap.

function FieldInner(props: FieldProps, ref: ForwardedRef<FieldHandle>) {
  const { disabled: ctxDisabled } = useFormContext();

  // Single ref covers all three native element shapes
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement>(null);

  useImperativeHandle(ref, () => ({
    focus:    ()  => inputRef.current?.focus(),
    clear:    ()  => { if (inputRef.current) inputRef.current.value = ''; },
    getValue: ()  => inputRef.current?.value ?? '',
    setValue: (v) => { if (inputRef.current) inputRef.current.value = v; },
  }), []);

  const { label, error, hint, variant, ...rest } = props;
  const id      = `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const hasErr  = Boolean(error);
  const iStyle  = fieldInputStyle(hasErr);

  // Narrowed by discriminant — TypeScript knows exactly which props exist here
  let control: ReactNode;

  if (variant === 'input') {
    const { type = 'text', ...inputRest } =
      rest as Omit<InputFieldProps, keyof BaseFieldProps | 'variant'>;
    control = (
      <input
        ref={inputRef}
        id={id}
        type={type}
        disabled={ctxDisabled}
        style={iStyle}
        {...inputRest}
      />
    );
  } else if (variant === 'textarea') {
    const { rows = 4, ...taRest } =
      rest as Omit<TextareaFieldProps, keyof BaseFieldProps | 'variant'>;
    control = (
      <textarea
        ref={inputRef}
        id={id}
        rows={rows}
        disabled={ctxDisabled}
        style={{ ...iStyle, resize: 'vertical', minHeight: 80 }}
        {...taRest}
      />
    );
  } else {
    // variant === 'select'
    const { options, ...selRest } =
      rest as Omit<SelectFieldProps, keyof BaseFieldProps | 'variant'>;
    control = (
      <select
        ref={inputRef}
        id={id}
        disabled={ctxDisabled}
        style={{ ...iStyle, cursor: 'pointer' }}
        {...selRest}
      >
        <option value="">— choose —</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <Box
      as="div"
      sx={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 20 }}
    >
      <label
        htmlFor={id}
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: hasErr ? C.danger : C.textSoft,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontFamily: C.font,
        }}
      >
        {label}
      </label>

      {control}

      {hint && !error && (
        <span style={{ fontSize: 11, color: C.dim, fontFamily: C.font }}>{hint}</span>
      )}
      {error && (
        <span
          role="alert"
          style={{ fontSize: 11, color: C.danger, fontFamily: C.font }}
        >
          ⚠ {error}
        </span>
      )}
    </Box>
  );
}

// forwardRef wraps the named function — preserves displayName in DevTools
export const Field = memo(forwardRef(FieldInner));
Field.displayName = 'Field';

// ─── Template literal types ───────────────────────────────────────────────────
//
// Maps a union of event names to `on${Capitalize<Name>}` keys.
// This forces callers to only provide handler keys that correspond to
// real, declared events — not arbitrary strings.

type FormEventName = 'submit' | 'reset';
type FormHandlerKey = `on${Capitalize<FormEventName>}`;
type FormHandlers = {
  [K in FormHandlerKey]?: (e: React.FormEvent<HTMLFormElement>) => void;
};

// ─── FormContext ──────────────────────────────────────────────────────────────

type FormCtx = { disabled: boolean };
const FormContext = createContext<FormCtx | null>(null);

function useFormContext(): FormCtx {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error('useFormContext must be used inside <FormProvider>');
  return ctx;
}

function FormProvider({
  children,
  disabled = false,
}: {
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <FormContext.Provider value={{ disabled }}>
      {children}
    </FormContext.Provider>
  );
}

// ─── Demo ─────────────────────────────────────────────────────────────────────

export default function App() {
  const emailRef = useRef<FieldHandle>(null);
  const roleRef  = useRef<FieldHandle>(null);
  const bioRef   = useRef<FieldHandle>(null);

  const [submitted, setSubmitted] = useState<Record<string, string> | null>(null);
  const [emailErr,  setEmailErr]  = useState<string | undefined>();
  const [disabled,  setDisabled]  = useState(false);

  // Template literal type in action: handlers object is typed as FormHandlers
  const handlers: FormHandlers = {
    onSubmit: useCallback((e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const email = emailRef.current?.getValue() ?? '';

      if (!email.includes('@') || email.length < 5) {
        setEmailErr('Enter a valid email address');
        emailRef.current?.focus();
        return;
      }

      setEmailErr(undefined);
      setSubmitted({
        email,
        role: roleRef.current?.getValue() ?? '',
        bio:  bioRef.current?.getValue()   ?? '',
      });
    }, []),

    onReset: useCallback(() => {
      setSubmitted(null);
      setEmailErr(undefined);
    }, []),
  };

  return (
    <FormProvider disabled={disabled}>
      <Box
        as="main"
        sx={{
          padding: 40,
          background: C.bg,
          minHeight: '100vh',
          color: C.text,
          fontFamily: C.font,
        }}
      >
        <p style={{ fontSize: 11, color: C.dim, letterSpacing: '0.1em', margin: '0 0 4px' }}>
          COMPLEX TSX DEMO
        </p>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: C.text }}>
          PolyField
        </h1>
        <p style={{ margin: '0 0 32px', fontSize: 12, color: C.dim }}>
          polymorphic · forwardRef+generics · discriminated-union · useImperativeHandle · template-literal-types
        </p>

        {/* Box renders as <form> — fully typed: onSubmit expects FormEventHandler<HTMLFormElement> */}
        <Box
          as="form"
          onSubmit={handlers.onSubmit}
          onReset={handlers.onReset}
          sx={{ maxWidth: 440 }}
          noValidate
        >
          {/* variant='input' — type prop is narrowed to its specific union */}
          <Field
            ref={emailRef}
            variant="input"
            type="email"
            label="Email"
            placeholder="you@example.com"
            error={emailErr}
            hint="Never shared. Never sold."
            autoComplete="email"
          />

          {/* variant='textarea' — rows prop only valid here */}
          <Field
            ref={bioRef}
            variant="textarea"
            label="Bio"
            rows={3}
            placeholder="Tell us about yourself…"
            hint="Max 280 characters"
            maxLength={280}
          />

          {/* variant='select' — options prop required, nothing else */}
          <Field
            ref={roleRef}
            variant="select"
            label="Role"
            options={[
              { label: 'Engineer',  value: 'eng'  },
              { label: 'Designer',  value: 'des'  },
              { label: 'PM',        value: 'pm'   },
              { label: 'DevRel',    value: 'devrel' },
              { label: 'QA',        value: 'qa'   },
            ]}
          />

          {/* Control row */}
          <Box as="div" sx={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <ActionBtn type="submit" variant="primary">Submit</ActionBtn>
            <ActionBtn type="reset"  variant="ghost">Reset</ActionBtn>
            <ActionBtn
              type="button"
              variant="ghost"
              onClick={() => emailRef.current?.clear()}
            >
              Clear email
            </ActionBtn>
            <label
              style={{ marginLeft: 'auto', fontSize: 11, color: C.dim, cursor: 'pointer', userSelect: 'none' }}
            >
              <input
                type="checkbox"
                checked={disabled}
                onChange={e => setDisabled(e.target.checked)}
                style={{ marginRight: 6, accentColor: C.accent }}
              />
              Disable form (via context)
            </label>
          </Box>
        </Box>

        {submitted && (
          <Box
            as="pre"
            sx={{
              marginTop: 28,
              padding: 20,
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderLeft: `3px solid ${C.success}`,
              borderRadius: 8,
              fontSize: 12,
              color: C.success,
              maxWidth: 440,
              overflowX: 'auto',
            }}
          >
            {JSON.stringify(submitted, null, 2)}
          </Box>
        )}

        {/* Imperative handle demo */}
        <Box
          as="section"
          sx={{
            marginTop: 40,
            padding: 20,
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            maxWidth: 440,
          }}
        >
          <p style={{ margin: '0 0 12px', fontSize: 11, color: C.dim, letterSpacing: '0.08em' }}>
            USEIMPERATIVEHANDLE — FieldHandle API
          </p>
          <Box as="div" sx={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ActionBtn
              type="button"
              variant="ghost"
              onClick={() => emailRef.current?.focus()}
            >
              Focus email
            </ActionBtn>
            <ActionBtn
              type="button"
              variant="ghost"
              onClick={() => emailRef.current?.setValue('demo@example.com')}
            >
              Set email
            </ActionBtn>
            <ActionBtn
              type="button"
              variant="ghost"
              onClick={() => emailRef.current?.clear()}
            >
              Clear email
            </ActionBtn>
            <ActionBtn
              type="button"
              variant="ghost"
              onClick={() => alert(`email: "${emailRef.current?.getValue()}"`)}
            >
              Alert value
            </ActionBtn>
          </Box>
        </Box>
      </Box>
    </FormProvider>
  );
}

// ─── Local helpers ────────────────────────────────────────────────────────────

function fieldInputStyle(hasError: boolean): CSSProperties {
  return {
    width: '100%',
    boxSizing: 'border-box',
    padding: '9px 12px',
    background: '#0a0a0c',
    border: `1px solid ${hasError ? C.danger : C.border}`,
    borderRadius: 6,
    color: C.text,
    fontFamily: C.font,
    fontSize: 13,
    outline: 'none',
    transition: 'border-color 0.15s',
  };
}

type ActionBtnProps = {
  variant?: 'primary' | 'ghost';
  children: ReactNode;
} & ComponentPropsWithoutRef<'button'>;

function ActionBtn({ variant = 'primary', children, style, ...rest }: ActionBtnProps) {
  const styles: Record<string, CSSProperties> = {
    primary: {
      background: C.accentDim,
      color:      C.accent,
      border:     `1px solid ${C.accent}`,
    },
    ghost: {
      background: 'transparent',
      color:      C.dim,
      border:     `1px solid ${C.muted}`,
    },
  };
  return (
    <button
      {...rest}
      style={{
        padding: '7px 16px',
        borderRadius: 6,
        cursor: 'pointer',
        fontFamily: C.font,
        fontSize: 12,
        transition: 'all 0.15s',
        ...styles[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
}
