export interface LoadTracker {
  begin(): number;
  isCurrent(token: number): boolean;
}

export function createLoadTracker(): LoadTracker {
  let currentToken = 0;

  return {
    begin() {
      currentToken += 1;
      return currentToken;
    },
    isCurrent(token) {
      return token === currentToken;
    },
  };
}
