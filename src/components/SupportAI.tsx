import { useState } from "react";
import Markdown from "react-markdown";
import { fetchEventSource } from "@microsoft/fetch-event-source";

type Messages = { role: "user" | "assistant"; content: string }[];

function Messages({ messages }: { messages: Messages }) {
	return (
		<div className="flex flex-col justify-center gap-4">
			{messages
				.filter((message) => Boolean(message.content))
				.map((message, index) => (
					<div
						key={index}
						className={`w-fit max-w-3/4 rounded p-2 ${message.role === "user" ? "self-end bg-(--sl-color-bg-nav) text-black" : "bg-cl1-brand-orange text-cl1-black self-start"}`}
					>
						<Markdown>{message.content}</Markdown>
					</div>
				))}
		</div>
	);
}

export default function SupportAI() {
	const [threadId, setThreadId] = useState<string | undefined>();
	const [question, setQuestion] = useState<string>("");

	const [messages, setMessages] = useState<Messages>([]);

	async function handleSubmit() {
		setMessages((messages) => [
			...messages,
			{ role: "user", content: question },
			{ role: "assistant", content: "" },
		]);
		setQuestion("");

		const controller = new AbortController();
		const { signal } = controller;

		let chunkedAnswer = "";

		await fetchEventSource(
			"https://support-ai.cloudflaresupport.workers.dev/devdocs/ask",
			{
				method: "POST",
				body: JSON.stringify({
					question,
					threadId,
				}),
				signal,
				openWhenHidden: true,
				async onopen(response) {
					if (!response.ok) {
						throw new Error(response.status.toString());
					}

					return;
				},
				onerror(error) {
					if (error instanceof Error) {
						setMessages((messages) => [
							...messages,
							{
								role: "assistant",
								content:
									"I'm unable to provide an answer to that at the moment. Please rephrase your query and I'll try again.",
							},
						]);
						throw error;
					}
				},
				onmessage(ev) {
					if (ev.data === "[DONE]") {
						controller.abort();
					}

					const { threadId, response } = JSON.parse(ev.data);

					if (threadId) {
						setThreadId(threadId);
					}

					if (!response) return;

					chunkedAnswer += response;
					setMessages((messages) => {
						const newMessages = [...messages];
						newMessages[newMessages.length - 1].content = chunkedAnswer;
						return newMessages;
					});
				},
			},
		);
	}

	return (
		<div>
			<Messages messages={messages} />
			<div className="flex items-center justify-center gap-4">
				<input
					className="w-full rounded p-2"
					type="text"
					placeholder="Ask a question..."
					value={question}
					onChange={(e) => setQuestion(e.target.value)}
					onKeyDown={async (e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							await handleSubmit();
						}
					}}
				/>
			</div>
			<div>
				<strong>Debug:</strong>
				<pre className="whitespace-pre-wrap">
					{JSON.stringify({ threadId, messages, question }, null, 2)}
				</pre>
			</div>
		</div>
	);
}
