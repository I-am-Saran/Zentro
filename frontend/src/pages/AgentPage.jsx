import { useState, useRef, useEffect } from "react";
import {
    PaperAirplaneIcon,
    SparklesIcon,
    UserCircleIcon,
    CpuChipIcon
} from "@heroicons/react/24/solid";
import { Typography, Card, Input, Button } from "@material-tailwind/react";
import { API_BASE } from "../services/api";

export default function AgentPage() {
    const [messages, setMessages] = useState([
        {
            role: "assistant",
            content: "Hello! I am your AI assistant. I can help you manage Zentro, find information, and navigate the system. How can I help you today?"
        }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = { role: "user", content: input };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        try {
            // Call backend agent endpoint
            const url = `${API_BASE.replace(/\/$/, "")}/api/agent/chat`;
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("sb-access-token") || ""}` // specific to your auth
                },
                body: JSON.stringify({ message: userMsg.content }),
            });

            const data = await response.json();

            if (data.status === "success") {
                setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: data.reply }
                ]);
            } else {
                setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: data.reply || "Sorry, I encountered an error processing your request." }
                ]);
            }
        } catch (error) {
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "Sorry, I am having trouble connecting to the server." }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)]">
            <div className="mb-6">
                <Typography variant="h3" color="blue-gray" className="flex items-center gap-2">
                    <SparklesIcon className="h-8 w-8 text-purple-500" />
                    AI Agent
                </Typography>
                <Typography color="gray" className="font-normal">
                    Chat with your intelligent project assistant.
                </Typography>
            </div>

            <Card className="flex-1 flex flex-col bg-white shadow-xl overflow-hidden rounded-xl border border-blue-gray-100">
                {/* Chat Window */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
                    {messages.map((msg, index) => (
                        <div
                            key={index}
                            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"
                                }`}
                        >
                            <div
                                className={`flex gap-3 max-w-[80%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"
                                    }`}
                            >
                                <div
                                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === "user"
                                        ? "bg-blue-500 text-white"
                                        : "bg-purple-500 text-white"
                                        }`}
                                >
                                    {msg.role === "user" ? (
                                        <UserCircleIcon className="h-5 w-5" />
                                    ) : (
                                        <CpuChipIcon className="h-5 w-5" />
                                    )}
                                </div>

                                <div
                                    className={`p-4 rounded-2xl shadow-sm text-sm whitespace-pre-wrap ${msg.role === "user"
                                        ? "bg-blue-500 text-white rounded-tr-none"
                                        : "bg-white text-blue-gray-800 border border-blue-gray-100 rounded-tl-none"
                                        }`}
                                >
                                    {msg.content}
                                </div>
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex justify-start">
                            <div className="flex gap-3 max-w-[80%]">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white">
                                    <CpuChipIcon className="h-5 w-5 animate-pulse" />
                                </div>
                                <div className="p-4 rounded-2xl bg-white border border-blue-gray-100 rounded-tl-none shadow-sm">
                                    <div className="flex gap-1">
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={scrollRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white border-t border-blue-gray-100">
                    <div className="relative flex w-full max-w-[95%] mx-auto items-center">
                        <Input
                            type="text"
                            placeholder="Ask me to find bugs, create a task, or analyze status..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="!border-t-blue-gray-200 focus:!border-t-purple-500 pr-12 rounded-full py-6"
                            labelProps={{
                                className: "before:content-none after:content-none",
                            }}
                            containerProps={{
                                className: "min-w-0"
                            }}
                            disabled={loading}
                            autoFocus
                        />
                        <Button
                            size="sm"
                            color={input ? "purple" : "blue-gray"}
                            disabled={!input.trim() || loading}
                            className="!absolute right-1 top-1 bottom-1 rounded-full flex items-center justify-center w-10 h-10 min-w-[40px] px-0"
                            onClick={handleSend}
                        >
                            <PaperAirplaneIcon className="h-5 w-5 -ml-0.5 transform -rotate-45 translate-x-0.5" />
                        </Button>
                    </div>
                    <div className="text-center mt-2">
                        <Typography variant="small" color="gray" className="text-[10px] font-normal opacity-60">
                            AI can make mistakes. Please verify important information.
                        </Typography>
                    </div>
                </div>
            </Card>
        </div>
    );
}
