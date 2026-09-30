type Evaluate = (x: number) => number;

const functions: Record<string, (value: number) => number> = {
  sqrt: Math.sqrt, abs: Math.abs, sin: Math.sin, cos: Math.cos, tan: Math.tan,
  csc: (x) => 1 / Math.sin(x), sec: (x) => 1 / Math.cos(x), cot: (x) => 1 / Math.tan(x),
  arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan,
  arccsc: (x) => Math.asin(1 / x), arcsec: (x) => Math.acos(1 / x), arccot: (x) => Math.atan2(1, x),
  ln: Math.log, log: Math.log10, exp: Math.exp,
};
const functionNames = [...Object.keys(functions), "root"].sort((a, b) => b.length - a.length);

/** Parse a scalar real expression without evaluating JavaScript supplied by the user. */
export function parseEquation(raw: string, variables: Record<string, number> = {}) {
  const sides = raw.toLowerCase().replace(/−/g, "-").replace(/÷/g, "/")
    .replace(/[·×]/g, "*").replace(/π/g, "pi").replace(/\s/g, "").split("=");
  if (sides.length !== 2) throw new Error("equation");
  const [left, expression] = sides;
  const declaredName = left.match(/^([a-z][a-z0-9_]*)\(x\)$/)?.[1];
  if (left !== "y" && !declaredName) throw new Error("equation");
  if (!expression || expression.length > 2000) throw new Error("expression");
  const tokens: string[] = [];
  for (let i = 0; i < expression.length;) {
    const rest = expression.slice(i);
    const token = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)/)?.[0]
      ?? functionNames.find((name) => rest.startsWith(name))
      ?? (rest.startsWith("pi") ? "pi" : rest[0]);
    if (!/^(?:[a-z]+|\d+(?:\.\d*)?|\.\d+|[+\-*/^()|_])$/.test(token))
      throw new Error("character");
    tokens.push(token);
    i += token.length;
  }
  let index = 0, absoluteDepth = 0;
  const usedVariables = new Set<string>();
  const peek = () => tokens[index];
  const take = (token: string) => {
    if (peek() !== token) throw new Error("syntax");
    index++;
  };
  const group = (): Evaluate => {
    take("(");
    const value = sum();
    take(")");
    return value;
  };
  const primary = (): Evaluate => {
    const token = peek();
    if (token === "(") return group();
    if (token === "|") {
      index++;
      absoluteDepth++;
      const value = sum();
      take("|");
      absoluteDepth--;
      return (x) => Math.abs(value(x));
    }
    if (token && /^(?:\d|\.)/.test(token)) {
      index++;
      const value = Number(token);
      return () => value;
    }
    if (token === "root") {
      index++;
      const degree = group(), value = group();
      return (x) => {
        const n = degree(x), v = value(x);
        if (n === 0) return NaN;
        return v < 0 && Number.isInteger(n) && Math.abs(n % 2) === 1
          ? -((-v) ** (1 / n)) : v ** (1 / n);
      };
    }
    if (token && Object.hasOwn(functions, token)) {
      index++;
      if (token === "log" && peek() === "_") {
        index++;
        const base = primary(), value = group();
        return (x) => {
          const b = base(x);
          return b > 0 && b !== 1 ? Math.log(value(x)) / Math.log(b) : NaN;
        };
      }
      const value = group();
      return (x) => functions[token](value(x));
    }
    if (token === "x") { index++; return (x) => x; }
    if (token && /^[a-z]$/.test(token) && Object.hasOwn(variables, token)) {
      index++;
      usedVariables.add(token);
      return () => variables[token];
    }
    if (token === "pi" || token === "e") {
      index++;
      return () => token === "pi" ? Math.PI : Math.E;
    }
    throw new Error("symbol");
  };
  const power = (): Evaluate => {
    const base = primary();
    if (peek() !== "^") return base;
    index++;
    const exponent = unary();
    return (x) => base(x) ** exponent(x);
  };
  const unary = (): Evaluate => {
    if (peek() === "+") { index++; return unary(); }
    if (peek() === "-") { index++; const value = unary(); return (x) => -value(x); }
    return power();
  };
  const product = (): Evaluate => {
    let value = unary();
    while (index < tokens.length) {
      const token = peek();
      const implicit = token === "(" || (token === "|" && absoluteDepth === 0)
        || /^(?:[a-z]|\d|\.)/.test(token);
      if (token !== "*" && token !== "/" && !implicit) break;
      if (!implicit) index++;
      const a = value, b = unary();
      value = token === "/" ? (x) => a(x) / b(x) : (x) => a(x) * b(x);
    }
    return value;
  };
  const sum = (): Evaluate => {
    let value = product();
    while (peek() === "+" || peek() === "-") {
      const operator = tokens[index++], a = value, b = product();
      value = operator === "+" ? (x) => a(x) + b(x) : (x) => a(x) - b(x);
    }
    return value;
  };
  const evaluate = sum();
  if (index !== tokens.length) throw new Error("syntax");
  return { normalized: `${left}=${expression}`, declaredName, evaluate, usedVariables };
}

/** Rename a single-letter parameter while preserving function names and LaTeX commands. */
export function renameMathVariable(raw: string, previous: string, next: string) {
  const equals = raw.indexOf("=");
  if (equals < 0) return raw;
  const keywords = [...functionNames, "pi"].join("|");
  const pattern = new RegExp(`\\\\[a-zA-Z]+|${keywords}|[a-zA-Z]`, "g");
  return raw.slice(0, equals + 1) + raw.slice(equals + 1).replace(pattern,
    (token) => token === previous ? next : token);
}
