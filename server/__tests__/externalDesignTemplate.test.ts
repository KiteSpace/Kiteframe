import { describe, it, expect } from 'vitest';
import { getPromptTemplateForType, getValidatorForType } from '../lib/entitySchemas';
import { designJsonSchema } from '../lib/designSchema';
import { EXTERNAL_DESIGN_COMPONENTS } from '../lib/externalDesignPrompt';

describe('design prompt template', () => {
  const template = getPromptTemplateForType('design') as any;

  it('advertises the schema the submit routes validate', () => {
    expect(template.output_schema).toBe(designJsonSchema);
  });

  it('few-shot examples pass the submit validator and use listed components', () => {
    const validate = getValidatorForType('design');
    for (const ex of template.few_shot_examples) {
      expect(validate(ex.output)).toEqual({ valid: true, errors: [] });
      for (const c of ex.output.components) expect(EXTERNAL_DESIGN_COMPONENTS).toHaveProperty(c.astryxComponent);
    }
  });

  it('lists every component in the system prompt', () => {
    for (const name of Object.keys(EXTERNAL_DESIGN_COMPONENTS)) expect(template.system_prompt).toContain(`- ${name}`);
  });
});
