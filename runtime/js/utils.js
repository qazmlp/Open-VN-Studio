import { UnreachableError } from "./errors.js";

/** @returns {never} */
export function unreachable() {
	throw new UnreachableError;
}
