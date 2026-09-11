// tests/llm/fixtures.ts — what `@anthropic-ai/sdk`'s `messages.create`
// resolves to, for the suites that stand the vendor SDK in (issue #512).
//
// `llm()` reads an answer two ways: the forced tool's `tool_use` block —
// the path every object-shaped call site takes — and, where a response
// carries text instead, the text. A suite that mocks the SDK builds either
// shape here, so both paths stay exercised.

/** A response whose one content block is text: `value` serialised as JSON,
 *  or `text` verbatim with `rawTextMessage`. */
export function textMessage(value: unknown, tokensIn = 100, tokensOut = 50) {
  return rawTextMessage(JSON.stringify(value), tokensIn, tokensOut);
}

export function rawTextMessage(text: string, tokensIn = 100, tokensOut = 50) {
  return {
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    usage: { input_tokens: tokensIn, output_tokens: tokensOut },
  };
}

/** A response in which the model called the forced tool: `input` is the
 *  answer, already a value, exactly as the vendor returns it. `name` is the
 *  tool's name — the call site, with any character a tool name may not
 *  carry written as `_`. */
export function toolUseMessage(input: unknown, tokensIn = 100, tokensOut = 50, name = "answer") {
  return {
    content: [{ type: "tool_use", id: "toolu_fixture", name, input }],
    stop_reason: "tool_use",
    usage: { input_tokens: tokensIn, output_tokens: tokensOut },
  };
}
