/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright 2023 Qazm
 */

import { EditorElement, loadTemplate } from "../js/editorElement.mjs";

/** @type {HTMLTemplateElement} */
const template = await loadTemplate('components/sceneEditor.htm');

export class SceneEditor extends EditorElement {
	/** @override */
	static template = template;
}
customElements.define('scene-editor', SceneEditor);
