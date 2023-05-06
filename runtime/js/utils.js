import { UnreachableError } from "./errors.js";

/** @returns {never} */
export function unreachable() {
	throw new UnreachableError;
}

/**
 * @template T
 * @returns {T}
 */
export function deepCloneNode(
	/** @type {T & Node} */ e
) {
	// @ts-ignore The definition of `Node.cloneNode` that ships with Code is, annoyingly, not generic.
	return e.cloneNode(true);
}
