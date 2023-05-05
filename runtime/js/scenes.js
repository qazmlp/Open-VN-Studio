import { scenes } from "./main.js";
import { Serializable, setupSerializable } from "./serde.js";

export class Scene extends Serializable {
	start() { }
	stop() { }

	#focused = false;
	get focused() { return this.#focused; }
	set focused(v) { this.#focused = v; }

	onFocused() {
		this.#focused = true;
	}
	onFocusLost() { /* Empty. */ }

	loseFocus() {
		if (this.#focused) {
			this.#focused = false;
			this.onFocusLost();
		}
	}

	update() { }
	updateBlurring() { return true; }
	updatePopping() { return true; }
	updateBackground() { }
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