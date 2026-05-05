# JavaScript Code Standards

- Prefer explicit named parameters and full typing (TypeScript/JSDoc); avoid `any`, `...args`, and implicit shapes
- Never mutate inputs or rely on shared mutable state; use `const` by default and return new values
- Use explicit, predictable logic: strict equality (`===`), no truthy/falsy shortcuts, no implicit `this`
- Handle errors and async correctly: throw `Error` (no sentinels), no swallowed errors, no floating promises, don’t mix `.then()` with `async/await`
- Do not assume or invent: validate external inputs, don’t hallucinate APIs/imports, and be explicit about runtime (Node vs browser)