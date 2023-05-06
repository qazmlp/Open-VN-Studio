import { EditorElement, loadTemplate } from "../js/editorElement.js";

/** @type {HTMLTemplateElement} */
const template = await loadTemplate('components/sceneEditor.htm');

export class SceneEditor extends EditorElement {
	/** @override */
	static template = template;
}
customElements.define('scene-editor', SceneEditor);
