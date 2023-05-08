/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright 2023 Qazm
 */

export class Obj extends null {
	constructor(...args) {
		const constructed = Object.create(new.target.prototype);
		constructed.init(...args);
		return constructed;
	}

	toString() {
		return this.constructor.name;
	}

	init(...args) { /* Empty. */ }
}

export let time = 0;
export let frameTime = 0;

export function setTime(t) {
	frameTime = t - time;
	time = t;
}