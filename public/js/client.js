
document.addEventListener("DOMContentLoaded", () => {
    const chatBox = document.getElementById("chat-box");
    const messageInput = document.getElementById("message-input");
    const sendButton = document.getElementById("send-button");
    const agentSelector = document.getElementById("agent-selector");

    if (!chatBox || !messageInput || !sendButton || !agentSelector) return;

    let ws;

    function connect() {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/`;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            addMessage("System", "Connected to DynamicAgent.", "text-green-500");
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === "status") {
                addMessage("System", data.message, "text-yellow-500");
            } else if (data.type === "result") {
                const resultStr = JSON.stringify(data.result, null, 2);
                addMessage(data.tool, resultStr, "text-blue-500");
            } else if (data.type === "error") {
                addMessage("Error", data.message, "text-red-500");
            }
        };

        ws.onclose = () => {
            addMessage("System", "Connection closed. Reconnecting...", "text-gray-500");
            setTimeout(connect, 2000);
        };
    }

    function addMessage(sender, message, colorClass) {
        const messageElement = document.createElement("div");
        messageElement.classList.add("p-2", "border-b");
        messageElement.innerHTML = `<strong class="${colorClass}">${sender}:</strong> <pre><code>${message}</code></pre>`;
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    sendButton.addEventListener("click", () => {
        const message = messageInput.value;
        const selectedAgent = agentSelector.value;
        if (ws && ws.readyState === WebSocket.OPEN && message) {
            try {
                const parsedMessage = JSON.parse(message);
                const payload = {
                    agent: selectedAgent,
                    ...parsedMessage
                };
                ws.send(JSON.stringify(payload));
                addMessage("You", message, "text-black");
                messageInput.value = "";
            } catch(e) {
                addMessage("Error", "Invalid JSON format in message.", "text-red-500");
            }
        }
    });

    connect();
});
