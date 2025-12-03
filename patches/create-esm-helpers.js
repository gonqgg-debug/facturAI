import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const esmDir = join(__dirname, '../node_modules/@swc/helpers/esm');

// ESM implementations for missing helpers
const helpers = {
  '_check_private_redeclaration': `
export function _(obj, privateCollection) {
    if (privateCollection.has(obj)) {
        throw new TypeError("Cannot initialize the same private elements twice on an object");
    }
}
export { _ as default };
`,
  '_class_private_field_init': `
function checkPrivateRedeclaration(obj, privateCollection) {
    if (privateCollection.has(obj)) {
        throw new TypeError("Cannot initialize the same private elements twice on an object");
    }
}
export function _(obj, privateMap, value) {
    checkPrivateRedeclaration(obj, privateMap);
    privateMap.set(obj, value);
}
export { _ as default };
`,
  '_class_private_field_get': `
function classExtractFieldDescriptor(receiver, privateMap, action) {
    if (!privateMap.has(receiver)) throw new TypeError("attempted to " + action + " private field on non-instance");
    return privateMap.get(receiver);
}
export function _(receiver, privateMap) {
    var descriptor = classExtractFieldDescriptor(receiver, privateMap, "get");
    return descriptor.value;
}
export { _ as default };
`,
  '_class_private_field_set': `
function classExtractFieldDescriptor(receiver, privateMap, action) {
    if (!privateMap.has(receiver)) throw new TypeError("attempted to " + action + " private field on non-instance");
    return privateMap.get(receiver);
}
export function _(receiver, privateMap, value) {
    var descriptor = classExtractFieldDescriptor(receiver, privateMap, "set");
    descriptor.value = value;
    return value;
}
export { _ as default };
`,
  '_class_extract_field_descriptor': `
export function _(receiver, privateMap, action) {
    if (!privateMap.has(receiver)) throw new TypeError("attempted to " + action + " private field on non-instance");
    return privateMap.get(receiver);
}
export { _ as default };
`,
  '_array_like_to_array': `
export function _(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];
    return arr2;
}
export { _ as default };
`,
  '_super_prop_base': `
function getPrototypeOf(o) {
    return Object.getPrototypeOf ? Object.getPrototypeOf(o) : o.__proto__;
}
export function _(object, property) {
    while (!Object.prototype.hasOwnProperty.call(object, property)) {
        object = getPrototypeOf(object);
        if (object === null) break;
    }
    return object;
}
export { _ as default };
`,
  '_get': `
function superPropBase(object, property) {
    while (!Object.prototype.hasOwnProperty.call(object, property)) {
        object = Object.getPrototypeOf(object);
        if (object === null) break;
    }
    return object;
}
export function _(target, property, receiver) {
    if (typeof Reflect !== "undefined" && Reflect.get) {
        return Reflect.get(target, property, receiver || target);
    }
    var base = superPropBase(target, property);
    if (!base) return;
    var desc = Object.getOwnPropertyDescriptor(base, property);
    if (desc.get) return desc.get.call(receiver || target);
    return desc.value;
}
export { _ as default };
`,
  '_set': `
function superPropBase(object, property) {
    while (!Object.prototype.hasOwnProperty.call(object, property)) {
        object = Object.getPrototypeOf(object);
        if (object === null) break;
    }
    return object;
}
export function _(target, property, value, receiver, isStrict) {
    if (typeof Reflect !== "undefined" && Reflect.set) {
        return Reflect.set(target, property, value, receiver || target);
    }
    var base = superPropBase(target, property);
    if (base) {
        var desc = Object.getOwnPropertyDescriptor(base, property);
        if (desc && desc.set) {
            desc.set.call(receiver || target, value);
            return true;
        }
    }
    if (receiver) receiver[property] = value;
    return true;
}
export { _ as default };
`,
};

// Write all helpers
for (const [name, content] of Object.entries(helpers)) {
  const filePath = join(esmDir, `${name}.js`);
  writeFileSync(filePath, content.trim() + '\n');
  console.log(`Created ${name}.js`);
}

console.log('Done!');
