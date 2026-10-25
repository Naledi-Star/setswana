import { z } from 'zod'

export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  return schema.parse(body)
}

export function parseQuery<T extends z.ZodType>(schema: T, query: unknown): z.infer<T> {
  return schema.parse(query)
}

export const uuidParam = z.string().uuid('Expected a valid id.')
