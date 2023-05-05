export class Obj extends null {
	constructor() {
		const constructed = Object.create(new.target.prototype);
		constructed.init();
		return constructed;
	}

	toString() {
		return this.constructor.name;
	}

	init() { /* Empty. */ }
}

export let time = 0;
export let frameTime = 0;

export function setTime(t) {
	frameTime = t - time;
	time = t;
}