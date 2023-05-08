/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright 2023 Qazm
 */

import { InvalidOperationError } from "./errors.js";
import { Serializable, setupSerializable } from "./serde.js";

export class StateObject extends Serializable {
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
			} else for (const key in this) {
				const value = this[key];
				if (value instanceof StateObject) {
					value.dirty = false;
				} else if (value instanceof Array) {
					for (const item of value) if (item instanceof StateObject) {
						item.dirty = false;
					}
				} //TODO: Auto-clean through `SerializableValue`s.
			}
		}
	}

	/** @type {Map<{dirty: boolean}, number>} */
	#subscribers = new Map();

	/** Each unique subscriber is notified only once on dirty. */
	subscribeDirty(
		/** @type {{dirty: boolean}?} */ subscriber,
	) {
		if (!subscriber) return;

		this.#subscribers.set(subscriber, this.#subscribers.get(subscriber) ?? 0);
	}
	unsubscribeDirty(
		/** @type {{dirty: boolean}?} */ subscriber,
	) {
		if (!subscriber) return;

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

	constructor(
		/** @type {any[]} */ ...args
	) {
		super(...args);

		return new Proxy(this, {
			get(target, key, _receiver) {
				// This is needed to access private target properties,
				// as by default `_receiver` would be `this` in the getter.

				//TODO: Instrument arrays to be read-only!
				return target[key];
			},
			set(target, key, newValue, _receiver) {
				try {
					target[key] = newValue;
					return true;
				} finally {
					target.dirty = true;
				}
			},
			getOwnPropertyDescriptor(target, key) {
				return Object.getOwnPropertyDescriptor(target, key);
			},
			getPrototypeOf(target) {
				return Object.getPrototypeOf(target);
			},
			has(target, key) {
				return key in target;
			},
			ownKeys(target) {
				return Reflect.ownKeys(target);
			},
			deleteProperty(target, key) {
				try {
					return delete target[key] && (target.dirty = true);
				} catch (e) {
					target.dirty = true;
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

						Object.defineProperty(target, key, attrs);
						return true;
					} finally {
						target.dirty = true;
					}
				} else {
					throw new TypeError("Properties added to individual `StateObject` instances must be simple writable, configurable, enumerable non-getter non-setter properties. Please subclass the type if you need something more complicated.");
				}
			},
			setPrototypeOf(target, _newPrototype) {
				throw new TypeError("Changing the prototype of `StateObject` instances is not allowed. Please use `Object.assign` to transfer property values instead.");
			},
		});
	}
}
setupSerializable(StateObject);
