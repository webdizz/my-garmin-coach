import { monotonicFactory } from 'ulid';

/** Monotonic ULID generator: 26 chars, sortable by creation time. */
export const newId = monotonicFactory();
