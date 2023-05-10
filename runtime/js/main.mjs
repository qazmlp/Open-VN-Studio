/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright 2023 Qazm
 */

import { setTime } from "./common.mjs";
import { SMessageTextStyle } from "./game-state.mjs";
import { Splash } from "./scenes.mjs";
import { deserialize, serialize } from "./serde.mjs";
import { SceneStack } from "./singletons.mjs";

export const scenes = new SceneStack();
export const defaultMessageTextStyle = new SMessageTextStyle(); //TODO: Load from data files.

console.log(defaultMessageTextStyle, defaultMessageTextStyle.family = 'sans-serif', defaultMessageTextStyle.dirty);

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
