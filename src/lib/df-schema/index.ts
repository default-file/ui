export type ParseIssue = {
  path: Array<string | number>
  message: string
}

export type ParseSuccess<T> = { ok: true; data: T }
export type ParseFailure = { ok: false; issues: ParseIssue[] }
export type ParseResult<T> = ParseSuccess<T> | ParseFailure

export type Schema<T> = {
  parse: (input: unknown) => T
  safeParse: (input: unknown) => ParseResult<T>
}

function failure(message: string, path: Array<string | number> = []): ParseFailure {
  return { ok: false, issues: [{ path, message }] }
}

function createSchema<T>(
  check: (input: unknown, path: Array<string | number>) => ParseResult<T>
): Schema<T> {
  return {
    safeParse(input) {
      return check(input, [])
    },
    parse(input) {
      const result = check(input, [])
      if (!result.ok) {
        throw new Error(result.issues.map((issue) => issue.message).join("; "))
      }
      return result.data
    },
  }
}

export function string(options?: { min?: number; max?: number }): Schema<string> {
  return createSchema((input, path) => {
    if (typeof input !== "string") return failure("Expected string", path)
    if (options?.min !== undefined && input.length < options.min) {
      return failure(`Expected string length >= ${options.min}`, path)
    }
    if (options?.max !== undefined && input.length > options.max) {
      return failure(`Expected string length <= ${options.max}`, path)
    }
    return { ok: true, data: input }
  })
}

export function number(options?: { min?: number; max?: number; int?: boolean }): Schema<number> {
  return createSchema((input, path) => {
    if (typeof input !== "number" || Number.isNaN(input)) {
      return failure("Expected number", path)
    }
    if (options?.int && !Number.isInteger(input)) {
      return failure("Expected integer", path)
    }
    if (options?.min !== undefined && input < options.min) {
      return failure(`Expected number >= ${options.min}`, path)
    }
    if (options?.max !== undefined && input > options.max) {
      return failure(`Expected number <= ${options.max}`, path)
    }
    return { ok: true, data: input }
  })
}

export function boolean(): Schema<boolean> {
  return createSchema((input, path) => {
    if (typeof input !== "boolean") return failure("Expected boolean", path)
    return { ok: true, data: input }
  })
}

export function literal<T extends string | number | boolean>(value: T): Schema<T> {
  return createSchema((input, path) => {
    if (input !== value) return failure(`Expected literal ${String(value)}`, path)
    return { ok: true, data: value }
  })
}

export function array<T>(item: Schema<T>): Schema<T[]> {
  return createSchema((input, path) => {
    if (!Array.isArray(input)) return failure("Expected array", path)
    const data: T[] = []
    for (let index = 0; index < input.length; index += 1) {
      const result = item.safeParse(input[index])
      if (!result.ok) {
        return {
          ok: false,
          issues: result.issues.map((issue) => ({
            ...issue,
            path: [index, ...issue.path],
          })),
        }
      }
      data.push(result.data)
    }
    return { ok: true, data }
  })
}

type ShapeSchemas = Record<string, Schema<unknown>>
type InferShape<S extends ShapeSchemas> = {
  [K in keyof S]: S[K] extends Schema<infer T> ? T : never
}

export function object<S extends ShapeSchemas>(shape: S): Schema<InferShape<S>> {
  return createSchema((input, path) => {
    if (input === null || typeof input !== "object" || Array.isArray(input)) {
      return failure("Expected object", path)
    }
    const record = input as Record<string, unknown>
    const data: Record<string, unknown> = {}
    const issues: ParseIssue[] = []
    for (const key of Object.keys(shape) as Array<keyof S & string>) {
      const field = shape[key]
      if (field === undefined) continue
      const result = field.safeParse(record[key])
      if (!result.ok) {
        for (const issue of result.issues) {
          issues.push({ ...issue, path: [key, ...issue.path] })
        }
      } else {
        data[key] = result.data
      }
    }
    if (issues.length > 0) return { ok: false, issues }
    return { ok: true, data: data as InferShape<S> }
  })
}

export function enumOf<T extends string>(values: readonly T[]): Schema<T> {
  const set = new Set(values)
  return createSchema((input, path) => {
    if (typeof input !== "string" || !set.has(input as T)) {
      return failure(`Expected one of: ${values.join(", ")}`, path)
    }
    return { ok: true, data: input as T }
  })
}
