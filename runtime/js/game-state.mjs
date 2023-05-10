/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright 2023 Qazm
 */

import { INIT } from "./common.mjs";
import { DMessage } from "./display.mjs";
import { InvalidOperationError } from "./errors.mjs";
import { defaultMessageTextStyle } from "./main.mjs";
import { Serializable, setupSerializable } from "./serde.mjs";
import { unreachable } from "./utils.mjs";

/**
 * @typedef {import("./data.mjs").KPose} KPose
 */

/** @type {Map<new (...args: any[]) => any, Map<string | symbol, boolean>>} */
const autosubMap = new Map();
function isPropertyAutosub(
	/** @type {StateObjectBase} */ target,
	/** @type {string | symbol} */ key,
) {
	let proto = target.constructor.prototype;
	let autosub = autosubMap.get(proto)?.get(key);
	if (autosub !== undefined) {
		return autosub;
	}
	while (proto) {
		const prop = Object.getOwnPropertyDescriptor(proto, key);
		if (prop) {
			autosub = autosubMap.get(proto)?.get(key) ?? false;
			break;
		}
		proto = Object.getPrototypeOf(proto);
	}
	autosub ??= false;
	let propMap = autosubMap.get(target.constructor.prototype);
	if (!propMap) {
		autosubMap.set(target.constructor.prototype, propMap = new Map());
	}
	propMap.set(key, autosub);
	return autosub;
}

/** @template {StateObject} T */
export function setupDirtyAutosub(
	/** @type {new () => T} */ c,
	/** @type {Exclude<keyof T, keyof StateObject>[]} */ ...includedKeys
) {
	let propMap = autosubMap.get(c.prototype);
	if (!propMap) {
		autosubMap.set(c.prototype, propMap = new Map());
	}
	for (const key in includedKeys) {
		if (propMap.has(key)) {
			throw new InvalidOperationError("Key already configured.");
		}
		propMap.set(key, true);
	}
}

/**
 * It's a bit messy, but in short this sets up proxying for
 * `StateObject`. This causes **all** the private properties
 * to end up on the proxy, which means the traps are not required
 * to filter by property key (since there are no private properties
 * on any base classes further up in the constructor chain).
 *
 * Nice and simple! ;D
 */
class StateObjectBase extends Serializable {
	/** @type {boolean} */
	get dirty() { return unreachable(); }
	set dirty(_dirty) { unreachable(); }

	constructor() {
		super();
		const proxy = new Proxy(this, {
			set(target, key, value, receiver) {
				/** @type {any} */
				let prior = undefined;
				let resub = isPropertyAutosub(target, key);
				if (resub) {
					prior = Reflect.get(target, key, receiver);
					resub = prior !== value;
				}
				if (resub) target.unsubscribeDirtyFrom(prior);
				try {
					const set = Reflect.set(target, key, value, receiver);
					if (resub) value instanceof Array ? target.subscribeDirtyTo(...value) : target.subscribeDirtyTo(value);
					return set;
				} catch (error) {
					if (resub) prior instanceof Array ? target.subscribeDirtyTo(...prior) : target.subscribeDirtyTo(prior);
					throw error;
				} finally {
					if (key !== 'dirty') proxy.dirty = true;
				}
			},
			deleteProperty(target, key) {
				try {
					if (isPropertyAutosub(target, key)) target.unsubscribeDirtyFrom(target[key]);
					return delete target[key];
				} catch (e) {
					if (key !== 'dirty') proxy.dirty = true;
					throw e;
				}
			},

			isExtensible(_target) {
				return true;
			},
			preventExtensions(_target) {
				return false;
			},
			defineProperty(target, key, attrs) {
				if (attrs.enumerable && attrs.configurable && attrs.writable
					&& !attrs.get && !attrs.set) {
					try {
						//TODO: Only allow this during deserialisation?
						Object.defineProperty(target, key, attrs);
						if (isPropertyAutosub(target, key)) target.subscribeDirtyTo(attrs.value);
						return true;
					} finally {
						if (key !== 'dirty') proxy.dirty = true;
					}
				} else {
					throw new TypeError("Properties added to individual `StateObject` instances must be simple writable, configurable, enumerable non-getter non-setter properties. Please subclass the type if you need something more complicated.");
				}
			},
			setPrototypeOf(target, _newPrototype) {
				throw new TypeError("Changing the prototype of `StateObject` instances is not allowed. Please use `Object.assign` to transfer property values instead.");
			},
		});
		return proxy;
	}

	subscribeDirtyTo(/** @type {({subscribeDirty?(subscriber: {dirty: boolean})}?)[]} */ ...sources) { for (const source of sources) source?.subscribeDirty?.(this); }
	unsubscribeDirtyFrom(/** @type {({unsubscribeDirty?(subscriber: {dirty: boolean})}?)[]} */ ...sources) { for (const source of sources) source?.unsubscribeDirty?.(this); }
}

/**
 * `StateObject`s represent *persistent*, durable state. Generally, this means they are 'stops' in the script that transients
 * will trend towards while animating that step. Music and background noise should be represented here, but short sounds effects
 * shouldn't appear in the serialised state.
 * 
 * When deriving from this class, please prefix the class name with `S` for 'State'.
 * Call `setupSerializable` with the constructor and any properties that need to be preserved.
 *
 * Enumerable properties on `StateObject` instances must be serialisable using the `serde.js` module.
 * 
 */
export class StateObject extends StateObjectBase {
	#dirty = false;
	/**
	 * This is an auto-propagating "dirty" flag:
	 * Dirtying propagates to subscribers, while cleaning propagates to
	 * values of enumerable properties that are also `StateObject`s.
	 * 
	 * Let me know if that turns out too limiting. - Qazm
	 */
	get dirty() { return this.#dirty; }
	set dirty(dirty) {
		if (dirty !== this.#dirty) {
			this.#dirty = dirty;
			if (dirty) for (const o of this.#subscribers.keys()) {
				o.dirty = true;
			} else {
				this.propagateClean();
			}
		}
	}

	propagateClean() {
		for (const key in this) {
			const value = this[key];
			if (value instanceof StateObject) {
				value.dirty = false;
			} else if (value instanceof Array) {
				for (const item of value)
					if (item instanceof StateObject) {
						item.dirty = false;
					}
			}
		}
		//TODO: Handle Maps.
	}

	/** @type {Map<{dirty: boolean}, number>} */
	#subscribers = new Map();

	/** Each unique subscriber is notified only once on dirty. */
	subscribeDirty(
		/** @type {{dirty: boolean}} */ subscriber,
	) {
		this.#subscribers.set(subscriber, this.#subscribers.get(subscriber) ?? 0);
	}
	unsubscribeDirty(
		/** @type {{dirty: boolean}} */ subscriber,
	) {
		const count = this.#subscribers.get(subscriber);
		if (count === undefined) {
			throw new InvalidOperationError("Tried to `unsubscribeDirty` without first subscribing that often with the given subscriber.");
		}
		const newCount = count - 1;
		if (newCount) {
			this.#subscribers.set(subscriber, newCount);
		} else {
			this.#subscribers.delete(subscriber);
		}
	}

	constructor() {
		super();
		StateObject.prototype[INIT].apply(this);
	}

	/** @overload */
	[INIT]() { /* Empty. */ }
}
setupSerializable(StateObject);

/**
 * Messages that are effectively empty should be skipped unless they contain an explicit stop.
 */
export class SMessage extends StateObject {
	/** @type {SActor?} */
	#speaker = null;
	get speaker() { return this.#speaker; }
	set speaker(speaker) { this.#speaker = speaker; }

	/** @type {number} */
	#loudness = 1;
	/**
	 * How this is displayed/whether it makes a difference depends on the renderer,
	 * but here are a few example values to get started:
	 * 
	 * 3: SCREAMING
	 * 2: Shouting!
	 * 1: Speaking normally. / Narration.
	 * 0.5: Whispering or mumbling... / Sneaky narration.
	 * 0: (Thinking.)
	 * -Infinity:                                                Ḩ̯̭̲̩̝̅̃̊̈́̉̃̄̎͘é̴͉͎̮̝̺͐̓̎͒̾͘ c̡̠̳̝͎̹̝͖̤͕̋̒̒͊̄̑̉̇̚o̶̡͚͎̲̺̰̭̹̟̪̐͒͋͋̀̽͐̅͊͘m̵̢̡̢̨̛̛̙͙̦̣̀̃͛̓̓̏̿͝ͅe̵̡̛̦̯̻͖̥̓͛̍̾̎͞͠s̡̤̭̲̖̻̤̀̽̏͂̅̈́̉
	 */
	get loudness() { return this.#loudness; }
	set loudness(loudness) { this.#loudness = loudness; }

	/** @type {SMessageElement[]} */
	#content = [];
	get content() { return this.#content; }
	set content(content) { this.#content = content; }

	/**
	 * Prepares the message for display.
	 *
	 * This is generally called once when the message becomes 'current' or should be shown in the message log.
	 * The resulting object holds relevant Pixi.js renderables and interactive elements.
	 * 
	 * The message is split into lines and contains grapheme info to make dynamic clipping easy and reliable.
	 * 
	 * This should *not* be called just to change the current message clipping while animating it.
	 * Instead, clipping is configured on `DMessage` by the transient `TMessage`.
	 *
	 * @returns {DMessage}
	 */
	toDisplay(
		/**
		 * The width of the available flow text area.
		 * @type {number},
		 */
		width,
		/**
		 * The width of the first line, if different.
		 * @type {number},
		 */
		firstWidth = width,
		/**
		 * Text size scaling factor.
		 * This is useful to render e.g. the message log a bit differently.
		 * @type {number},
		 */
		scale = 1,
	) {
		TODO;
	}
}
setupSerializable(SMessage, 'speaker', 'loudness', 'content');
setupDirtyAutosub(SMessage, 'speaker', 'content');

/**
 * Base class for (generally) flow-layouted message elements.
 * The hierarchy here should be pretty flat, as this is an evaluated form.
 */
export class SMessageElement extends StateObject {
	//TODO: These will be formatting spans of sorts.
}
setupSerializable(SMessageElement);

/**
 * Plain message text with font styling applied, possibly with line breaks.
 *
 * Whitespace should not be collapsed when rendering it,
 * and leading and trailing whitespace should be preserved.
 */
export class SMessageText extends SMessageElement {
	constructor(
		/** @type {string} */ text = "",
		/** @type {SMessageTextStyle} */ style = defaultMessageTextStyle,
	) {
		super();
		SMessageText.prototype[INIT].call(this, text, style);
	}

	/** @type {string} */
	#text;
	get text() { return this.#text; }
	set text(text) { this.#text = text; }

	/** @type {SMessageTextStyle} */
	#style;
	/**
	 * This is *not* dirty-subscribed to avoid leaks!
	 * TODO: Subscribe, but only while this is subscribed to.
	 */
	get style() { return this.#style; }
	set style(style) { this.#style = style; }

	/** @overload */
	[INIT](/* arguments */) {
		[this.#text, this.#style] = arguments;
	}
}
setupSerializable(SMessageText, 'text', 'style');

/**
 * Text that is normally hidden to sighted readers,
 * but can (optionally!) be read aloud by screen reader tools.
 *
 * Think of this as the parts of a novel that are visual in a VN.
 * Can also be useful to hash out what a character's sprite should do before it's implemented.
 *
 * In the editor, this is bracketed with [].
 * 
 * TODO: Is that the right name for this?
 */
export class SStageDirection extends SMessageElement {
	constructor(
		/** @type {string} */ text = "",
	) {
		super();
		SStageDirection.prototype[INIT].call(this, text);
	}

	/** @type {string} */
	#text;
	get text() { return this.#text; }
	set text(text) { this.#text = text; }

	/** @overload */
	[INIT](/* arguments */) {
		[this.#text] = arguments;
	}
}

/**
 * Pulled out of `SMessageText` so that it doesn't blow up save data size.
 * Treat this as immutable once used, but avoid creating new instances of
 * this class whenever possible.
 * 
 * TODO: Use a global message text style registry and _save it as part of
 * the game save_. Update it on load with named styles from the data files.
 * 
 * TODO: Align this with Pixi.js text styles.
 */
export class SMessageTextStyle extends StateObject {

	/** @type {CSSStyleDeclaration['fontStyle']} */
	#style;
	get style() { return this.#style; }
	set style(style) { this.#style = style; }

	/** @type {CSSStyleDeclaration['fontVariant']} */
	#variant;
	get variant() { return this.#variant; }
	set variant(variant) { this.#variant = variant; }

	/** @type {CSSStyleDeclaration['fontWeight']} */
	#weight;
	get weight() { return this.#weight; }
	set weight(weight) { this.#weight = weight; }

	/** @type {CSSStyleDeclaration['fontStretch']} */
	#stretch;
	get stretch() { return this.#stretch; }
	set stretch(stretch) { this.#stretch = stretch; }

	/** @type {CSSStyleDeclaration['fontSize']} */
	#size;
	get size() { return this.#size; }
	set size(size) { this.#size = size; }

	/** @type {CSSStyleDeclaration['lineHeight']} */
	#lineHeight;
	get lineHeight() { return this.#lineHeight; }
	set lineHeight(lineHeight) { this.#lineHeight = lineHeight; }

	/** @type {CSSStyleDeclaration['fontFamily']} */
	#family;
	get family() { return this.#family; }
	set family(family) { this.#family = family; }

	constructor(
		/** @type {CSSStyleDeclaration['fontStyle']} */ style = 'normal',
		/** @type {CSSStyleDeclaration['fontVariant']} */ variant = 'normal',
		/** @type {CSSStyleDeclaration['fontWeight']} */ weight = 'normal',
		/** @type {CSSStyleDeclaration['fontStretch']} */ stretch = 'normal',
		/** @type {CSSStyleDeclaration['fontSize']} */ size = 'medium',
		/** @type {CSSStyleDeclaration['lineHeight']} */ lineHeight = 'normal',
		/** @type {CSSStyleDeclaration['fontFamily']} */ family = 'serif',
	) {
		super();
		SMessageTextStyle.prototype[INIT].call(this, style, variant, weight, stretch, size, lineHeight, family);
	}

	/** @overload */
	[INIT](/* arguments */) {
		[this.#style,
		this.#variant,
		this.#weight,
		this.#stretch,
		this.#size,
		this.#lineHeight,
		this.#family] = arguments;
	}

	get fontString() {
		return `${this.#style} ${this.#variant} ${this.#weight} ${this.#stretch} ${this.#size}/${this.#lineHeight} ${this.#family}`;
	}
}
setupSerializable(SMessageTextStyle, 'style', 'variant', 'weight', 'stretch', 'size', 'lineHeight', 'family');

export class SActor extends StateObject {
	/** @type {KPose} */
	#pose;
	get pose() { return this.#pose; }
	set pose(pose) { this.#pose = pose; }
}
setupSerializable(SActor, 'pose');
