// Client-safe claim constants (no server imports): shared by the request form
// and the server-side validation.
export const MAX_NOTE_LENGTH = 500

/** A ceiling on the raw link field, not a grammar: what a value has to look
    like is the platform config's business, and this only bounds the work a
    parser can be handed. */
export const MAX_LINK_INPUT = 300
