import { setTime } from "./common.js";
import { Splash } from "./scenes.js";
import { Serializer } from "./serde.js";
import { SceneStack } from "./singletons.js";

export const scenes = new SceneStack();

scenes.push(Splash);

requestAnimationFrame(function mainLoop(time) {
	setTime(time);
	scenes.update();

	console.log(JSON.stringify(Serializer.serialize(scenes)));

	if (scenes.scenes.length > 0) {
		requestAnimationFrame(mainLoop);
	} else {
		console.log("Exiting normally.");
		// Quit.
	}
});
