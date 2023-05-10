import { DMessage } from "./display.mjs";

export class Transient {
	tick() { /* Empty. */ }
}

export class TMessage extends Transient {
	#target;
	constructor(
		/** @type {DMessage} */ target,
	) {
		super();
		this.#target = target;
	}
}