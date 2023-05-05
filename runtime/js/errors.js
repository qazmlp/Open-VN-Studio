export class InvalidOperationError extends Error { }
export class UnreachableError extends Error {
	constructor() {
		super("This shouldn't happen.");
	}
}