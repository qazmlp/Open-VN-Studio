import { scenes } from "./main.js";
import { Serializable, registerClass } from "./serde.js";

export class Scene extends Serializable {
	start() { }
	stop() { }

	#focused = false;
	onFocused() {
		this.#focused = true;
	}
	onFocusLost() {

	}

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

export class Splash extends Scene {
	onFocused() {
		super.onFocused();

		//TODO
		scenes.change(Title);
	}
}
registerClass(Splash);

export class Title extends Scene {
	onFocused() {
		super.onFocused();

		//TODO
		scenes.pop();
	}
}
registerClass(Title);