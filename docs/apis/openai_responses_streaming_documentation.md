## **response.created**

An event that is emitted when a response is created.

response

object

The response that was created.

Show properties

sequence\_number

integer

The sequence number for this event.

type

string

The type of the event. Always response.created.

OBJECT response.created

{  
  "type": "response.created",  
  "response": {  
    "id": "resp\_67ccfcdd16748190a91872c75d38539e09e4d4aac714747c",  
    "object": "response",  
    "created\_at": 1741487325,  
    "status": "in\_progress",  
    "error": null,  
    "incomplete\_details": null,  
    "instructions": null,  
    "max\_output\_tokens": null,  
    "model": "gpt-4o-2024-08-06",  
    "output": \[\],  
    "parallel\_tool\_calls": true,  
    "previous\_response\_id": null,  
    "reasoning": {  
      "effort": null,  
      "summary": null  
    },  
    "store": true,  
    "temperature": 1,  
    "text": {  
      "format": {  
        "type": "text"  
      }  
    },  
    "tool\_choice": "auto",  
    "tools": \[\],  
    "top\_p": 1,  
    "truncation": "disabled",  
    "usage": null,  
    "user": null,  
    "metadata": {}  
  },  
  "sequence\_number": 1

}

## **response.in\_progress**

Emitted when the response is in progress.

response

object

The response that is in progress.

Show properties

sequence\_number

integer

The sequence number of this event.

type

string

The type of the event. Always response.in\_progress.

OBJECT response.in\_progress

{  
  "type": "response.in\_progress",  
  "response": {  
    "id": "resp\_67ccfcdd16748190a91872c75d38539e09e4d4aac714747c",  
    "object": "response",  
    "created\_at": 1741487325,  
    "status": "in\_progress",  
    "error": null,  
    "incomplete\_details": null,  
    "instructions": null,  
    "max\_output\_tokens": null,  
    "model": "gpt-4o-2024-08-06",  
    "output": \[\],  
    "parallel\_tool\_calls": true,  
    "previous\_response\_id": null,  
    "reasoning": {  
      "effort": null,  
      "summary": null  
    },  
    "store": true,  
    "temperature": 1,  
    "text": {  
      "format": {  
        "type": "text"  
      }  
    },  
    "tool\_choice": "auto",  
    "tools": \[\],  
    "top\_p": 1,  
    "truncation": "disabled",  
    "usage": null,  
    "user": null,  
    "metadata": {}  
  },  
  "sequence\_number": 1

}

## **response.completed**

Emitted when the model response is complete.

response

object

Properties of the completed response.

Show properties

sequence\_number

integer

The sequence number for this event.

type

string

The type of the event. Always response.completed.

OBJECT response.completed

{  
  "type": "response.completed",  
  "response": {  
    "id": "resp\_123",  
    "object": "response",  
    "created\_at": 1740855869,  
    "status": "completed",  
    "error": null,  
    "incomplete\_details": null,  
    "input": \[\],  
    "instructions": null,  
    "max\_output\_tokens": null,  
    "model": "gpt-4o-mini-2024-07-18",  
    "output": \[  
      {  
        "id": "msg\_123",  
        "type": "message",  
        "role": "assistant",  
        "content": \[  
          {  
            "type": "output\_text",  
            "text": "In a shimmering forest under a sky full of stars, a lonely unicorn named Lila discovered a hidden pond that glowed with moonlight. Every night, she would leave sparkling, magical flowers by the water's edge, hoping to share her beauty with others. One enchanting evening, she woke to find a group of friendly animals gathered around, eager to be friends and share in her magic.",  
            "annotations": \[\]  
          }  
        \]  
      }  
    \],  
    "previous\_response\_id": null,  
    "reasoning\_effort": null,  
    "store": false,  
    "temperature": 1,  
    "text": {  
      "format": {  
        "type": "text"  
      }  
    },  
    "tool\_choice": "auto",  
    "tools": \[\],  
    "top\_p": 1,  
    "truncation": "disabled",  
    "usage": {  
      "input\_tokens": 0,  
      "output\_tokens": 0,  
      "output\_tokens\_details": {  
        "reasoning\_tokens": 0  
      },  
      "total\_tokens": 0  
    },  
    "user": null,  
    "metadata": {}  
  },  
  "sequence\_number": 1

}

## **response.failed**

An event that is emitted when a response fails.

response

object

The response that failed.

Show properties

sequence\_number

integer

The sequence number of this event.

type

string

The type of the event. Always response.failed.

OBJECT response.failed

{  
  "type": "response.failed",  
  "response": {  
    "id": "resp\_123",  
    "object": "response",  
    "created\_at": 1740855869,  
    "status": "failed",  
    "error": {  
      "code": "server\_error",  
      "message": "The model failed to generate a response."  
    },  
    "incomplete\_details": null,  
    "instructions": null,  
    "max\_output\_tokens": null,  
    "model": "gpt-4o-mini-2024-07-18",  
    "output": \[\],  
    "previous\_response\_id": null,  
    "reasoning\_effort": null,  
    "store": false,  
    "temperature": 1,  
    "text": {  
      "format": {  
        "type": "text"  
      }  
    },  
    "tool\_choice": "auto",  
    "tools": \[\],  
    "top\_p": 1,  
    "truncation": "disabled",  
    "usage": null,  
    "user": null,  
    "metadata": {}  
  }

}

## **response.incomplete**

An event that is emitted when a response finishes as incomplete.

response

object

The response that was incomplete.

Show properties

sequence\_number

integer

The sequence number of this event.

type

string

The type of the event. Always response.incomplete.

OBJECT response.incomplete

{  
  "type": "response.incomplete",  
  "response": {  
    "id": "resp\_123",  
    "object": "response",  
    "created\_at": 1740855869,  
    "status": "incomplete",  
    "error": null,   
    "incomplete\_details": {  
      "reason": "max\_tokens"  
    },  
    "instructions": null,  
    "max\_output\_tokens": null,  
    "model": "gpt-4o-mini-2024-07-18",  
    "output": \[\],  
    "previous\_response\_id": null,  
    "reasoning\_effort": null,  
    "store": false,  
    "temperature": 1,  
    "text": {  
      "format": {  
        "type": "text"  
      }  
    },  
    "tool\_choice": "auto",  
    "tools": \[\],  
    "top\_p": 1,  
    "truncation": "disabled",  
    "usage": null,  
    "user": null,  
    "metadata": {}  
  },  
  "sequence\_number": 1

}

## **response.output\_item.added**

Emitted when a new output item is added.

item

object

The output item that was added.

Show possible types

output\_index

integer

The index of the output item that was added.

sequence\_number

integer

The sequence number of this event.

type

string

The type of the event. Always response.output\_item.added.

OBJECT response.output\_item.added

{  
  "type": "response.output\_item.added",  
  "output\_index": 0,  
  "item": {  
    "id": "msg\_123",  
    "status": "in\_progress",  
    "type": "message",  
    "role": "assistant",  
    "content": \[\]  
  },  
  "sequence\_number": 1

}

## **response.output\_item.done**

Emitted when an output item is marked done.

item

object

The output item that was marked done.

Show possible types

output\_index

integer

The index of the output item that was marked done.

sequence\_number

integer

The sequence number of this event.

type

string

The type of the event. Always response.output\_item.done.

OBJECT response.output\_item.done

{  
  "type": "response.output\_item.done",  
  "output\_index": 0,  
  "item": {  
    "id": "msg\_123",  
    "status": "completed",  
    "type": "message",  
    "role": "assistant",  
    "content": \[  
      {  
        "type": "output\_text",  
        "text": "In a shimmering forest under a sky full of stars, a lonely unicorn named Lila discovered a hidden pond that glowed with moonlight. Every night, she would leave sparkling, magical flowers by the water's edge, hoping to share her beauty with others. One enchanting evening, she woke to find a group of friendly animals gathered around, eager to be friends and share in her magic.",  
        "annotations": \[\]  
      }  
    \]  
  },  
  "sequence\_number": 1

}

## **response.content\_part.added**

Emitted when a new content part is added.

content\_index

integer

The index of the content part that was added.

item\_id

string

The ID of the output item that the content part was added to.

output\_index

integer

The index of the output item that the content part was added to.

part

object

The content part that was added.

Show possible types

sequence\_number

integer

The sequence number of this event.

type

string

The type of the event. Always response.content\_part.added.

OBJECT response.content\_part.added

{  
  "type": "response.content\_part.added",  
  "item\_id": "msg\_123",  
  "output\_index": 0,  
  "content\_index": 0,  
  "part": {  
    "type": "output\_text",  
    "text": "",  
    "annotations": \[\]  
  },  
  "sequence\_number": 1

}

## **response.content\_part.done**

Emitted when a content part is done.

content\_index

integer

The index of the content part that is done.

item\_id

string

The ID of the output item that the content part was added to.

output\_index

integer

The index of the output item that the content part was added to.

part

object

The content part that is done.

Show possible types

sequence\_number

integer

The sequence number of this event.

type

string

The type of the event. Always response.content\_part.done.

OBJECT response.content\_part.done

{  
  "type": "response.content\_part.done",  
  "item\_id": "msg\_123",  
  "output\_index": 0,  
  "content\_index": 0,  
  "sequence\_number": 1,  
  "part": {  
    "type": "output\_text",  
    "text": "In a shimmering forest under a sky full of stars, a lonely unicorn named Lila discovered a hidden pond that glowed with moonlight. Every night, she would leave sparkling, magical flowers by the water's edge, hoping to share her beauty with others. One enchanting evening, she woke to find a group of friendly animals gathered around, eager to be friends and share in her magic.",  
    "annotations": \[\]  
  }

}

## **response.output\_text.delta**

Emitted when there is an additional text delta.

content\_index

integer

The index of the content part that the text delta was added to.

delta

string

The text delta that was added.

item\_id

string

The ID of the output item that the text delta was added to.

logprobs

array

The log probabilities of the tokens in the delta.

Show properties

output\_index

integer

The index of the output item that the text delta was added to.

sequence\_number

integer

The sequence number for this event.

type

string

The type of the event. Always response.output\_text.delta.

OBJECT response.output\_text.delta

{  
  "type": "response.output\_text.delta",  
  "item\_id": "msg\_123",  
  "output\_index": 0,  
  "content\_index": 0,  
  "delta": "In",  
  "sequence\_number": 1

}

## **response.output\_text.done**

Emitted when text content is finalized.

content\_index

integer

The index of the content part that the text content is finalized.

item\_id

string

The ID of the output item that the text content is finalized.

logprobs

array

The log probabilities of the tokens in the delta.

Show properties

output\_index

integer

The index of the output item that the text content is finalized.

sequence\_number

integer

The sequence number for this event.

text

string

The text content that is finalized.

type

string

The type of the event. Always response.output\_text.done.

OBJECT response.output\_text.done

{  
  "type": "response.output\_text.done",  
  "item\_id": "msg\_123",  
  "output\_index": 0,  
  "content\_index": 0,  
  "text": "In a shimmering forest under a sky full of stars, a lonely unicorn named Lila discovered a hidden pond that glowed with moonlight. Every night, she would leave sparkling, magical flowers by the water's edge, hoping to share her beauty with others. One enchanting evening, she woke to find a group of friendly animals gathered around, eager to be friends and share in her magic.",  
  "sequence\_number": 1

}

## **response.refusal.delta**

Emitted when there is a partial refusal text.

content\_index

integer

The index of the content part that the refusal text is added to.

delta

string

The refusal text that is added.

item\_id

string

The ID of the output item that the refusal text is added to.

output\_index

integer

The index of the output item that the refusal text is added to.

sequence\_number

integer

The sequence number of this event.

type

string

The type of the event. Always response.refusal.delta.

OBJECT response.refusal.delta

{  
  "type": "response.refusal.delta",  
  "item\_id": "msg\_123",  
  "output\_index": 0,  
  "content\_index": 0,  
  "delta": "refusal text so far",  
  "sequence\_number": 1

}

## **response.refusal.done**

Emitted when refusal text is finalized.

content\_index

integer

The index of the content part that the refusal text is finalized.

item\_id

string

The ID of the output item that the refusal text is finalized.

output\_index

integer

The index of the output item that the refusal text is finalized.

refusal

string

The refusal text that is finalized.

sequence\_number

integer

The sequence number of this event.

type

string

The type of the event. Always response.refusal.done.

OBJECT response.refusal.done

{  
  "type": "response.refusal.done",  
  "item\_id": "item-abc",  
  "output\_index": 1,  
  "content\_index": 2,  
  "refusal": "final refusal text",  
  "sequence\_number": 1

}

## **response.function\_call\_arguments.delta**

Emitted when there is a partial function-call arguments delta.

delta

string

The function-call arguments delta that is added.

item\_id

string

The ID of the output item that the function-call arguments delta is added to.

output\_index

integer

The index of the output item that the function-call arguments delta is added to.

sequence\_number

integer

The sequence number of this event.

type

string

The type of the event. Always response.function\_call\_arguments.delta.

OBJECT response.function\_call\_arguments.delta

{  
  "type": "response.function\_call\_arguments.delta",  
  "item\_id": "item-abc",  
  "output\_index": 0,  
  "delta": "{ \\"arg\\":"  
  "sequence\_number": 1

}

## **response.function\_call\_arguments.done**

Emitted when function-call arguments are finalized.

arguments

string

The function-call arguments.

item\_id

string

The ID of the item.

name

string

The name of the function that was called.

output\_index

integer

The index of the output item.

sequence\_number

integer

The sequence number of this event.

type

string

OBJECT response.function\_call\_arguments.done

{  
  "type": "response.function\_call\_arguments.done",  
  "item\_id": "item-abc",  
  "name": "get\_weather",  
  "output\_index": 1,  
  "arguments": "{ \\"arg\\": 123 }",  
  "sequence\_number": 1

}

## **response.file\_search\_call.in\_progress**

Emitted when a file search call is initiated.

item\_id

string

The ID of the output item that the file search call is initiated.

output\_index

integer

The index of the output item that the file search call is initiated.

sequence\_number

integer

The sequence number of this event.

type

string

The type of the event. Always response.file\_search\_call.in\_progress.

OBJECT response.file\_search\_call.in\_progress

{  
  "type": "response.file\_search\_call.in\_progress",  
  "output\_index": 0,  
  "item\_id": "fs\_123",  
  "sequence\_number": 1

}

## **response.file\_search\_call.searching**

Emitted when a file search is currently searching.

item\_id

string

The ID of the output item that the file search call is initiated.

output\_index

integer

The index of the output item that the file search call is searching.

sequence\_number

integer

The sequence number of this event.

type

string

The type of the event. Always response.file\_search\_call.searching.

OBJECT response.file\_search\_call.searching

{  
  "type": "response.file\_search\_call.searching",  
  "output\_index": 0,  
  "item\_id": "fs\_123",  
  "sequence\_number": 1

}

## **response.file\_search\_call.completed**

Emitted when a file search call is completed (results found).

item\_id

string

The ID of the output item that the file search call is initiated.

output\_index

integer

The index of the output item that the file search call is initiated.

sequence\_number

integer

The sequence number of this event.

type

string

The type of the event. Always response.file\_search\_call.completed.

OBJECT response.file\_search\_call.completed

{  
  "type": "response.file\_search\_call.completed",  
  "output\_index": 0,  
  "item\_id": "fs\_123",  
  "sequence\_number": 1

}

## **response.web\_search\_call.in\_progress**

Emitted when a web search call is initiated.

item\_id

string

Unique ID for the output item associated with the web search call.

output\_index

integer

The index of the output item that the web search call is associated with.

sequence\_number

integer

The sequence number of the web search call being processed.

type

string

The type of the event. Always response.web\_search\_call.in\_progress.

OBJECT response.web\_search\_call.in\_progress

{  
  "type": "response.web\_search\_call.in\_progress",  
  "output\_index": 0,  
  "item\_id": "ws\_123",  
  "sequence\_number": 0

}

## **response.web\_search\_call.searching**

Emitted when a web search call is executing.

item\_id

string

Unique ID for the output item associated with the web search call.

output\_index

integer

The index of the output item that the web search call is associated with.

sequence\_number

integer

The sequence number of the web search call being processed.

type

string

The type of the event. Always response.web\_search\_call.searching.

OBJECT response.web\_search\_call.searching

{  
  "type": "response.web\_search\_call.searching",  
  "output\_index": 0,  
  "item\_id": "ws\_123",  
  "sequence\_number": 0

}

## **response.web\_search\_call.completed**

Emitted when a web search call is completed.

item\_id

string

Unique ID for the output item associated with the web search call.

output\_index

integer

The index of the output item that the web search call is associated with.

sequence\_number

integer

The sequence number of the web search call being processed.

type

string

The type of the event. Always response.web\_search\_call.completed.

OBJECT response.web\_search\_call.completed

{  
  "type": "response.web\_search\_call.completed",  
  "output\_index": 0,  
  "item\_id": "ws\_123",  
  "sequence\_number": 0

}

## **response.reasoning\_summary\_part.added**

Emitted when a new reasoning summary part is added.

item\_id

string

The ID of the item this summary part is associated with.

output\_index

integer

The index of the output item this summary part is associated with.

part

object

The summary part that was added.

Show properties

sequence\_number

integer

The sequence number of this event.

summary\_index

integer

The index of the summary part within the reasoning summary.

type

string

The type of the event. Always response.reasoning\_summary\_part.added.

OBJECT response.reasoning\_summary\_part.added

{  
  "type": "response.reasoning\_summary\_part.added",  
  "item\_id": "rs\_6806bfca0b2481918a5748308061a2600d3ce51bdffd5476",  
  "output\_index": 0,  
  "summary\_index": 0,  
  "part": {  
    "type": "summary\_text",  
    "text": ""  
  },  
  "sequence\_number": 1

}

## **response.reasoning\_summary\_part.done**

Emitted when a reasoning summary part is completed.

item\_id

string

The ID of the item this summary part is associated with.

output\_index

integer

The index of the output item this summary part is associated with.

part

object

The completed summary part.

Hide properties

text

string

The text of the summary part.

type

string

The type of the summary part. Always summary\_text.

sequence\_number

integer

The sequence number of this event.

summary\_index

integer

The index of the summary part within the reasoning summary.

type

string

The type of the event. Always response.reasoning\_summary\_part.done.

OBJECT response.reasoning\_summary\_part.done

{  
  "type": "response.reasoning\_summary\_part.done",  
  "item\_id": "rs\_6806bfca0b2481918a5748308061a2600d3ce51bdffd5476",  
  "output\_index": 0,  
  "summary\_index": 0,  
  "part": {  
    "type": "summary\_text",  
    "text": "\*\*Responding to a greeting\*\*\\n\\nThe user just said, \\"Hello\!\\" So, it seems I need to engage. I'll greet them back and offer help since they're looking to chat. I could say something like, \\"Hello\! How can I assist you today?\\" That feels friendly and open. They didn't ask a specific question, so this approach will work well for starting a conversation. Let's see where it goes from there\!"  
  },  
  "sequence\_number": 1

}

## **response.reasoning\_summary\_text.delta**

Emitted when a delta is added to a reasoning summary text.

delta

string

The text delta that was added to the summary.

item\_id

string

The ID of the item this summary text delta is associated with.

output\_index

integer

The index of the output item this summary text delta is associated with.

sequence\_number

integer

The sequence number of this event.

summary\_index

integer

The index of the summary part within the reasoning summary.

type

string

The type of the event. Always response.reasoning\_summary\_text.delta.

OBJECT response.reasoning\_summary\_text.delta

{  
  "type": "response.reasoning\_summary\_text.delta",  
  "item\_id": "rs\_6806bfca0b2481918a5748308061a2600d3ce51bdffd5476",  
  "output\_index": 0,  
  "summary\_index": 0,  
  "delta": "\*\*Responding to a greeting\*\*\\n\\nThe user just said, \\"Hello\!\\" So, it seems I need to engage. I'll greet them back and offer help since they're looking to chat. I could say something like, \\"Hello\! How can I assist you today?\\" That feels friendly and open. They didn't ask a specific question, so this approach will work well for starting a conversation. Let's see where it goes from there\!",  
  "sequence\_number": 1

}

## **response.reasoning\_summary\_text.done**

Emitted when a reasoning summary text is completed.

item\_id

string

The ID of the item this summary text is associated with.

output\_index

integer

The index of the output item this summary text is associated with.

sequence\_number

integer

The sequence number of this event.

summary\_index

integer

The index of the summary part within the reasoning summary.

text

string

The full text of the completed reasoning summary.

type

string

The type of the event. Always response.reasoning\_summary\_text.done.

OBJECT response.reasoning\_summary\_text.done

{  
  "type": "response.reasoning\_summary\_text.done",  
  "item\_id": "rs\_6806bfca0b2481918a5748308061a2600d3ce51bdffd5476",  
  "output\_index": 0,  
  "summary\_index": 0,  
  "text": "\*\*Responding to a greeting\*\*\\n\\nThe user just said, \\"Hello\!\\" So, it seems I need to engage. I'll greet them back and offer help since they're looking to chat. I could say something like, \\"Hello\! How can I assist you today?\\" That feels friendly and open. They didn't ask a specific question, so this approach will work well for starting a conversation. Let's see where it goes from there\!",  
  "sequence\_number": 1

}

