# Streaming Function Calling with OpenAI Responses API

This document explains how to implement streaming function calling with OpenAI's Responses API and reasoning models.

## Key Concepts

### API Differences
- **Responses API** is different from Chat Completions API
- Uses Server-Sent Events (SSE) for streaming
- Reasoning models (GPT-5) require special handling of reasoning items
- Function calls are streamed as delta events, then assembled

### Critical Event Types
```typescript
// Function metadata arrives first
"response.output_item.added" // Contains function name, call_id, initial structure

// Arguments stream in chunks
"response.function_call_arguments.delta" // Each chunk of function arguments

// Arguments complete
"response.function_call_arguments.done" // Function arguments fully received

// Stream completes
"response.completed" // Process function calls or final response
```

## Implementation Pattern

### 1. Accumulate ALL Output Items
**CRITICAL**: Store ALL output items by index, not just function calls. Reasoning models require reasoning items to be included when submitting function outputs.

```typescript
const finalToolCalls: Record<number, any> = {};

// Store EVERY output item (reasoning, web_search, function_call, etc.)
if (event.type === "response.output_item.added") {
  finalToolCalls[event.output_index] = event.item;
}

// Accumulate function arguments as they stream
if (event.type === "response.function_call_arguments.delta") {
  const index = event.output_index;
  if (finalToolCalls[index]) {
    finalToolCalls[index].arguments += event.delta;
  }
}
```

### 2. Execute Functions on Completion
Filter for function_call items to execute, but keep ALL items for the next request.

```typescript
if (event.type === "response.completed") {
  // Filter ONLY function_call items for execution
  const functionCallItems = Object.values(finalToolCalls).filter(
    (item) => item && typeof item === "object" && item.type === "function_call"
  );

  if (functionCallItems.length > 0) {
    const newConversationInput = [...conversationInput];

    // Add ALL output items (reasoning + function_call + web_search + etc.)
    // This is REQUIRED for reasoning models
    for (const item of Object.values(finalToolCalls)) {
      newConversationInput.push(item);
    }

    // Execute functions and add outputs
    for (const toolCall of functionCallItems) {
      if (toolCall.name === "your_function_name") {
        const parsedArgs = JSON.parse(toolCall.arguments);
        const result = await yourFunction(parsedArgs);

        newConversationInput.push({
          type: "function_call_output",
          call_id: toolCall.call_id,
          output: JSON.stringify(result),
        });
      }
    }

    // Make recursive call with accumulated conversation history
    await processStream(
      openai.responses.create({
        prompt: { id: PROMPT_ID, variables: promptVariables },
        input: newConversationInput,
        reasoning: { effort: "medium", summary: "auto" },
        stream: true,
      }),
      newConversationInput
    );
    return;
  }

  // Final response with content - no more function calls
  if (fullContent) {
    const parsed = JSON.parse(fullContent);
    // Send to client and close stream
  }
}
```

## Common Pitfalls

### ❌ Wrong: Only adding function_call items
```typescript
// This will fail with "Item of type 'function_call' was provided without its required 'reasoning' item"
for (const toolCall of functionCallItems) {
  newConversationInput.push(toolCall); // Missing reasoning items!
}
```

### ✅ Correct: Adding ALL output items
```typescript
// Add ALL items (reasoning, web_search, function_call, etc.)
for (const item of Object.values(finalToolCalls)) {
  newConversationInput.push(item);
}
```

### ❌ Wrong: Treating all items as functions
```typescript
// This executes reasoning items and web searches as functions!
for (const item of Object.values(finalToolCalls)) {
  if (item.name === "my_function") { // reasoning items don't have .name
    await executeFunction(item);
  }
}
```

### ✅ Correct: Filter before executing
```typescript
const functionCallItems = Object.values(finalToolCalls).filter(
  (item) => item && typeof item === "object" && item.type === "function_call"
);

for (const toolCall of functionCallItems) {
  await executeFunction(toolCall);
}
```

## Function Definition Example

```typescript
const tools = [
  {
    type: "function",
    function: {
      name: "fetch_event_images",
      description: "Fetches Open Graph images from an event website URL",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            format: "uri",
            description: "The event website URL to fetch images from"
          }
        },
        required: ["url"],
        additionalProperties: false
      }
    }
  }
];

// Pass to OpenAI
openai.responses.create({
  prompt: { id: PROMPT_ID, variables: promptVariables },
  tools: tools,
  reasoning: { effort: "medium", summary: "auto" },
  stream: true
})
```

## Recursive Stream Processing

Function calling requires recursive stream processing:

```typescript
async function processStream(
  streamPromise: Promise<AsyncIterable<any>>,
  conversationInput: Array<any> = []
) {
  const stream = await streamPromise;
  let fullContent = "";
  const finalToolCalls: Record<number, any> = {};

  for await (const event of stream) {
    // Handle all events...

    if (event.type === "response.completed") {
      const functionCallItems = Object.values(finalToolCalls).filter(
        (item) => item?.type === "function_call"
      );

      if (functionCallItems.length > 0) {
        // Build new input with ALL items + outputs
        // Recursively call processStream
        await processStream(newStreamPromise, newConversationInput);
        return; // Exit this call after recursion starts
      }

      // No more functions - send final response
      if (fullContent) {
        sendToClient(fullContent);
        controller.close();
        return;
      }
    }
  }
}
```

## Data Structure Consistency

When sending responses to the client, extract only the needed data to maintain consistency:

```typescript
// Server: Extract array from GPT response before sending
const parsedResponse = JSON.parse(fullContent); // { bundles: [...] }
const bundlesArray = parsedResponse.bundles || [];

const message = `event: completed\ndata: ${JSON.stringify({ bundles: bundlesArray })}\n\n`;
controller.enqueue(encoder.encode(message));

// Client: Receives { bundles: [...] } consistently
if (eventType === "completed") {
  setBundles(data.bundles); // Always an array
}
```

## Key Takeaways

1. **Store ALL output items** by index, not just function_call items
2. **Filter by type** when executing functions, but **include ALL items** when building the next request
3. **Reasoning models require reasoning items** to accompany function calls
4. **Recursive processing** is needed for multi-turn function calling
5. **Close the stream** only when sending the final response (no more function calls)
6. **Maintain data structure consistency** between server responses and client expectations
