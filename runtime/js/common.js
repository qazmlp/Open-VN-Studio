/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright 2023 Qazm
 */

export const INIT = Symbol('init method key');

export class Obj extends null {
	constructor() {
		const constructed = Object.create(new.target.prototype);
		Obj.prototype[INIT].apply(constructed);
		return constructed;
	}

	toString() {
		return this.constructor.name;
	}

	/**
	 * Always hide the base method and make a new call in the constructor.
	 * That's a little unorthodox, but it works nicely with private properties.
	 */
	[INIT]() { /* Empty. */ }
}

export let time = 0;
export let frameTime = 0;

export function setTime(t) {
	frameTime = t - time;
	time = t;
}