import React, { useState, useRef, useEffect, useMemo } from "react";
import { v4 as uuidv4 } from 'uuid';
import ChatBanner from "../chat/chatBanner/ChatBanner";
import ChatBubble from "../chat/chatBubble/ChatBubble";
import ChatInput from "../chat/chatInput/ChatInput";
import ChatMessages from "../chat/chatMessages/ChatMessages";
import TypingIndicator from "../chat/typingIndicator/TypingIndicator";
import "../../assets/stylesheets/chat/chat.scss";
import { fetchResponse } from "../../services";
import { url, ChatProps, Roles, Statuses, Message } from '../../constants';

const API_KEY = import.meta.env.VITE_API_KEY;
const { initial, retrying, success, sending } = Statuses;
const { user, assistant } = Roles;

const Chat = ({ messages, setMessages, openWindow, shouldRetrieveBackup }: ChatProps) => {
  const [input, setInput] = useState('');
  const [typingIndicator, setTypingIndicator] = useState(false);
  const [status, setStatus] = useState(initial);
  const [retryMsgId, setRetryMsgId] = useState('');
  const [chatHistory, setChatHistory] = useState<{ prompt: string; response: string }[]>([]);

  const messagesForApiBody = messages.map(({ role, content }) => ({ role, content }));
  const apiRequestBody = useMemo(() => {
    return {
      model: "gpt-3.5-turbo",
      messages: messagesForApiBody,
    };
  }, [messagesForApiBody]);

  const windowEndRef: React.RefObject<HTMLDivElement> = useRef(null);
  const inputRef: React.RefObject<HTMLTextAreaElement> = useRef(null);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
  };

  const handleSend = (userInput = input) => {
    if (userInput !== "") {
      setMessages((oldMessages: Array<Message>) => [
        ...oldMessages,
        {
          role: user,
          content: userInput,
          datetime: new Date().toLocaleString(),
          id: uuidv4(),
        },
      ]);
      setStatus(sending);
      setTypingIndicator(true);
      setInput("");
    }
  };

  const handleEnter = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      ((status === initial || status === success) && handleSend());
    }
  };

  const scrollToBottom = () => {
    if (windowEndRef.current) {
      const scrollHeight = windowEndRef.current.scrollHeight;
      const height = windowEndRef.current.clientHeight;
      const maxScrollTop = scrollHeight - height;
      windowEndRef.current.scrollTop = maxScrollTop > 0 ? maxScrollTop : 0;
    }
  };

  const handleRetry = async (id: string) => {
    setStatus(retrying);
    setRetryMsgId(id);
    fetchResponse(url, API_KEY, apiRequestBody, messages, setMessages, setTypingIndicator, setStatus);
  };

  const downloadCSV = () => {
    const header = "Prompt,Response\n";
    const rows = chatHistory
      .map(entry =>
        `"${entry.prompt.replace(/"/g, '""')}","${entry.response.replace(/"/g, '""')}"`
      )
      .join("\n");
    const csvContent = header + rows;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "chat-history.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, openWindow, status]);

  useEffect(() => {
    if (messages.length > 1 || !shouldRetrieveBackup)
      window.localStorage.setItem("messages", JSON.stringify(messages));
  }, [messages, shouldRetrieveBackup]);

  useEffect(() => {
    if (status === sending || status === retrying) {
      fetchResponse(
        url,
        API_KEY,
        apiRequestBody,
        messages,
        setMessages,
        setTypingIndicator,
        setStatus
      );
    }
  }, [messages, setMessages, typingIndicator, setTypingIndicator, status, apiRequestBody]);

  useEffect(() => {
    const lastUserMessage = messages.filter(m => m.role === user).slice(-1)[0];
    const lastBotMessage = messages.filter(m => m.role === assistant).slice(-1)[0];

    if (status === success && lastUserMessage && lastBotMessage) {
      setChatHistory((prev) => [
        ...prev,
        { prompt: lastUserMessage.content, response: lastBotMessage.content },
      ]);
    }
  }, [messages, status]);

  return (
    <>
      {openWindow && (
        <div className="chat-container">
          <ChatBanner />
          <ChatMessages windowEndRef={windowEndRef}>
            {messages.map((message) => {
              if (message.role === assistant) {
                return (
                  <React.Fragment key={message.datetime.concat(message.content)}>
                    <ChatBubble isBotBubble message={message} handleRetry={handleRetry} />
                  </React.Fragment>
                );
              } else {
                return (
                  <React.Fragment key={message.datetime.concat(message.content)}>
                    <ChatBubble
                      isBotBubble={false}
                      message={message}
                      status={status}
                      handleRetry={handleRetry}
                      retryMsgId={retryMsgId}
                    />
                  </React.Fragment>
                );
              }
            })}
          </ChatMessages>
          <TypingIndicator typingIndicator={typingIndicator} />
          <ChatInput
            input={input}
            inputRef={inputRef}
            handleInputChange={handleInputChange}
            handleSend={handleSend}
            handleEnter={handleEnter}
            status={status}
          />
          <button onClick={downloadCSV} style={{ margin: "10px", padding: "8px" }}>
            Download Chat History (CSV)
          </button>
        </div>
      )}
    </>
  );
};

export default Chat;
