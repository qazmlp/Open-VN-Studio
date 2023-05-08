/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright 2023 Qazm
 */

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
