// deno-lint-ignore-file no-explicit-any
import "npm:reflect-metadata";
import * as z from "npm:zod";

const ZOD_SCHEMA_KEY = Symbol("zod:schema");

function validate(
  target: any,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  descriptor.value = function (...args: any[]) {
    const schemas: z.ZodTypeAny[] =
      Reflect.getOwnMetadata(ZOD_SCHEMA_KEY, target, propertyKey) || [];

    schemas.forEach((schema, index) => {
      const result = schema.safeParse(args[index]);

      if (!result.success) {
        throw new Error(
          `Validation failed for parameter at index ${index}: ${JSON.stringify(
            result.error
          )}`
        );
      }
    });

    return originalMethod.apply(this, args);
  };
}

function zodInput(schema: z.ZodTypeAny) {
  return function (
    target: any,
    propertyKey: string | symbol,
    parameterIndex: number
  ) {
    const existingSchemas: z.ZodTypeAny[] =
      Reflect.getOwnMetadata(ZOD_SCHEMA_KEY, target, propertyKey) || [];

    existingSchemas[parameterIndex] = schema;

    Reflect.defineMetadata(
      ZOD_SCHEMA_KEY,
      existingSchemas,
      target,
      propertyKey
    );
  };
}

function zodOutput(schema: z.ZodTypeAny) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const result = originalMethod.apply(this, args);

      const validation = schema.safeParse(result);

      if (!validation.success) {
        throw new Error(
          `Validation failed for the output: ${JSON.stringify(validation.data)}`
        );
      }

      return validation.data;
    };
  };
}

const schema1 = z
  .object({
    firstName: z.string().min(1).max(10),
    lastName: z.string().min(1).max(16),
  })
  .strict();

class Test {
  @validate
  @zodOutput(schema1)
  testMethod(
    @zodInput(schema1) { firstName, lastName }: z.infer<typeof schema1>
  ) {
    console.log(firstName, lastName);
    return { firstName, lastName };
  }
}

new Test().testMethod({ firstName: "john", lastName: "deep" });
