// Minimal JSON-Schema validator for the subset used by tool definitions.
// Every tool input coming from the model is validated here before anything
// touches Premiere (inputs are streamed eagerly, so the API does not
// validate them for us).

function typeOf(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (Number.isInteger(v)) return "integer";
  return typeof v;
}

function typeMatches(expected, v) {
  const t = typeOf(v);
  if (expected === "number") return t === "number" || t === "integer";
  return expected === t;
}

/**
 * Validate `value` against `schema`. Returns an array of error strings
 * (empty when valid).
 */
export function validate(schema, value, path = "$", errors = []) {
  if (!schema || typeof schema !== "object") return errors;
  if (schema.anyOf) {
    const ok = schema.anyOf.some((s) => validate(s, value, path, []).length === 0);
    if (!ok) errors.push(`${path}: does not match any allowed shape`);
    return errors;
  }
  if (schema.oneOf) {
    const n = schema.oneOf.filter((s) => validate(s, value, path, []).length === 0).length;
    if (n !== 1) errors.push(`${path}: must match exactly one allowed shape (matched ${n})`);
    return errors;
  }
  if ("const" in schema && value !== schema.const) {
    errors.push(`${path}: must equal ${JSON.stringify(schema.const)}`);
    return errors;
  }
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => typeMatches(t, value))) {
      errors.push(`${path}: expected ${types.join("|")}, got ${typeOf(value)}`);
      return errors;
    }
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: must be one of ${schema.enum.map((e) => JSON.stringify(e)).join(", ")}`);
  }
  const t = typeOf(value);
  if (t === "number" || t === "integer") {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path}: must be >= ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path}: must be <= ${schema.maximum}`);
    if (!isFinite(value)) errors.push(`${path}: must be finite`);
  }
  if (t === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path}: shorter than ${schema.minLength}`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path}: longer than ${schema.maxLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path}: does not match pattern ${schema.pattern}`);
  }
  if (t === "array") {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path}: needs at least ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path}: at most ${schema.maxItems} items`);
    if (schema.items) value.forEach((v, i) => validate(schema.items, v, `${path}[${i}]`, errors));
  }
  if (t === "object") {
    const props = schema.properties || {};
    for (const r of schema.required || []) {
      if (!(r in value) || value[r] === undefined) errors.push(`${path}.${r}: is required`);
    }
    for (const [k, v] of Object.entries(value)) {
      if (props[k]) validate(props[k], v, `${path}.${k}`, errors);
      else if (schema.additionalProperties === false) errors.push(`${path}.${k}: unknown property`);
      else if (typeof schema.additionalProperties === "object") validate(schema.additionalProperties, v, `${path}.${k}`, errors);
    }
  }
  return errors;
}

export function assertValid(schema, value, label = "input") {
  const errs = validate(schema, value);
  if (errs.length) {
    const e = new Error(`Invalid ${label}: ${errs.slice(0, 12).join("; ")}`);
    e.validationErrors = errs;
    throw e;
  }
  return value;
}

// Small helpers to keep tool schemas terse and consistent.
export const S = {
  str: (description, extra = {}) => ({ type: "string", description, ...extra }),
  num: (description, extra = {}) => ({ type: "number", description, ...extra }),
  int: (description, extra = {}) => ({ type: "integer", description, ...extra }),
  bool: (description) => ({ type: "boolean", description }),
  enm: (values, description) => ({ type: "string", enum: values, description }),
  arr: (items, description, extra = {}) => ({ type: "array", items, description, ...extra }),
  obj: (properties, required = [], description, extra = {}) => ({
    type: "object",
    properties,
    required,
    additionalProperties: false,
    ...(description ? { description } : {}),
    ...extra,
  }),
  // Time values: seconds (number) or timecode string "HH:MM:SS:FF".
  time: (description) => ({ type: ["number", "string"], description: `${description} (seconds, or timecode HH:MM:SS:FF)` }),
};
