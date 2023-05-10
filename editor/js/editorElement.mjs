/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright 2023 Qazm
 */

import { deepCloneNode } from "../../runtime/js/utils.mjs";

/** @returns {Promise<HTMLTemplateElement>} */
export async function loadTemplate(templatePath) {
	return (await new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('GET', templatePath);
		xhr.responseType = 'document';
		xhr.addEventListener('load', function () { resolve(this.responseXML); });
		xhr.addEventListener('error', reject);
		xhr.addEventListener('abort', reject);
		xhr.send();
	})).querySelector('template');
}

export class EditorElement extends HTMLElement {
	/** @type {ShadowRoot} */
	#shadowRoot
	get shadowRoot() { return this.#shadowRoot; }

	/** @returns {HTMLTemplateElement} */
	static template = document.createElement('template');

	constructor() {
		super();
		this.initialize();
	}

	initialize() {
		this.#shadowRoot = this.attachShadow({
			mode: 'closed',
			delegatesFocus: true,
			slotAssignment: 'manual',
		});
		// @ts-ignore
		this.#shadowRoot.appendChild(deepCloneNode(this.constructor.template).content);
	}
}
