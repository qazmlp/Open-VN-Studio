import { deepCloneNode } from "../../runtime/js/utils.js";

/** @returns {Promise<HTMLTemplateElement>} */
export async function loadTemplate(templatePath) {
	return (await new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('GET', templatePath);
		xhr.responseType = 'document';
		let done = false;
		xhr.onreadystatechange = () => {
			if (xhr.readyState === 4 && !done) {
				done = true;
				resolve(xhr.responseXML);
			}
		};
		xhr.onerror = reject;
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
