/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright 2023 Qazm
 */

import { Scene } from "./scenes.mjs";
import { Serializable, setupSerializable } from "./serde.mjs";
import { InvalidOperationError } from "./errors.mjs";
import { unreachable } from "./utils.mjs";

export class SceneStack extends Serializable {
	/** @type {Scene[]} */
	#scenes = [];
	get scenes() { return this.#scenes; }
	set scenes(v) { this.#scenes = v; }

	/** @type {number} */
	#popCount = 0;
	/**
	 * Non-negative number.
	 * While set to a value greater than 0, will try to pop that many scenes.
	 * Reset to 0 when the scene stack becomes empty.
	 */
	get popCount() { return this.#popCount; }
	set popCount(v) {
		if (typeof v !== 'number' || !(v >= 0)) {
			throw new TypeError(`\`popCount\` must be a positive \`number\`. Tried to set it to ${v}.`);
		}
		this.#popCount = v;
	}

	/** @type {(new () => Scene)[]} */
	#pushQueue = [];
	/** While not empty, will try to push those scenes. */
	get pushQueue() { return this.#pushQueue; }
	set pushQueue(v) { this.#pushQueue = v; }

	update() {
		while (this.#popCount > 0) {
			const topMost = this.#scenes.at(-1);
			if (!topMost) break;
			if (topMost.updatePopping()) {
				this.#popCount--;
				this.execPop();
			} else {
				for (const scene of this.#scenes.slice(0, -1)) {
					scene.updateBackground();
				}
				return;
			}
		}
		this.#popCount = 0;


		if (this.#pushQueue.length > 0) {
			if (this.#scenes.at(-1)?.updateBlurring() ?? true) {
				const push = [...this.#pushQueue];
				this.#pushQueue.length = 0;
				this.execPush(...push);
			} else {
				return;
			}
		}

		this.#scenes.at(-1)?.update();
	}

	change(
		/** @type {(new () => Scene)[]} */ ...sceneClasses
	) {
		this.pop();
		this.push(...sceneClasses);
	}

	pop(popCount = 1) {
		if (this.#pushQueue.length >= popCount) {
			this.#pushQueue.length -= popCount;
		} else {
			this.#pushQueue.length = 0;
			this.#popCount += popCount;
		}
	}

	push(
		/** @type {(new () => Scene)[]} */ ...sceneClasses
	) {
		this.#pushQueue.push(...sceneClasses);
	}

	popTo(
		/** @type {typeof Scene} */ sceneClass,
		skipPastPopCountScenes = false,
	) {
		const candidates =
			skipPastPopCountScenes ? this.#scenes.slice(0, -this.popCount)
				: this.#scenes;
		const index = candidates.reverse().findIndex(s => s instanceof sceneClass);

		if (index === -1) {
			throw new InvalidOperationError("Target `Scene` not found.");
		}

		if (this.#popCount >= this.#scenes.length - index) return;

		this.pop(this.#scenes.length - this.#popCount - index);
	}

	execPush(
		/** @type {(new () => Scene)[]} */ ...sceneClasses
	) {
		if (sceneClasses.length === 0) return;

		{
			const scene = this.#scenes.at(-1);
			if (scene) scene.focused = false;
		}
		for (const sceneClass of sceneClasses) {
			const pushed = new sceneClass;
			this.#scenes.push(pushed);
			pushed.start();
		}
		(this.#scenes.at(-1) ?? unreachable()).focused = true;
	}

	execPop() {
		const scene = this.#scenes.at(-1);
		if (!scene) {
			throw new InvalidOperationError("Tried to `execPop` a `Scene` while the scene stack was empty.");
		}

		scene.focused = false;
		scene.stop();
		this.#scenes.pop();
	}
}
setupSerializable(SceneStack, 'scenes', 'popCount', 'pushQueue');
