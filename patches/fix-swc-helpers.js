// This script creates missing ESM files for @swc/helpers
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const helpersDir = join(__dirname, '../node_modules/@swc/helpers/esm');

const missingFiles = [
  '_class_private_field_init',
  '_class_private_field_get', 
  '_class_private_field_set',
  '_class_private_field_destructure',
  '_class_private_field_update',
  '_class_extract_field_descriptor',
  '_class_check_private_static_access',
  '_class_static_private_field_spec_get',
  '_class_static_private_field_spec_set',
  '_class_static_private_field_destructure',
  '_class_static_private_method_get',
  '_class_static_private_field_update',
  '_array_like_to_array',
  '_super_prop_base',
  '_get',
  '_set',
  '_construct',
  '_wrap_native_super',
  '_async_iterator',
  '_async_generator_delegate',
  '_object_without_properties',
  '_object_without_properties_loose',
  '_initializer_define_property',
  '_update',
  '_using_ctx',
];

missingFiles.forEach(name => {
  const filePath = join(helpersDir, `${name}.js`);
  if (!existsSync(filePath)) {
    // Create a minimal ESM export that re-exports from CJS
    const content = `export { _ as default, _ } from "../cjs/${name}.cjs";\n`;
    try {
      writeFileSync(filePath, content);
      console.log(`Created ${name}.js`);
    } catch (e) {
      console.error(`Failed to create ${name}.js:`, e.message);
    }
  }
});

console.log('Done patching @swc/helpers');
