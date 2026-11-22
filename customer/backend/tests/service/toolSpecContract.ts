import { z } from "zod";

/*
 * Checks a Bedrock tool's hand-written JSON spec against the zod schema that
 * parses the model's reply (#240). The parser may be more lenient than the
 * spec (accept null, treat a required field as optional); it may never be
 * stricter, and every length limit it enforces must be told to the model.
 */

const JsonPropertySchema = z.object({ enum: z.array(z.string()).optional(), description: z.string().optional() });
const JsonObjectSchema = z.object({ properties: z.record(JsonPropertySchema), required: z.array(z.string()).optional() });

interface FieldShape {
  optional: boolean;
  enumValues: readonly string[] | null;
  minLength: number | null;
  maxLength: number | null;
}

function describeField(schema: z.ZodTypeAny): FieldShape {
  let current = schema;
  let optional = false;
  for (;;) {
    if (current instanceof z.ZodOptional) {
      optional = true;
      current = current.unwrap();
    } else if (current instanceof z.ZodNullable) current = current.unwrap();
    else if (current instanceof z.ZodEffects) current = current.innerType();
    else break;
  }
  if (current instanceof z.ZodEnum) return { optional, enumValues: current.options as readonly string[], minLength: null, maxLength: null };
  if (current instanceof z.ZodString) return { optional, enumValues: null, minLength: current.minLength, maxLength: current.maxLength };
  return { optional, enumValues: null, minLength: null, maxLength: null };
}

function mentions(text: string | undefined, value: number): boolean {
  return new RegExp(`\\b${value}\\b`).test(text ?? "");
}

/** Every way `spec` disagrees with `parser`; empty when they agree. */
export function toolSpecViolations(tool: string, parser: z.AnyZodObject, spec: Record<string, unknown>): string[] {
  const json = JsonObjectSchema.parse(spec);
  const required = new Set(json.required ?? []);
  const shape = parser.shape as Record<string, z.ZodTypeAny>;
  const violations: string[] = [];
  for (const key of Object.keys(json.properties)) {
    if (!(key in shape)) violations.push(`${tool}.${key}: in the spec but not the parser`);
  }
  for (const [key, schema] of Object.entries(shape)) {
    const property = json.properties[key];
    if (!property) {
      violations.push(`${tool}.${key}: in the parser but not the spec`);
      continue;
    }
    const field = describeField(schema);
    if (!field.optional && !required.has(key)) violations.push(`${tool}.${key}: the parser requires it but the spec does not`);
    if (field.enumValues && JSON.stringify([...field.enumValues].sort()) !== JSON.stringify([...(property.enum ?? [])].sort())) {
      violations.push(`${tool}.${key}: enum differs (parser ${field.enumValues.join("|")}, spec ${(property.enum ?? []).join("|")})`);
    }
    /* An enum already bounds the value; otherwise the model must be told each limit the parser enforces. */
    if (property.enum) continue;
    if (field.maxLength !== null && !mentions(property.description, field.maxLength)) violations.push(`${tool}.${key}: max ${field.maxLength} not in the spec`);
    if (field.minLength !== null && field.minLength > 1 && !mentions(property.description, field.minLength)) {
      violations.push(`${tool}.${key}: min ${field.minLength} not in the spec`);
    }
  }
  return violations;
}
