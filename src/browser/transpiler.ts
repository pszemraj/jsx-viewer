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
    isStringLiteral(node: unknown): boolean;
  };
}

interface BabelScope {
  hasBinding(name: string): boolean;
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
  return (import.meta as ImportMeta & {
    env?: { BASE_URL?: string; DEV?: boolean };
  }).env;
}

function getRuntimeModuleUrl(specifier: string) {
  const entry =
    BROWSER_RUNTIME_ENTRIES[
      specifier as keyof typeof BROWSER_RUNTIME_ENTRIES
    ];

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
    types.isIdentifier((node as BabelMetaPropertyNode).meta, { name: "import" }) &&
    types.isIdentifier((node as BabelMetaPropertyNode).property, { name: "meta" })
  );
}

function isImportMetaEnvExpression(
  node: unknown,
  types: BabelApi["types"],
): node is BabelMemberExpressionNode {
  return (
    (types.isMemberExpression(node) ||
      types.isOptionalMemberExpression(node)) &&
    isImportMetaExpression((node as BabelMemberExpressionNode).object, types) &&
    isPropertyNamed((node as BabelMemberExpressionNode).property, "env", types)
  );
}

function hasBinding(path: BabelNodePath, name: string) {
  return path.scope?.hasBinding(name) === true;
}

function isUnboundGlobalIdentifier(
  node: unknown,
  path: BabelNodePath,
  name: string,
  types: BabelApi["types"],
) {
  return types.isIdentifier(node, { name }) && !hasBinding(path, name);
}

function isUnboundGlobalMemberExpression(
  path: BabelNodePath<BabelMemberExpressionNode>,
  objectName: string,
  propertyName: string | null,
  types: BabelApi["types"],
) {
  if (
    !isUnboundGlobalIdentifier(path.node.object, path, objectName, types)
  ) {
    return false;
  }

  return propertyName === null
    ? true
    : isPropertyNamed(path.node.property, propertyName, types);
}

function getUnsupportedEnvSource(
  node: unknown,
  path: BabelNodePath,
  types: BabelApi["types"],
) {
  if (isImportMetaExpression(node, types)) {
    return "import.meta" as const;
  }

  if (isUnboundGlobalIdentifier(node, path, "process", types)) {
    return "process" as const;
  }

  return null;
}

function objectPatternHasEnvProperty(
  node: unknown,
  types: BabelApi["types"],
) {
  if (!types.isObjectPattern(node)) {
    return false;
  }

  return ((node as BabelObjectPatternNode).properties ?? []).some((property) => {
    if (!types.isObjectProperty(property)) {
      return false;
    }

    return isPropertyNamed((property as BabelObjectPropertyNode).key, "env", types);
  });
}

function getUnsupportedEnvMessage(source: "import.meta" | "process") {
  return source === "import.meta"
    ? "import.meta.env is Vite-specific and is not available inside uploaded artifacts in browser mode."
    : "process.env is not available in browser mode. Inline the value or use the local Node/Vite viewer.";
}

function createBrowserGuardsPlugin() {
  return function browserGuardsPlugin(babel: BabelApi) {
    const { types } = babel;

    const guardMemberExpression = (
      path: BabelNodePath<BabelMemberExpressionNode>,
    ) => {
      if (isImportMetaEnvExpression(path.node, types)) {
        throw path.buildCodeFrameError(getUnsupportedEnvMessage("import.meta"));
      }

      if (isUnboundGlobalMemberExpression(path, "process", "env", types)) {
        throw path.buildCodeFrameError(getUnsupportedEnvMessage("process"));
      }

      if (
        isUnboundGlobalMemberExpression(path, "module", "exports", types) ||
        isUnboundGlobalMemberExpression(path, "exports", null, types)
      ) {
        throw path.buildCodeFrameError(
          "CommonJS exports are not supported in browser mode.",
        );
      }
    };

    const guardPatternEnvAccess = (
      path: BabelNodePath,
      pattern: unknown,
      sourceNode: unknown,
    ) => {
      const source = getUnsupportedEnvSource(sourceNode, path, types);

      if (!source || !objectPatternHasEnvProperty(pattern, types)) {
        return;
      }

      throw path.buildCodeFrameError(getUnsupportedEnvMessage(source));
    };

    return {
      name: "jsx-viewer-browser-guards",
      visitor: {
        AssignmentExpression(path: BabelNodePath<BabelAssignmentExpressionNode>) {
          guardPatternEnvAccess(path, path.node.left, path.node.right);
        },
        AssignmentPattern(path: BabelNodePath<BabelAssignmentPatternNode>) {
          guardPatternEnvAccess(path, path.node.left, path.node.right);
        },
        MemberExpression(path: BabelNodePath<BabelMemberExpressionNode>) {
          guardMemberExpression(path);
        },
        OptionalMemberExpression(path: BabelNodePath<BabelMemberExpressionNode>) {
          guardMemberExpression(path);
        },
        VariableDeclarator(path: BabelNodePath<BabelVariableDeclaratorNode>) {
          guardPatternEnvAccess(path, path.node.id, path.node.init);
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
            types.isIdentifier(callee, { name: "require" }) &&
            !hasBinding(path, "require")
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
