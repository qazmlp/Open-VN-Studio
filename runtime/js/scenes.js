/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright 2023 Qazm
 */

import { scenes } from "./main.js";
import { Serializable, setupSerializable } from "./serde.js";

export class Scene extends Serializable {
	start() { /* Empty. */ }
	stop() { /* Empty. */ }

	#focused = false;
	get focused() { return this.#focused; }
	set focused(v) {
		if (v === this.#focused) return;
		this.#focused = v;
		if (v) {
			this.onFocused();
		} else {
			this.onFocusLost();
		}
	}

	onFocused() { /* Empty. */ }
	onFocusLost() { /* Empty. */ }

	update() { /* Empty. */ }
	updateBlurring() { return true; }
	updatePopping() { return true; }
	updateBackground() { /* Empty. */ }
}
setupSerializable(Scene, 'focused');

export class Splash extends Scene {
	onFocused() {
		super.onFocused();

		//TODO
		scenes.change(Title);
	}
}
setupSerializable(Splash);

export class Title extends Scene {
	onFocused() {
		super.onFocused();

		//TODO
		scenes.pop();
	}
}
setupSerializable(Title);