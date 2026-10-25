import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

import { AIChatPanel } from "./ai-chat-panel";

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { accessToken: "chat-test-token" } })
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

function responseForConversation(conversationId: string) {
  const body = [
    `event: metadata\ndata: ${JSON.stringify({
      conversation_id: conversationId,
      intent: "tax",
      sources: [
        {
          source: "Tax guide",
          source_url: "https://example.test/tax-guide"
        }
      ]
    })}\n\n`,
    'data: {"text":"Use the official guide."}\n\n'
  ].join("");
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body));
      controller.close();
    }
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" }
  });
}

function renderChatPanel() {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={enMessages as unknown as AbstractIntlMessages}
    >
      <AIChatPanel />
    </NextIntlClientProvider>
  );
}

describe("AI chat panel", () => {
  it("shows citation links and reuses the returned conversation ID", async () => {
    const conversationId = "7c35cb41-6bdc-4c92-82af-a0a453ab7e6d";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(responseForConversation(conversationId))
      .mockResolvedValueOnce(responseForConversation(conversationId));
    vi.stubGlobal("fetch", fetchMock);
    renderChatPanel();

    const input = screen.getByRole("textbox", { name: "Your message" });
    fireEvent.change(input, { target: { value: "How do taxes work?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    const citation = await screen.findByRole("link", { name: "Tax guide" });
    expect(citation.getAttribute("href")).toBe("https://example.test/tax-guide");
    expect(citation.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByText("Use the official guide.")).toBeDefined();

    fireEvent.change(input, { target: { value: "Can you explain further?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const secondRequest = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(secondRequest.conversation_id).toBe(conversationId);
    expect(fetchMock.mock.calls[0][1].headers).toEqual(
      expect.objectContaining({ Authorization: "Bearer chat-test-token" })
    );
  });

  it("copies a completed assistant response", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      "navigator",
      Object.assign(Object.create(navigator), {
        clipboard: { writeText }
      })
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        responseForConversation("7c35cb41-6bdc-4c92-82af-a0a453ab7e6d")
      )
    );
    renderChatPanel();

    fireEvent.change(screen.getByRole("textbox", { name: "Your message" }), {
      target: { value: "How do taxes work?" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    fireEvent.click(
      await screen.findByRole("button", { name: "Copy response" })
    );
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("Use the official guide.")
    );
    expect(
      await screen.findByRole("button", { name: "Response copied" })
    ).toBeDefined();
  });
});
