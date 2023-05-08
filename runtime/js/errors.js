/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright 2023 Qazm
 */

export class InvalidOperationError extends Error { }
export class UnreachableError extends Error {
	constructor() {
		super("This shouldn't happen.");
	}
}