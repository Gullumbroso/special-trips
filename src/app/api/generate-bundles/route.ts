import { NextRequest } from "next/server";
import OpenAI from "openai";
import { UserPreferences } from "@/lib/types";
import { INTEREST_LABELS } from "@/lib/constants";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const PROMPT_ID = "pmpt_68b758d74f60819593d91d254518d4fc020955df32c90659";

export async function POST(request: NextRequest) {
  try {
    const preferences: UserPreferences = await request.json();

    // Format interests as comma-separated string with labels
    const interestsString = preferences.interests
      .map((interest) => INTEREST_LABELS[interest])
      .join(", ");

    // Create a ReadableStream for SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Call OpenAI API with streaming enabled
          const response = await openai.responses.create({
            prompt: {
              id: PROMPT_ID,
              variables: {
                interests: interestsString,
                music_taste: preferences.musicProfile,
                date_range: preferences.timeframe,
                free_text_requests: preferences.otherPreferences || "None",
              },
            },
            reasoning: {
              effort: "medium",
              summary: "auto",
            },
            stream: true,
          });

          // Process the stream
          let fullContent = "";

          for await (const event of response) {
            // Handle response failure
            if (event.type === "response.failed") {
              const errorMsg = event.response?.error?.message || "Response failed";
              console.error("Response failed:", errorMsg);
              const message = `event: error\ndata: ${JSON.stringify({ message: errorMsg })}\n\n`;
              controller.enqueue(encoder.encode(message));
              break;
            }

            // When a reasoning summary step completes, send it to client
            if (event.type === "response.reasoning_summary_part.done") {
              const text = event.part?.text || "";
              if (text) {
                console.log(`[SUMMARY ${event.summary_index}]:`, text);
                const message = `event: reasoning_summary\ndata: ${JSON.stringify({ text })}\n\n`;
                controller.enqueue(encoder.encode(message));
              }
            }

            // Collect output text deltas (final answer)
            if (event.type === "response.output_text.delta") {
              fullContent += event.delta || "";
            }

            // Send completion event with final output
            if (event.type === "response.completed") {
              console.log("Response completed, content length:", fullContent.length);

              if (!fullContent) {
                throw new Error("No content in response");
              }

              // Parse JSON from the response
              let bundles;
              try {
                bundles = typeof fullContent === "string" ? JSON.parse(fullContent) : fullContent;
              } catch (parseError) {
                console.error("Failed to parse response:", fullContent.substring(0, 500));
                throw new Error("Invalid response format from AI");
              }

              const message = `event: completed\ndata: ${JSON.stringify({ bundles })}\n\n`;
              controller.enqueue(encoder.encode(message));
            }
          }

          controller.close();
        } catch (error) {
          console.error("Error generating bundles:", error);
          const errorMessage = `event: error\ndata: ${JSON.stringify({ message: error instanceof Error ? error.message : "Unknown error" })}\n\n`;
          controller.enqueue(encoder.encode(errorMessage));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error setting up stream:", error);

    return new Response(
      JSON.stringify({
        error: "Failed to generate trip bundles",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
