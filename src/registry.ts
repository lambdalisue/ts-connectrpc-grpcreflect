import { toBinary, type FileRegistry } from "@bufbuild/protobuf";
import { FileDescriptorProtoSchema } from "@bufbuild/protobuf/wkt";

/**
 * Find a proto file by the file name.
 */
export function getFileByFilename(
  registry: FileRegistry,
  filename: string,
): Uint8Array | undefined {
  const file = registry.getFile(filename);
  if (file) {
    return toBinary(FileDescriptorProtoSchema, file.proto);
  }
}

/**
 * Find the proto file that declares the given fully-qualified symbol name.
 * This field should be a fully-qualified symbol name
 * (e.g. <package>.<service>[.<method>] or <package>.<type>).
 */
export function getFileContainingSymbol(
  registry: FileRegistry,
  typeName: string,
): Uint8Array | undefined {
  const desc = registry.get(typeName);
  const file = desc?.file;
  if (file) {
    return toBinary(FileDescriptorProtoSchema, file.proto);
  }
}

/**
 * Find the proto file which defines an extension extending the given
 * message type with the given field number.
 */
export function getFileContainingExtension(
  registry: FileRegistry,
  containingType: string,
  extensionNumber: number,
): Uint8Array | undefined {
  const msg = registry.getMessage(containingType);
  if (!msg) {
    return;
  }
  const desc = registry.getExtensionFor(msg, extensionNumber);
  if (desc) {
    const file = desc.file;
    if (file) {
      return toBinary(FileDescriptorProtoSchema, file.proto);
    }
  }
}

/**
 * Finds the tag numbers used by all known extensions of the given message
 * type, and appends them to ExtensionNumberResponse in an undefined order.
 * Its corresponding method is best-effort: it's not guaranteed that the
 * reflection service will implement this method, and it's not guaranteed
 * that this method will provide all extensions. Returns
 * StatusCode::UNIMPLEMENTED if it's not implemented.
 * This field should be a fully-qualified type name. The format is
 * <package>.<type>
 */
export function getAllExtensionNumbersOfType(
  registry: FileRegistry,
  value: string,
): number[] | undefined {
  const extensions = [...registry.files].map((file) => file.extensions).flat();
  const numbers = extensions
    .filter((e) => e.typeName === value)
    .map((e) => e.number);
  return numbers;
}

/**
 * List the full names of registered services. The content will not be
 * checked.
 */
export function getListServices(
  registry: FileRegistry,
  _value: string,
): string[] {
  const services = [...registry.files].map((file) => file.services).flat();
  const serviceNames = services.map((service) => service.typeName);
  return serviceNames;
}
