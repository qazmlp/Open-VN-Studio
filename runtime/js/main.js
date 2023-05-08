/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright 2023 Qazm
 */

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
