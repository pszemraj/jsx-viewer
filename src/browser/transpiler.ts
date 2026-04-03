import {
  BROWSER_RUNTIME_ENTRIES,
  BROWSER_RUNTIME_SPECIFIERS,
} from "./runtimeManifest";

interface BabelTransformResult {
  code?: string | null;
}

interface BabelTransformApi {
  transform(
    source: string,
    options: {
      filename: string;
      plugins?: unknown[];
      presets?: Array<[string, Record<string, unknown>]>;
      sourceType: "module";
    },
  ): BabelTransformResult;
}

interface BabelApi {
  types: {
    isIdentifier(node: unknown, opts?: Record<string, unknown>): boolean;
    isImport(node: unknown): boolean;
    isMemberExpression(node: unknown): boolean;
    isMetaProperty(node: unknown): boolean;
    isObjectPattern(node: unknown): boolean;
    isObjectProperty(node: unknown): boolean;
    isOptionalMemberExpression(node: unknown): boolean;
    isRestElement(node: unknown): boolean;
    isStringLiteral(node: unknown): boolean;
  };
}

interface BabelBinding {
  constant?: boolean;
  constantViolations?: BabelNodePath[];
  path: BabelNodePath;
}

interface BabelScope {
  getBinding(name: string): BabelBinding | undefined;
  parent?: BabelScope | null;
}

interface BabelNodePath<TNode = unknown> {
  node: TNode;
  buildCodeFrameError(message: string): Error;
  scope?: BabelScope;
}

interface BabelSourceNode {
  source?: {
    value?: unknown;
  };
}

interface BabelCallExpressionNode {
  arguments: Array<{ value?: unknown } | unknown>;
  callee: unknown;
}

interface BabelMetaPropertyNode {
  meta?: unknown;
  property?: unknown;
}

interface BabelMemberExpressionNode {
  computed?: boolean;
  object?: unknown;
  property?: unknown;
}

interface BabelObjectPatternNode {
  properties?: unknown[];
}

interface BabelObjectPropertyNode {
  key?: unknown;
}

interface BabelVariableDeclaratorNode {
  id?: unknown;
  init?: unknown;
}

interface BabelAssignmentExpressionNode {
  left?: unknown;
  right?: unknown;
}

interface BabelAssignmentPatternNode {
  left?: unknown;
  right?: unknown;
}

type UnsupportedReferenceSource =
  | "import.meta"
  | "process"
  | "require"
  | "module"
  | "exports";

const SUPPORTED_IMPORTS = BROWSER_RUNTIME_SPECIFIERS.join(", ");
let babelApiPromise: Promise<BabelTransformApi> | null = null;

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function getBabelApi() {
  if (babelApiPromise === null) {
    babelApiPromise = import("@babel/standalone").then(
      (module) => module as unknown as BabelTransformApi,
    );
  }

  return babelApiPromise;
}

function getTranspilerOrigin() {
  return typeof window === "undefined"
    ? "http://localhost"
    : window.location.origin;
}

function getViteEnv() {
  return (
    import.meta as ImportMeta & {
      env?: { BASE_URL?: string; DEV?: boolean };
    }
  ).env;
}

function getRuntimeModuleUrl(specifier: string) {
  const entry =
    BROWSER_RUNTIME_ENTRIES[specifier as keyof typeof BROWSER_RUNTIME_ENTRIES];

  if (!entry) {
    throw new Error(
      `Unsupported bare import "${specifier}" in browser mode. ` +
        `Supported imports: ${SUPPORTED_IMPORTS}. ` +
        "Use the local Node/Vite viewer for custom packages.",
    );
  }

  const env = getViteEnv();
  const origin = getTranspilerOrigin();

  if (env?.DEV) {
    return new URL(entry.devPath, origin).toString();
  }

  const baseUrl = new URL(env?.BASE_URL ?? "/", origin);
  return new URL(`${entry.entryName}.js`, baseUrl).toString();
}

function resolveImportSpecifier(specifier: string) {
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    throw new Error(
      `Relative imports are not supported in browser mode: "${specifier}". ` +
        "Use a single-file artifact, or switch to the local Node/Vite viewer for multi-file projects.",
    );
  }

  if (specifier.startsWith("/")) {
    throw new Error(
      `Absolute path imports are not supported in browser mode: "${specifier}". ` +
        "Keep the artifact self-contained or use the local Node/Vite viewer.",
    );
  }

  if (specifier.startsWith("http://") || specifier.startsWith("https://")) {
    throw new Error(
      `Remote URL imports are intentionally disabled in browser mode: "${specifier}". ` +
        "Add the dependency to the repo runtime allowlist or use the local Node/Vite viewer.",
    );
  }

  if (specifier.startsWith("data:") || specifier.startsWith("blob:")) {
    throw new Error(
      `Non-file URL imports are not supported in browser mode: "${specifier}".`,
    );
  }

  return getRuntimeModuleUrl(specifier);
}

function isPropertyNamed(
  property: unknown,
  name: string,
  types: BabelApi["types"],
) {
  return (
    types.isIdentifier(property, { name }) ||
    (types.isStringLiteral(property) &&
      (property as { value?: unknown }).value === name)
  );
}

function isImportMetaExpression(
  node: unknown,
  types: BabelApi["types"],
): node is BabelMetaPropertyNode {
  return (
    types.isMetaProperty(node) &&
    types.isIdentifier((node as BabelMetaPropertyNode).meta, {
      name: "import",
    }) &&
    types.isIdentifier((node as BabelMetaPropertyNode).property, {
      name: "meta",
    })
  );
}

function hasBinding(path: BabelNodePath, name: string) {
  return path.scope?.getBinding(name) !== undefined;
}

function getBinding(path: BabelNodePath, name: string) {
  return path.scope?.getBinding(name);
}

function getBindingValueNode(
  binding: BabelBinding,
  name: string,
  types: BabelApi["types"],
) {
  const bindingNode = binding.path.node as { type?: unknown };

  if (bindingNode.type === "VariableDeclarator") {
    const declarator = bindingNode as BabelVariableDeclaratorNode;

    return types.isIdentifier(declarator.id, { name }) ? declarator.init : null;
  }

  if (bindingNode.type === "AssignmentPattern") {
    const pattern = bindingNode as BabelAssignmentPatternNode;

    return types.isIdentifier(pattern.left, { name }) ? pattern.right : null;
  }

  return null;
}

function getNodeStart(node: unknown) {
  const start = (node as { start?: unknown }).start;
  return typeof start === "number" ? start : null;
}

function isScopeAncestorOrSelf(
  candidate: BabelScope | undefined,
  target: BabelScope | undefined,
) {
  if (!candidate || !target) {
    return false;
  }

  let current: BabelScope | null | undefined = target;

  while (current) {
    if (current === candidate) {
      return true;
    }

    current = current.parent;
  }

  return false;
}

function bindingHasPriorRelevantConstantViolation(
  binding: BabelBinding,
  referencePath: BabelNodePath,
) {
  const referenceStart = getNodeStart(referencePath.node);

  if (referenceStart === null) {
    return true;
  }

  return (binding.constantViolations ?? []).some((violation) => {
    const violationStart = getNodeStart(violation.node);

    if (violationStart === null || violationStart > referenceStart) {
      return violationStart === null;
    }

    if (!referencePath.scope || !violation.scope) {
      return true;
    }

    return isScopeAncestorOrSelf(violation.scope, referencePath.scope);
  });
}

function resolveUnsupportedReferenceSource(
  node: unknown,
  path: BabelNodePath,
  types: BabelApi["types"],
  seenNames = new Set<string>(),
): UnsupportedReferenceSource | null {
  if (isImportMetaExpression(node, types)) {
    return "import.meta";
  }

  if (!types.isIdentifier(node)) {
    return null;
  }

  const name = (node as { name?: unknown }).name;

  if (typeof name !== "string") {
    return null;
  }

  if (
    (name === "process" ||
      name === "require" ||
      name === "module" ||
      name === "exports") &&
    !hasBinding(path, name)
  ) {
    return name;
  }

  if (seenNames.has(name)) {
    return null;
  }

  const binding = getBinding(path, name);

  if (!binding) {
    return null;
  }

  if (
    binding.constant !== true &&
    bindingHasPriorRelevantConstantViolation(binding, path)
  ) {
    return null;
  }

  const valueNode = getBindingValueNode(binding, name, types);

  if (!valueNode) {
    return null;
  }

  const nextSeenNames = new Set(seenNames);
  nextSeenNames.add(name);

  return resolveUnsupportedReferenceSource(
    valueNode,
    binding.path,
    types,
    nextSeenNames,
  );
}

function objectPatternHasEnvProperty(node: unknown, types: BabelApi["types"]) {
  if (!types.isObjectPattern(node)) {
    return false;
  }

  return ((node as BabelObjectPatternNode).properties ?? []).some(
    (property) => {
      if (!types.isObjectProperty(property)) {
        return false;
      }

      return isPropertyNamed(
        (property as BabelObjectPropertyNode).key,
        "env",
        types,
      );
    },
  );
}

function getPropertyName(
  property: unknown,
  types: BabelApi["types"],
): string | null {
  if (types.isIdentifier(property)) {
    const name = (property as { name?: unknown }).name;
    return typeof name === "string" ? name : null;
  }

  if (types.isStringLiteral(property)) {
    const value = (property as { value?: unknown }).value;
    return typeof value === "string" ? value : null;
  }

  return null;
}

function getUnsupportedImportMetaProperty(
  node: unknown,
  types: BabelApi["types"],
): string | null {
  if (!types.isObjectPattern(node)) {
    return null;
  }

  for (const property of (node as BabelObjectPatternNode).properties ?? []) {
    if (types.isRestElement(property)) {
      return null;
    }

    if (!types.isObjectProperty(property)) {
      continue;
    }

    const name = getPropertyName(
      (property as BabelObjectPropertyNode).key,
      types,
    );

    if (name !== "url") {
      return typeof name === "string" ? name : null;
    }
  }

  return null;
}

function getUnsupportedEnvMessage(source: "import.meta" | "process") {
  return source === "import.meta"
    ? "import.meta.env is Vite-specific and is not available inside uploaded artifacts in browser mode."
    : "process.env is not available in browser mode. Inline the value or use the local Node/Vite viewer.";
}

function getUnsupportedImportMetaMessage(propertyName?: string | null) {
  if (propertyName === "env") {
    return getUnsupportedEnvMessage("import.meta");
  }

  if (propertyName) {
    return `import.meta.${propertyName} is not available inside uploaded artifacts in browser mode. Only import.meta.url is supported.`;
  }

  return "Only import.meta.url is supported inside uploaded artifacts in browser mode.";
}

function getUnsupportedReferenceMessage(
  source: "process" | "require" | "module" | "exports",
) {
  switch (source) {
    case "process":
      return "process is not available in browser mode. Inline the value or use the local Node/Vite viewer.";
    case "require":
      return "CommonJS require() is not supported in browser mode.";
    case "module":
      return "CommonJS module is not supported in browser mode.";
    case "exports":
      return "CommonJS exports are not supported in browser mode.";
  }
}

function createBrowserGuardsPlugin() {
  return function browserGuardsPlugin(babel: BabelApi) {
    const { types } = babel;

    const guardMemberExpression = (
      path: BabelNodePath<BabelMemberExpressionNode>,
    ) => {
      const source = resolveUnsupportedReferenceSource(
        path.node.object,
        path,
        types,
      );

      const propertyName = getPropertyName(path.node.property, types);

      if (source === "import.meta") {
        if (propertyName === "url") {
          return;
        }

        throw path.buildCodeFrameError(
          getUnsupportedImportMetaMessage(propertyName),
        );
      }

      if (source === "process") {
        throw path.buildCodeFrameError(
          propertyName === "env"
            ? getUnsupportedEnvMessage("process")
            : getUnsupportedReferenceMessage("process"),
        );
      }

      if (source === "module") {
        throw path.buildCodeFrameError(
          propertyName === "exports"
            ? getUnsupportedReferenceMessage("exports")
            : propertyName === "require"
              ? getUnsupportedReferenceMessage("require")
              : getUnsupportedReferenceMessage("module"),
        );
      }

      if (source === "exports") {
        throw path.buildCodeFrameError(getUnsupportedReferenceMessage("exports"));
      }
    };

    const guardUnsupportedSourceAccess = (
      path: BabelNodePath,
      pattern: unknown,
      sourceNode: unknown,
    ) => {
      const source = resolveUnsupportedReferenceSource(sourceNode, path, types);

      if (!source) {
        return;
      }

      if (source === "import.meta") {
        const unsupportedProperty = getUnsupportedImportMetaProperty(
          pattern,
          types,
        );

        if (unsupportedProperty) {
          throw path.buildCodeFrameError(
            getUnsupportedImportMetaMessage(unsupportedProperty),
          );
        }

        if (objectPatternHasEnvProperty(pattern, types)) {
          throw path.buildCodeFrameError(getUnsupportedEnvMessage(source));
        }

        return;
      }

      if (source === "process" && objectPatternHasEnvProperty(pattern, types)) {
        throw path.buildCodeFrameError(getUnsupportedEnvMessage(source));
      }

      throw path.buildCodeFrameError(getUnsupportedReferenceMessage(source));
    };

    return {
      name: "jsx-viewer-browser-guards",
      visitor: {
        AssignmentExpression(
          path: BabelNodePath<BabelAssignmentExpressionNode>,
        ) {
          guardUnsupportedSourceAccess(path, path.node.left, path.node.right);
        },
        AssignmentPattern(path: BabelNodePath<BabelAssignmentPatternNode>) {
          guardUnsupportedSourceAccess(path, path.node.left, path.node.right);
        },
        MemberExpression(path: BabelNodePath<BabelMemberExpressionNode>) {
          guardMemberExpression(path);
        },
        OptionalMemberExpression(
          path: BabelNodePath<BabelMemberExpressionNode>,
        ) {
          guardMemberExpression(path);
        },
        VariableDeclarator(path: BabelNodePath<BabelVariableDeclaratorNode>) {
          guardUnsupportedSourceAccess(path, path.node.id, path.node.init);
        },
      },
    };
  };
}

function createImportRewritePlugin() {
  return function rewriteImportsPlugin(babel: BabelApi) {
    const { types } = babel;

    const rewriteSource = (path: BabelNodePath<BabelSourceNode>) => {
      const source = path.node.source;
      const value = source?.value;

      if (!source || typeof value !== "string") {
        return;
      }

      source.value = resolveImportSpecifier(value);
    };

    return {
      name: "jsx-viewer-browser-import-rewrite",
      visitor: {
        ImportDeclaration(path: BabelNodePath<BabelSourceNode>) {
          rewriteSource(path);
        },
        ExportNamedDeclaration(path: BabelNodePath<BabelSourceNode>) {
          rewriteSource(path);
        },
        ExportAllDeclaration(path: BabelNodePath<BabelSourceNode>) {
          rewriteSource(path);
        },
        CallExpression(path: BabelNodePath<BabelCallExpressionNode>) {
          const callee = path.node.callee;

          if (types.isImport(callee)) {
            const [argument] = path.node.arguments;

            if (!types.isStringLiteral(argument)) {
              throw path.buildCodeFrameError(
                "Dynamic import() must use a string literal in browser mode.",
              );
            }

            (argument as { value: string }).value = resolveImportSpecifier(
              (argument as { value: string }).value,
            );
            return;
          }

          if (
            resolveUnsupportedReferenceSource(callee, path, types) === "require"
          ) {
            throw path.buildCodeFrameError(
              "CommonJS require() is not supported in browser mode.",
            );
          }
        },
      },
    };
  };
}

function requireCode(result: BabelTransformResult, filename: string) {
  if (typeof result.code === "string" && result.code.trim().length > 0) {
    return result.code;
  }

  throw new Error(`Babel produced an empty module for ${filename}.`);
}

export interface TranspiledArtifact {
  code: string;
}

export async function transpileArtifact(
  source: string,
  filename: string,
): Promise<TranspiledArtifact> {
  try {
    const babel = await getBabelApi();
    const compiled = requireCode(
      babel.transform(source, {
        filename,
        plugins: [createBrowserGuardsPlugin()],
        presets: [
          ["typescript", { allExtensions: true, isTSX: true }],
          ["react", { runtime: "automatic" }],
        ],
        sourceType: "module",
      }),
      filename,
    );

    const rewritten = requireCode(
      babel.transform(compiled, {
        filename,
        plugins: [createImportRewritePlugin()],
        sourceType: "module",
      }),
      filename,
    );

    return { code: rewritten };
  } catch (error) {
    throw new Error(`[${filename}] ${toError(error).message}`);
  }
}
