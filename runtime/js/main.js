import { setTime } from "./common.js";
import { Splash } from "./scenes.js";
import { deserialize, serialize } from "./serde.js";
import { SceneStack } from "./singletons.js";

export const scenes = new SceneStack();

scenes.push(Splash);

requestAnimationFrame(function mainLoop(time) {
	setTime(time);
	scenes.update();

	const serialized = JSON.stringify(serialize(scenes), undefined, 2);
	console.log(serialized);
	console.log(deserialize(JSON.parse(serialized)));

	if (scenes.scenes.length > 0) {
		requestAnimationFrame(mainLoop);
	} else {
		console.log("Exiting normally.");
		// Quit.
	}
});
