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
  isReferencedIdentifier?: () => boolean;
  node: TNode;
  parent?: unknown;
  parentPath?: BabelNodePath;
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

interface BabelBlockStatementNode {
  body?: unknown[];
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
  computed?: boolean;
  key?: unknown;
}

interface BabelReturnStatementNode {
  argument?: unknown;
}

interface BabelFunctionNode {
  body?: unknown;
  params?: unknown[];
}

interface BabelTransparentExpressionNode {
  expression?: unknown;
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

interface BabelUnaryExpressionNode {
  argument?: unknown;
  operator?: unknown;
}

type UnsupportedReferenceSource =
  | "import.meta"
  | "process"
  | "require"
  | "module"
  | "exports";

type UnsupportedImportMetaAccess =
  | {
      kind: "property";
      propertyName: string | null;
    }
  | {
      kind: "rest";
    };

interface ResolvedNodeTarget {
  node: unknown;
  path: BabelNodePath;
}

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

function getNodeType(node: unknown) {
  if (!node || (typeof node !== "object" && typeof node !== "function")) {
    return null;
  }

  const type = (node as { type?: unknown }).type;
  return typeof type === "string" ? type : null;
}

function unwrapTransparentExpression(node: unknown) {
  let current = node;

  while (current) {
    const type = getNodeType(current);

    if (
      type !== "ParenthesizedExpression" &&
      type !== "TSAsExpression" &&
      type !== "TSSatisfiesExpression" &&
      type !== "TSTypeAssertion" &&
      type !== "TSNonNullExpression" &&
      type !== "TypeCastExpression"
    ) {
      return current;
    }

    current = (current as BabelTransparentExpressionNode).expression;
  }

  return current;
}

function isDirectFunctionNode(node: unknown) {
  const type = getNodeType(unwrapTransparentExpression(node));
  return (
    type === "ArrowFunctionExpression" ||
    type === "FunctionDeclaration" ||
    type === "FunctionExpression"
  );
}

function getSingleReturnValueNode(node: unknown) {
  if (getNodeType(node) !== "BlockStatement") {
    return null;
  }

  const statements = (node as BabelBlockStatementNode).body;

  if (!Array.isArray(statements) || statements.length !== 1) {
    return null;
  }

  const [statement] = statements;

  if (getNodeType(statement) !== "ReturnStatement") {
    return null;
  }

  return (statement as BabelReturnStatementNode).argument ?? null;
}

function getDirectFunctionReturnValueNode(node: unknown) {
  const unwrappedNode = unwrapTransparentExpression(node);

  if (!isDirectFunctionNode(unwrappedNode)) {
    return null;
  }

  const functionNode = unwrappedNode as BabelFunctionNode;

  if (Array.isArray(functionNode.params) && functionNode.params.length > 0) {
    return null;
  }

  if (getNodeType(unwrappedNode) === "ArrowFunctionExpression") {
    return getNodeType(functionNode.body) === "BlockStatement"
      ? getSingleReturnValueNode(functionNode.body)
      : functionNode.body ?? null;
  }

  return getSingleReturnValueNode(functionNode.body);
}

function getAssignedValueNodeForPath(
  path: BabelNodePath,
  name: string,
  types: BabelApi["types"],
) {
  const bindingNode = path.node as { type?: unknown };

  if (bindingNode.type === "VariableDeclarator") {
    const declarator = bindingNode as BabelVariableDeclaratorNode;

    return types.isIdentifier(declarator.id, { name }) ? declarator.init : null;
  }

  if (bindingNode.type === "AssignmentExpression") {
    const assignment = bindingNode as BabelAssignmentExpressionNode;

    return types.isIdentifier(assignment.left, { name }) ? assignment.right : null;
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

function getPriorRelevantConstantViolations(
  binding: BabelBinding,
  referencePath: BabelNodePath,
) {
  const referenceStart = getNodeStart(referencePath.node);

  return (binding.constantViolations ?? []).filter((violation) => {
    const violationStart = getNodeStart(violation.node);

    if (referenceStart !== null && violationStart !== null) {
      if (violationStart > referenceStart) {
        return false;
      }
    }

    if (!referencePath.scope || !violation.scope) {
      return true;
    }

    return isScopeAncestorOrSelf(violation.scope, referencePath.scope);
  });
}

function getBindingValueTarget(
  binding: BabelBinding,
  name: string,
  referencePath: BabelNodePath,
  types: BabelApi["types"],
): ResolvedNodeTarget | null {
  const priorViolations = getPriorRelevantConstantViolations(binding, referencePath);

  if (priorViolations.length > 0) {
    const violationStarts = priorViolations.map((violation) =>
      getNodeStart(violation.node),
    );

    if (violationStarts.some((start) => start === null)) {
      return null;
    }

    const latestViolation = [...priorViolations].sort(
      (left, right) =>
        (getNodeStart(right.node) ?? Number.NEGATIVE_INFINITY) -
        (getNodeStart(left.node) ?? Number.NEGATIVE_INFINITY),
    )[0];
    const latestValueNode = getAssignedValueNodeForPath(
      latestViolation,
      name,
      types,
    );

    return latestValueNode === null
      ? null
      : {
          node: latestValueNode,
          path: latestViolation,
        };
  }

  const valueNode = getAssignedValueNodeForPath(binding.path, name, types);

  return valueNode === null
    ? null
    : {
        node: valueNode,
        path: binding.path,
      };
}

function resolveCallableTarget(
  node: unknown,
  path: BabelNodePath,
  types: BabelApi["types"],
  seenNames: Set<string>,
): ResolvedNodeTarget | null {
  const unwrappedNode = unwrapTransparentExpression(node);

  if (isDirectFunctionNode(unwrappedNode)) {
    return {
      node: unwrappedNode,
      path,
    };
  }

  if (!types.isIdentifier(unwrappedNode)) {
    return null;
  }

  const name = (unwrappedNode as { name?: unknown }).name;

  if (typeof name !== "string" || seenNames.has(name)) {
    return null;
  }

  const binding = getBinding(path, name);

  if (!binding) {
    return null;
  }

  const nextSeenNames = new Set(seenNames);
  nextSeenNames.add(name);

  if (getNodeType(binding.path.node) === "FunctionDeclaration") {
    return {
      node: binding.path.node,
      path: binding.path,
    };
  }

  const valueTarget = getBindingValueTarget(binding, name, path, types);

  if (!valueTarget) {
    return null;
  }

  return resolveCallableTarget(
    valueTarget.node,
    valueTarget.path,
    types,
    nextSeenNames,
  );
}

function resolveUnsupportedReferenceSource(
  node: unknown,
  path: BabelNodePath,
  types: BabelApi["types"],
  seenNames = new Set<string>(),
): UnsupportedReferenceSource | null {
  const unwrappedNode = unwrapTransparentExpression(node);

  if (isImportMetaExpression(unwrappedNode, types)) {
    return "import.meta";
  }

  if (
    getNodeType(unwrappedNode) === "CallExpression" ||
    getNodeType(unwrappedNode) === "OptionalCallExpression"
  ) {
    const callableTarget = resolveCallableTarget(
      (unwrappedNode as BabelCallExpressionNode).callee,
      path,
      types,
      seenNames,
    );

    if (!callableTarget) {
      return null;
    }

    const returnedNode = getDirectFunctionReturnValueNode(callableTarget.node);

    if (!returnedNode) {
      return null;
    }

    return resolveUnsupportedReferenceSource(
      returnedNode,
      callableTarget.path,
      types,
      seenNames,
    );
  }

  if (!types.isIdentifier(unwrappedNode)) {
    return null;
  }

  const name = (unwrappedNode as { name?: unknown }).name;

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

  const valueTarget = getBindingValueTarget(binding, name, path, types);

  if (!valueTarget) {
    return null;
  }

  const nextSeenNames = new Set(seenNames);
  nextSeenNames.add(name);

  return resolveUnsupportedReferenceSource(
    valueTarget.node,
    valueTarget.path,
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

      return getStaticObjectPropertyName(
        property as BabelObjectPropertyNode,
        types,
      ) === "env";
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

function getStaticObjectPropertyName(
  property: BabelObjectPropertyNode,
  types: BabelApi["types"],
): string | null {
  if (property.computed === true) {
    return types.isStringLiteral(property.key)
      ? getPropertyName(property.key, types)
      : null;
  }

  return getPropertyName(property.key, types);
}

function getUnsupportedImportMetaAccess(
  node: unknown,
  types: BabelApi["types"],
): UnsupportedImportMetaAccess | null {
  if (!types.isObjectPattern(node)) {
    return null;
  }

  for (const property of (node as BabelObjectPatternNode).properties ?? []) {
    if (types.isRestElement(property)) {
      return { kind: "rest" };
    }

    if (!types.isObjectProperty(property)) {
      continue;
    }

    const name = getStaticObjectPropertyName(
      property as BabelObjectPropertyNode,
      types,
    );

    if (name !== "url") {
      return {
        kind: "property",
        propertyName: name,
      };
    }
  }

  return null;
}

function getUnsupportedEnvMessage(source: "import.meta" | "process") {
  return source === "import.meta"
    ? "import.meta.env is Vite-specific and is not available inside uploaded artifacts in browser mode."
    : "process.env is not available in browser mode. Inline the value or use the local Node/Vite viewer.";
}

function getUnsupportedImportMetaMessage(
  access?: UnsupportedImportMetaAccess | { propertyName?: string | null },
) {
  const propertyName =
    access && "propertyName" in access ? access.propertyName : undefined;

  if (propertyName === "env") {
    return getUnsupportedEnvMessage("import.meta");
  }

  if (access && "kind" in access && access.kind === "rest") {
    return "import.meta rest destructuring is not supported inside uploaded artifacts in browser mode. Only import.meta.url is supported.";
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

    const guardIdentifierReference = (path: BabelNodePath) => {
      if (typeof path.isReferencedIdentifier === "function") {
        if (!path.isReferencedIdentifier()) {
          return;
        }
      }

      const parentNode = path.parentPath?.node ?? path.parent;

      if (
        // Allow feature detection without letting uploaded code evaluate the global.
        getNodeType(parentNode) === "UnaryExpression" &&
        (parentNode as BabelUnaryExpressionNode).operator === "typeof" &&
        (parentNode as BabelUnaryExpressionNode).argument === path.node
      ) {
        return;
      }

      const source = resolveUnsupportedReferenceSource(path.node, path, types);

      if (
        source === null ||
        source === "import.meta"
      ) {
        return;
      }

      throw path.buildCodeFrameError(getUnsupportedReferenceMessage(source));
    };

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
          getUnsupportedImportMetaMessage({ propertyName }),
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
        const unsupportedProperty = getUnsupportedImportMetaAccess(
          pattern,
          types,
        );

        if (unsupportedProperty) {
          throw path.buildCodeFrameError(
            getUnsupportedImportMetaMessage(unsupportedProperty),
          );
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
        Identifier(path: BabelNodePath) {
          guardIdentifierReference(path);
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
